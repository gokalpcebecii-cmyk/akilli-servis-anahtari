// OTOİZ Faz 3.1 — bireysel kayıt, gerçek e-posta doğrulamasıyla.
//
// ÖNCE: admin.createUser({ email_confirm: true }) hesabı doğrulanmış
// açıyordu; e-posta sahipliği hiç kanıtlanmıyordu.
// ŞİMDİ: Supabase Auth signUp kullanılır. Auth doğrulama e-postası gönderir;
// kullanıcı bağlantıya basana kadar giriş yapamaz (Auth "email_not_confirmed")
// ve activate_product() onu reddeder. Oturum burada AÇILMAZ.
import { authClient, appOriginFor } from "@/lib/authSignup";
const { validatePassword } = require("@/lib/passwordPolicy");
const { confirmRedirectUrl, signupErrorMessage } = require("@/lib/emailConfirm");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { full_name, phone, password, next } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !password) {
      return Response.json({ error: "E-posta ve şifre zorunlu." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) {
      return Response.json({ error: pwError }, { status: 400 });
    }

    const { data, error } = await authClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: confirmRedirectUrl(appOriginFor(req), next),
        data: { full_name: full_name || null, phone: phone || null, account_type: "individual" },
      },
    });

    if (error) {
      const code = (error as any).code;
      if (code === "user_already_exists" || /already registered/i.test(error.message || "")) {
        return Response.json({ error: "Bu e-posta ile zaten bir hesap var. Giriş yapın." }, { status: 400 });
      }
      return Response.json({ error: signupErrorMessage(error) }, { status: error.status && error.status >= 500 ? 502 : 400 });
    }

    // Doğrulama açıkken zaten kayıtlı ve doğrulanmış bir e-posta için Auth
    // e-posta göndermez ve "identities" boş döner.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return Response.json({ error: "Bu e-posta ile zaten bir hesap var. Giriş yapın." }, { status: 400 });
    }

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
