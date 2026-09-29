// OTOİZ Aşama 1 — kalıcı QR resolver.
//
// Fiziksel QR içeriği: https://go.<final-domain>/<token>
// next.config.js, go-host'a gelen /<token> isteğini buraya (/r/<token>)
// rewrite eder. Staging'de doğrudan /r/<token> ile test edilir.
//
// Veritabanına service role ile DEĞİL, anon anahtarla ve yalnız
// resolve_qr_token() RPC'si üzerinden gidilir: RPC yalnız durum döndürür
// ('not_found' | 'revoked' | 'unassigned' | 'active'); qr_keys tablosu anon'a
// kapalı kalır. Karar mantığı lib/qrResolver.js'de (unit testli).

import { NextRequest, NextResponse } from "next/server";
import { createAnonServerSupabase } from "@/lib/supabase";
const { NO_STORE_HEADERS, normalizeResolverToken, decide, renderMessagePage } = require("@/lib/qrResolver");
import { isRateLimited } from "@/lib/rateLimit";
import { logAppEvent } from "@/lib/appEvents";
const { clientIp, LIMITS } = require("@/lib/rateLimitCore");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function handle(req: NextRequest, params: { token: string }) {
  const token = normalizeResolverToken(params.token);

  let status = "not_found";
  if (token) {
    try {
      const { data, error } = await createAnonServerSupabase().rpc("resolve_qr_token", { p_token: token });
      status = error ? "error" : String(data);
    } catch {
      status = "error";
    }
  }

  // P1: sistem hatası Sistem Sağlığı'na yazılır. Sistemde olmayan kodlar IP
  // başına sayılır; aşımda 429 (kod tahmini/tarama). Geçerli anahtarlık
  // okutmaları sayılmaz, veritabanına yazmaz ve hiç sınırlanmaz.
  if (status === "error") {
    await logAppEvent("resolver_error", "/r", 503);
  } else if (status === "not_found") {
    const limited = await isRateLimited([{ scope: "qr-miss-ip-10m", value: clientIp(req.headers), ...LIMITS.resolverMissIp10m }], { silent: true });
    if (limited) {
      await logAppEvent("resolver_rate_limited", "/r", 429);
      return new NextResponse(
        renderMessagePage("Çok fazla deneme", "Kısa sürede çok sayıda geçersiz kod okutuldu. Lütfen birkaç dakika sonra tekrar deneyin."),
        { status: 429, headers: { ...NO_STORE_HEADERS, "Content-Type": "text/html; charset=utf-8", "Retry-After": "600" } }
      );
    }
  }

  const appOrigin = process.env.OTOIZ_APP_ORIGIN || new URL(req.url).origin;
  const d = decide(token, status, appOrigin);

  if (d.kind === "redirect") {
    return new NextResponse(null, { status: d.status, headers: { ...NO_STORE_HEADERS, Location: d.location } });
  }
  return new NextResponse(renderMessagePage(d.title, d.body), {
    status: d.status,
    headers: { ...NO_STORE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  return handle(req, params);
}

export async function HEAD(req: NextRequest, { params }: { params: { token: string } }) {
  const res = await handle(req, params);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
