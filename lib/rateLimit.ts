// OTOİZ P0 — sunucu tarafı hız sınırı. Yalnız API route'larında kullanılır.
import { createServerSupabase } from "@/lib/supabase";
const { rateKey, RATE_LIMIT_MESSAGE } = require("@/lib/rateLimitCore");

export type RateCheck = { scope: string; value: string; windowSeconds: number; max: number };

// Sınırlardan biri aşıldıysa true. Sayaç okunamazsa (ör. migration henüz
// uygulanmadı) istek engellenmez ve hata günlüğe yazılır; Supabase Auth'un
// kendi gönderim sınırları bu durumda da geçerlidir.
export async function isRateLimited(checks: RateCheck[]): Promise<boolean> {
  const db = createServerSupabase();
  let limited = false;
  for (const c of checks) {
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_key: rateKey(c.scope, c.value),
      p_window_seconds: c.windowSeconds,
      p_max: c.max,
    });
    if (error) {
      console.error("[otoiz] rate_limit_hit hatası:", error.message);
      continue;
    }
    if (data === false) limited = true;
  }
  return limited;
}

export function rateLimitedResponse() {
  return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429, headers: { "Retry-After": "600" } });
}
