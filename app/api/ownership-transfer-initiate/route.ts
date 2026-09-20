import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

// İkinci düzeltme turu (madde 3): incelemede, "sahiplik devri"nin
// yalnızca servis/panel tarafında değil, BİREYSEL kullanıcılar için de
// TAMAMEN AYRI bir self-service akışı (supabase.rpc("initiate_ownership_
// transfer", ...) doğrudan tarayıcıdan çağrılıyordu) olduğu ve bunun
// PILOT_FLAGS ile hiç kapatılmadığı ortaya çıktı — bu route o boşluğu
// kapatıyor.
//
// RPC'nin KENDİSİ (DB fonksiyonu) değiştirilmedi/dokunulmadı — bu bir
// migration değil. Yalnızca RPC'yi ÇAĞIRMA yolu, önüne bir pilot-bayrağı
// kapısı eklenerek bu route'a taşındı. RPC hâlâ, tarayıcıdan çağrıldığı
// zamanki AYNI kullanıcı kimliğiyle (userClient, servis-rolü DEĞİL)
// çalıştırılıyor — RPC'nin kendi iç yetkilendirme mantığı (varsa)
// bu route'un service-role kullanmaması sayesinde birebir aynı şekilde
// işliyor.
export async function POST(req: NextRequest) {
  try {
    if (!PILOT_FLAGS.ownershipTransferSelfService) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
    }

    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    if (!body.vehicle_id) {
      return NextResponse.json({ error: "vehicle_id_required" }, { status: 400 });
    }

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await userClient.rpc("initiate_ownership_transfer", { p_vehicle_id: body.vehicle_id });
    if (error || !data) {
      return NextResponse.json({ error: "transfer_failed" }, { status: 400 });
    }

    return NextResponse.json({ token: data.token, expires_at: data.expires_at });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
