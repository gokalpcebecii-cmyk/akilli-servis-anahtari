import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
const { normalizeQrCode } = require("@/lib/qrToken");

export async function POST(req: NextRequest) {
  try {
    // İkinci düzeltme turu (madde 4): /panel/eslestir ekranı atlanıp
    // doğrudan bu route'a istek gönderilse bile pilot süresince sıfır
    // yan etkiyle (hiçbir sorgu/yazma çalışmadan) 403 döner.
    // ÜÇÜNCÜ düzeltme turu (madde 6) DÜRÜSTLÜK NOTU: bu route ÖNCEDEN
    // (PILOT FIX 03'ten) var — yalnızca bayrak kapısını sarmalamak için
    // eklenmedi, tenant-kapsamlı doğrulama (vehicle.tenant_id kontrolü)
    // gibi gerçek iş mantığı taşıyor, bu yüzden korunuyor. 2026-09-24:
    // qr_keys üzerindeki istemci yazma yetkileri (INSERT/UPDATE/DELETE)
    // grant_hardening migration'ı ile tamamen kaldırıldı; eşleştirme
    // yalnızca bu route (service role) üzerinden yapılabilir.
    if (!PILOT_FLAGS.qrMatchingSelfService) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
    }

    // Kimlik doğrulama gövde doğrulamasından ÖNCE yapılır (kimliksiz istek her zaman 401).
    const authHeader = req.headers.get("authorization");
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = normalizeQrCode(body?.code);
    const vehicle_id = body?.vehicle_id;

    if (!code || !vehicle_id) {
      return NextResponse.json({ error: "Kod ve araç gerekli" }, { status: 400 });
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

    if (!staff?.tenant_id) {
      return NextResponse.json({ error: "Servis hesabı gerekli" }, { status: 403 });
    }
    const { data: tenantRow } = await supabase.from("tenants").select("approval_status").eq("id", staff.tenant_id).maybeSingle();
    if (tenantRow?.approval_status !== "approved") {
      return NextResponse.json({ error: "İşletmeniz henüz OTOİZ tarafından onaylanmadı." }, { status: 403 });
    }

    if (!vehicle || vehicle.tenant_id !== staff?.tenant_id) {
      return NextResponse.json({ error: "Bu araç sizin işletmenize ait değil" }, { status: 403 });
    }

    const { data: qrKey } = await supabase.from("qr_keys").select("*").eq("code", code).maybeSingle();

    if (!qrKey) {
      return NextResponse.json({ error: "Bu kod sistemde bulunamadı" }, { status: 404 });
    }
    // 2026-09-24: servis YALNIZ yönetici tarafından kendi işletmesine
    // ayrılmış (reserved_tenant_id) kodları eşleştirebilir — havuzdaki
    // ya da başka servise ayrılmış bir kodu tahmin/deneme yoluyla alamaz.
    if (qrKey.reserved_tenant_id !== staff.tenant_id) {
      return NextResponse.json({ error: "Bu kod işletmenize tanımlı değil. OTOİZ yönetimiyle iletişime geçin." }, { status: 403 });
    }
    if (qrKey.revoked_at) {
      return NextResponse.json({ error: "Bu QR kod iptal edilmiş, tekrar kullanılamaz" }, { status: 400 });
    }
    if (qrKey.vehicle_id) {
      return NextResponse.json({ error: "Bu QR kod zaten başka bir araca bağlı" }, { status: 400 });
    }

    const { data: activeForVehicle } = await supabase
      .from("qr_keys")
      .select("code")
      .eq("vehicle_id", vehicle_id)
      .is("revoked_at", null)
      .maybeSingle();
    if (activeForVehicle) {
      return NextResponse.json({ error: "Bu aracın zaten aktif bir QR anahtarlığı var" }, { status: 400 });
    }

    const { error } = await supabase
      .from("qr_keys")
      .update({ vehicle_id, assigned_at: new Date().toISOString() })
      .eq("code", code)
      .is("vehicle_id", null)
      .is("revoked_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 2026-09-23: yönetici panelinde "kim neyi bağladı" görünsün diye
    // servis eşleştirmesi de denetim kaydına yazılır (hata akışı bozmaz).
    await supabase.from("audit_log").insert({
      tenant_id: staff.tenant_id,
      actor_staff_id: userData.user.id,
      action: "qr_key_assigned",
      target_table: "qr_keys",
      target_id: qrKey.id,
      detail: { code, vehicle_id, via: "servis_panel" },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
