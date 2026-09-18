import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    const { code, vehicle_id } = body;

    if (!code || !vehicle_id) {
      return NextResponse.json({ error: "Kod ve araç gerekli" }, { status: 400 });
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

    const supabase = createServerSupabase();

    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();

    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, tenant_id")
      .eq("id", vehicle_id)
      .single();

    if (!vehicle || vehicle.tenant_id !== staff?.tenant_id) {
      return NextResponse.json({ error: "Bu araç sizin işletmenize ait değil" }, { status: 403 });
    }

    const { data: qrKey } = await supabase.from("qr_keys").select("*").eq("code", code).maybeSingle();

    if (!qrKey) {
      return NextResponse.json({ error: "Bu kod sistemde bulunamadı" }, { status: 404 });
    }
    if (qrKey.revoked_at) {
      return NextResponse.json({ error: "Bu QR kod iptal edilmiş, tekrar kullanılamaz" }, { status: 400 });
    }
    if (qrKey.vehicle_id) {
      return NextResponse.json({ error: "Bu QR kod zaten başka bir araca bağlı" }, { status: 400 });
    }

    const { error } = await supabase
      .from("qr_keys")
      .update({ vehicle_id, assigned_at: new Date().toISOString() })
      .eq("code", code);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
