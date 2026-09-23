// OTOİZ — 2026-09-23: Bireysel satış akışı.
// Yönetici, ürettiği QR kodunu yönetim panelinden bir bireysel kullanıcıya
// tanımlar (qr_keys.reserved_user_id). Kullanıcı bu kodu YALNIZ kendi
// aracına bağlayabilir. qr_keys istemci rollerine yazmaya kapalıdır; bu
// route kimliği kullanıcının kendi JWT'si ile doğrular, yazmayı sunucu
// (service_role) istemcisiyle ve aşağıdaki kontrollerden sonra yapar.
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function currentUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader }, fetch: (i: any, o?: any) => fetch(i, { ...(o || {}), cache: "no-store" }) },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  return data?.user ?? null;
}

// Kullanıcıya tanımlı, henüz bir araca bağlanmamış kodlar.
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createServerSupabase();
  const { data, error } = await db
    .from("qr_keys")
    .select("code, created_at")
    .eq("reserved_user_id", user.id)
    .is("vehicle_id", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Kodlar okunamadı" }, { status: 500 });
  return NextResponse.json({ codes: (data ?? []).map((r: any) => r.code) });
}

// Tanımlı kodu kullanıcının kendi aracına bağla.
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  const vehicleId = typeof body.vehicle_id === "string" ? body.vehicle_id : "";
  if (!code || !vehicleId) return NextResponse.json({ error: "Kod ve araç gerekli" }, { status: 400 });

  const db = createServerSupabase();

  const { data: vehicle } = await db.from("vehicles").select("id, owner_user_id, tenant_id, plate").eq("id", vehicleId).maybeSingle();
  if (!vehicle || vehicle.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Bu araç size ait değil" }, { status: 403 });
  }

  const { data: qr } = await db
    .from("qr_keys")
    .select("id, code, vehicle_id, revoked_at, reserved_user_id")
    .eq("code", code)
    .maybeSingle();
  // Kod yoksa da, başkasına aitse de aynı yanıt: kod tahminiyle başkasının
  // anahtarlığının varlığı öğrenilemesin.
  if (!qr || qr.reserved_user_id !== user.id) {
    return NextResponse.json({ error: "Bu kod hesabınıza tanımlı değil. Anahtarlığı aldığınız yerle iletişime geçin." }, { status: 403 });
  }
  if (qr.revoked_at) return NextResponse.json({ error: "Bu kod iptal edilmiş" }, { status: 400 });
  if (qr.vehicle_id) return NextResponse.json({ error: "Bu kod zaten bir araca bağlı" }, { status: 400 });

  const { data: active } = await db.from("qr_keys").select("code").eq("vehicle_id", vehicleId).is("revoked_at", null).maybeSingle();
  if (active) return NextResponse.json({ error: "Bu aracın zaten aktif bir QR anahtarlığı var" }, { status: 400 });

  const { data: updated, error } = await db
    .from("qr_keys")
    .update({ vehicle_id: vehicleId, assigned_at: new Date().toISOString() })
    .eq("id", qr.id)
    .eq("reserved_user_id", user.id)
    .is("vehicle_id", null)
    .is("revoked_at", null)
    .select("code");
  if (error || !updated || updated.length === 0) {
    return NextResponse.json({ error: "Anahtarlık bağlanamadı, tekrar deneyin" }, { status: 400 });
  }

  await db.from("audit_log").insert({
    tenant_id: vehicle.tenant_id ?? null,
    actor_staff_id: null,
    action: "qr_key_assigned",
    target_table: "qr_keys",
    target_id: qr.id,
    detail: { code, vehicle_id: vehicleId, plate: vehicle.plate, actor_user_id: user.id, via: "bireysel_uygulama" },
  });

  return NextResponse.json({ ok: true, code });
}
