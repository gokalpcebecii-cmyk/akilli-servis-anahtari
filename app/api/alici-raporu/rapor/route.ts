// OTOİZ — OTOİZ Alıcı Raporu: public buyer endpoint.
// Token: buyer_shares.token_hash (sha256). Ham token yalnız bu istekte gelir.
// Dönen veri STRICT allowlist'tir; private belge/owner/auth/internal alanlar
// asla çıkmaz. Revoked veya süresi geçmiş paylaşım: 410. Bilinmeyen: 404.
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { hashShareToken, isShareActive, isShareExpired, buildBuyerReport } = require("@/lib/buyerReport");
const { LIMITS } = require("@/lib/rateLimitCore");

async function handleGET(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get("token") || "").trim();
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Token taraması/tahmini: IP başına ayrı sınır — tahmin edilemeyen token
  // için geçerli talepler sınırsız kalır.
  if (await isRateLimited([{ scope: "buyer-rapor-ip-10m", value: req.headers.get("x-forwarded-for") || "unknown", ...LIMITS.buyerRaporIp10m }])) {
    return rateLimitedResponse();
  }

  const db = createServerSupabase();
  const { data: share } = await db
    .from("buyer_shares")
    .select("id, vehicle_id, expires_at, revoked_at")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();

  if (!share) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (share.revoked_at) {
    return NextResponse.json({ error: "revoked" }, { status: 410 });
  }
  if (isShareExpired(share)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const { data: vehicle } = await db
    .from("vehicles")
    .select("id, plate, brand, model, year, current_km, next_service_km, next_service_date, muayene_tarihi, kasko_bitis, trafik_sigortasi_bitis")
    .eq("id", share.vehicle_id)
    .maybeSingle();
  if (!vehicle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: records } = await db
    .from("maintenance_records")
    .select("service_date, km_at_service, description, tenant_id")
    .eq("vehicle_id", share.vehicle_id)
    .order("service_date", { ascending: false })
    .limit(50);

  // last_accessed_at güncellemesi; hata akışı engellemesin.
  try {
    await db.from("buyer_shares").update({ last_accessed_at: new Date().toISOString() }).eq("id", share.id);
  } catch {}

  return NextResponse.json(buildBuyerReport(vehicle, records ?? []), { status: 200 });
}

export const GET = withApiLog("/api/alici-raporu/rapor", handleGET);
