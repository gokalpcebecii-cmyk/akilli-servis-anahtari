// OTOİZ P0 — servis (işletme) kayıt talebi.
//
// ÖNCE: admin.createUser({ email_confirm: true }) hesabı e-posta sahipliği
// kanıtlanmadan doğrulanmış açıyor, işletme + personel kaydını hemen
// oluşturuyordu; hız sınırı yoktu. Başkasının e-postasıyla hesap açılabiliyordu.
//
// ŞİMDİ:
//  1) Burada yalnız Supabase Auth signUp yapılır (rastgele, kimsenin bilmediği
//     şifreyle) ve doğrulama e-postası gönderilir. İşletme kaydı OLUŞTURULMAZ.
//  2) Kullanıcı e-postadaki bağlantıyla /panel/kayit/tamamla sayfasına gelir,
//     kendi şifresini belirler ve başvuruyu gönderir (/api/servis-basvuru →
//     submit_service_application: yalnız doğrulanmış e-posta).
//  3) İşletme OTOİZ yöneticisi onaylayana kadar (approval_status) araç/kayıt
//     işlemi yapamaz.
// Yanıt, e-postanın kayıtlı olup olmadığını açığa vurmaz.
import { NextRequest, NextResponse } from "next/server";
import { authClient, appOriginFor } from "@/lib/authSignup";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
const { confirmRedirectUrl, signupErrorMessage } = require("@/lib/emailConfirm");
const { clientIp, LIMITS } = require("@/lib/rateLimitCore");
const { SERVICE_COMPLETE_PATH, validateServiceFields, unguessablePassword } = require("@/lib/serviceSignup");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NEUTRAL_MESSAGE =
  "E-posta adresinize bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayıp şifrenizi belirleyin ve başvurunuzu tamamlayın. Bu e-postayla zaten bir hesabınız varsa giriş yapın.";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  const fields = validateServiceFields(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const ip = clientIp(req.headers);
  if (
    await isRateLimited([
      { scope: "signup-ip-10m", value: ip, ...LIMITS.signupIp10m },
      { scope: "signup-ip-day", value: ip, ...LIMITS.signupIpDay },
      { scope: "signup-email-h", value: email, ...LIMITS.signupEmailHour },
    ])
  ) {
    return rateLimitedResponse();
  }

  try {
    const { data, error } = await authClient().auth.signUp({
      email,
      password: unguessablePassword(),
      options: {
        emailRedirectTo: confirmRedirectUrl(appOriginFor(req), SERVICE_COMPLETE_PATH),
        data: {
          account_type: "service",
          business_name: fields.value.business_name,
          phone: fields.value.phone || null,
          address: fields.value.address || null,
        },
      },
    });

    if (error) {
      const code = (error as any).code;
      if (code === "over_email_send_rate_limit" || error.status === 429) {
        return NextResponse.json({ error: signupErrorMessage(error) }, { status: 429 });
      }
      if (code === "user_already_exists" || /already registered/i.test(error.message || "")) {
        return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
      }
      return NextResponse.json({ error: signupErrorMessage(error) }, { status: error.status && error.status >= 500 ? 502 : 400 });
    }

    if (data.session) {
      console.error("[otoiz] Supabase Auth 'Confirm email' KAPALI: servis kaydı e-posta doğrulaması olmadan açıldı.");
    }

    // Kayıtlı/doğrulanmış e-posta, doğrulanmamış e-posta ve yeni kayıt aynı yanıtı alır.
    return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
  } catch {
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu" }, { status: 500 });
  }
}
