import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const { validateVehicleInput, isValidNextServiceKm } = require("@/lib/logic");

// PILOT FIX 03 (madde A1): araç oluşturmanın GERÇEK kayıt katmanı.
// Bireysel ve servis "Yeni Araç" formları artık doğrudan
// supabase.from("vehicles").insert(...) çağırmıyor — ikisi de bu route'a
// gelip AYNI validateVehicleInput() fonksiyonundan geçiyor (istemci
// tarafındaki anlık doğrulamayla birebir aynı kod, bkz. lib/logic.js).
// Geçersiz istekte hiçbir satır (araç/QR/audit) yazılmıyor.
//
// RLS/Auth modeli DEĞİŞMEDİ: bu route servis-rolü istemcisini yalnızca
// qr-eslestir route'unun zaten kullandığı desenle (kullanıcıyı Authorization
// header'ından doğrula, yetki kapsamını (owner_user_id/tenant_id) burada
// KENDİ SORGUSUYLA belirle) kullanıyor — mevcut policy'lere dokunmuyor,
// yalnızca bu tek yazma yolunun önüne bir doğrulama katmanı ekliyor.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabase();

    const { data: staff } = await supabase.from("staff_users").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    const isServis = !!staff?.tenant_id;

    const { valid, errors, normalized } = validateVehicleInput({
      plate: body.plate,
      brand: body.brand,
      model: body.model,
      year: body.year,
      current_km: body.current_km,
    });
    if (!valid) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const nextServiceKm =
      body.next_service_km === "" || body.next_service_km == null ? null : Number(body.next_service_km);
    if (nextServiceKm != null && !isValidNextServiceKm(normalized.current_km, nextServiceKm)) {
      return NextResponse.json(
        { errors: { next_service_km: "Sonraki bakım kilometresi, güncel kilometreden büyük olmalı." } },
        { status: 400 }
      );
    }
    const nextServiceDate = body.next_service_date || null;

    // Aynı kapsamda (kendi araçları / kendi tenant'ı) aynı kanonik plaka
    // zaten var mı — anlaşılır uyarı için (bkz. madde A2).
    let dupQuery = supabase.from("vehicles").select("id").eq("plate", normalized.plate);
    dupQuery = isServis ? dupQuery.eq("tenant_id", staff!.tenant_id) : dupQuery.eq("owner_user_id", userData.user.id);
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      return NextResponse.json({ errors: { plate: "Bu plakayla zaten bir araç kayıtlı." } }, { status: 409 });
    }

    const insertPayload: Record<string, unknown> = {
      plate: normalized.plate,
      brand: normalized.brand,
      model: normalized.model,
      year: normalized.year,
      current_km: normalized.current_km,
      next_service_km: nextServiceKm,
      next_service_date: nextServiceDate,
    };
    if (isServis) {
      insertPayload.tenant_id = staff!.tenant_id;
      insertPayload.owner_user_id = null;
    } else {
      insertPayload.owner_user_id = userData.user.id;
      insertPayload.tenant_id = null;
    }

    const { data: created, error } = await supabase.from("vehicles").insert(insertPayload).select().single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ vehicle: created });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
