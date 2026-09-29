// OTOİZ Faz 3.1 — bireysel kayıt, gerçek e-posta doğrulamasıyla.
//
// Supabase Auth signUp kullanılır; Auth doğrulama e-postası gönderir ve
// kullanıcı bağlantıya basana kadar giriş yapamaz (activate_product() da
// doğrulanmamış hesabı reddeder). Oturum burada AÇILMAZ.
//
// P0 son kapılar: kayıtta şifre ALINMAZ. Hesap kimsenin bilmediği rastgele
// bir şifreyle açılır (veritabanı da doğrulanmamış hesabın şifresini her
// zaman rastgele tutar). Şifreyi yalnız e-posta kutusunun sahibi, doğrulama
// bağlantısıyla gelen oturumda /bireysel/kayit/tamamla sayfasında belirler.
// Böylece başkasının e-postasıyla açılan ön kayıt adresi kilitlemez ve
// sonradan o hesaba giriş sağlamaz. Yanıt, e-postanın kayıtlı olup
// olmadığını açığa vurmaz.
import { authClient, appOriginFor } from "@/lib/authSignup";
const { unguessablePassword } = require("@/lib/serviceSignup");
const { confirmRedirectUrl, signupErrorMessage } = require("@/lib/emailConfirm");
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
const { clientIp, LIMITS } = require("@/lib/rateLimitCore");
import { logAppEvent } from "@/lib/appEvents";
const { classifyAuthError } = require("@/lib/appEventsCore");
import { withApiLog } from "@/lib/appEvents";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const { full_name, phone, next } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return Response.json({ error: "E-posta zorunlu." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
    }

    // P0: kayıt kötüye kullanımına karşı IP ve e-posta başına hız sınırı.
    const ip = clientIp(req.headers);
    if (
      await isRateLimited([
        { scope: "ind-signup-ip-10m", value: ip, ...LIMITS.signupIp10m },
        { scope: "ind-signup-ip-day", value: ip, ...LIMITS.signupIpDay },
        { scope: "ind-signup-email-h", value: email, ...LIMITS.signupEmailHour },
      ])
    ) {
      return rateLimitedResponse();
    }

    const { data, error } = await authClient().auth.signUp({
      email,
      password: unguessablePassword(),
      options: {
        emailRedirectTo: confirmRedirectUrl(appOriginFor(req), next),
        data: {
          full_name: typeof full_name === "string" ? full_name.trim().slice(0, 120) || null : null,
          phone: typeof phone === "string" ? phone.trim().slice(0, 40) || null : null,
          account_type: "individual",
        },
      },
    });

    if (error) {
      const code = (error as any).code;
      // Zaten kayıtlı e-posta: nötr yanıt (hesap varlığı sızdırılmaz).
      if (code === "user_already_exists" || /already registered/i.test(error.message || "")) {
        return Response.json({ ok: true, needs_confirmation: true });
      }
      await logAppEvent(classifyAuthError(error), "/api/bireysel-kayit", error.status ?? null, { code: code ?? null });
      return Response.json({ error: signupErrorMessage(error) }, { status: error.status && error.status >= 500 ? 502 : error.status === 429 ? 429 : 400 });
    }

    // Doğrulanmış bir e-posta için Auth e-posta göndermez ve "identities" boş
    // döner; yanıt yine aynıdır (hesap varlığı sızdırılmaz).

    // Auth'ta "Confirm email" kapalıysa signUp oturum döndürür; bu, e-posta
    // sahipliği kanıtlanmadan hesabın doğrulanmış sayılması demektir.
    // Oturum istemciye verilmez ve durum sunucu günlüğüne yazılır.
    if (data.session) {
      console.error("[otoiz] Supabase Auth 'Confirm email' KAPALI: kayıt e-posta doğrulaması olmadan tamamlandı.");
    }

    return Response.json({ ok: true, needs_confirmation: true });
  } catch (e: any) {
    return Response.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

export const POST = withApiLog("/api/bireysel-kayit", handlePOST);
