// OTOİZ P1 — tarayıcıdan doğrudan Supabase Auth'a giden akışların (giriş,
// şifre sıfırlama, MFA) hatalarını Sistem Sağlığı için sayar. Yalnız izinli
// tür + ekran adı kaydedilir; e-posta, IP ya da hata metni SAKLANMAZ.
// IP başına sınırlıdır; sahte bildirimle kritik alarm üretilemez (izinli türler
// "kritik" sayılmaz).
import { logAppEvent } from "@/lib/appEvents";
import { isRateLimited } from "@/lib/rateLimit";
const { CLIENT_EVENT_KINDS, CLIENT_AREAS } = require("@/lib/appEventsCore");
const { clientIp, LIMITS } = require("@/lib/rateLimitCore");

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const kind = String(body?.kind || "");
  const area = String(body?.area || "");
  if (!CLIENT_EVENT_KINDS.has(kind) || !CLIENT_AREAS.has(area)) return new Response(null, { status: 204 });
  if (await isRateLimited([{ scope: "client-event-ip-10m", value: clientIp(req.headers), ...LIMITS.clientEventIp10m }], { silent: true })) {
    return new Response(null, { status: 204 });
  }
  const code = typeof body?.code === "string" ? body.code.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40) : null;
  await logAppEvent(kind, `client/${area}`, null, code ? { code } : null);
  return new Response(null, { status: 204 });
}
