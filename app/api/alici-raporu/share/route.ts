// OTOİZ — Alıcı Raporu paylaşım yönetimi (araç sahibi JWT'siyle).
// op: create (süre: 24h|3d|7d) · list (aracın paylaşımları) · revoke
// Token plaintext YALNIZCA create yanıtında, BİR KEZ gösterilir; DB'de sha256
// özeti bulunur. Başka kullanıcının aracına sahip olunamaz: ownership, JWT'den
// türetilen userId ile kontrol edilir.
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { withApiLog } from "@/lib/appEvents";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { generateShareToken, hashShareToken, durationHoursFor, sharesExpireAt } = require("@/lib/buyerReport");

async function userFrom(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const userApp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data } = await userApp.auth.getUser();
  return data?.user ?? null;
}

async function ownsVehicle(userId: string, vehicleId: string, authHeader: string) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data } = await c.from("vehicles").select("id, owner_user_id").eq("id", vehicleId).maybeSingle();
  return !!(data && data.owner_user_id === userId);
}

async function handlePOST(req: NextRequest) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const op = String(body.op || "").toLowerCase();
  const vehicleId = String(body.vehicle_id || "");
  if (!vehicleId) return NextResponse.json({ error: "Araç bulunamadı." }, { status: 400 });

  const authHeader = req.headers.get("authorization")!;
  if (!(await ownsVehicle(user.id, vehicleId, authHeader))) {
    return NextResponse.json({ error: "Bu araca erişim yetkiniz yok." }, { status: 403 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  if (op === "create") {
    if (await isRateLimited([{ scope: "buyer-share-create-h", value: user.id, windowSeconds: 3600, max: 10 }])) return rateLimitedResponse();
    const durationKey = String(body.duration || "").toLowerCase();
    const hours = durationHoursFor(durationKey);
    if (!hours) return NextResponse.json({ error: "Geçersiz paylaşım süresi." }, { status: 400 });

    const token = generateShareToken();
    const { error: insErr, data } = await db
      .from("buyer_shares")
      .insert({ vehicle_id: vehicleId, created_by: user.id, token_hash: hashShareToken(token), duration_hours: hours, expires_at: sharesExpireAt(durationKey) })
      .select("id, expires_at, duration_hours")
      .maybeSingle();
    if (insErr || !data) return NextResponse.json({ error: "Paylaşım oluşturulamadı. Lütfen tekrar deneyin." }, { status: 500 });

    return NextResponse.json({
      ok: true,
      share: { id: data.id, expires_at: data.expires_at, duration_hours: data.duration_hours },
      token,
      url: `/alici/${token}`,
    });
  }

  if (op === "list") {
    const { data } = await db
      .from("buyer_shares")
      .select("id, expires_at, revoked_at, duration_hours, created_at, last_accessed_at")
      .eq("vehicle_id", vehicleId)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return NextResponse.json({ ok: true, shares: data ?? [] });
  }

  if (op === "revoke") {
    const shareId = String(body.share_id || "");
    if (!shareId) return NextResponse.json({ error: "Paylaşım bulunamadı." }, { status: 400 });
    const { error } = await db
      .from("buyer_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId)
      .eq("created_by", user.id)
      .eq("vehicle_id", vehicleId);
    if (error) return NextResponse.json({ error: "Paylaşım kapatılamadı." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}

export const POST = withApiLog("/api/alici-raporu/share", handlePOST);
