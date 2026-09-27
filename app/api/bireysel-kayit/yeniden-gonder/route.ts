// OTOİZ Faz 3.1 — doğrulama e-postasını yeniden gönder.
// Yanıt, e-postanın kayıtlı olup olmadığını açığa vurmaz (hep aynı metin);
// yalnız gönderim sınırı aşıldıysa kullanıcıya beklemesi söylenir. Sınırı
// Supabase Auth uygular (e-posta başına ve saatlik).
import { authClient, appOriginFor } from "@/lib/authSignup";
const { confirmRedirectUrl, signupErrorMessage } = require("@/lib/emailConfirm");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });

  const { error } = await authClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: confirmRedirectUrl(appOriginFor(req), body.next) },
  });
  if (error && ((error as any).code === "over_email_send_rate_limit" || error.status === 429)) {
    return Response.json({ error: signupErrorMessage(error) }, { status: 429 });
  }
  return Response.json({
    ok: true,
    message: "Bu e-postayla doğrulanmamış bir hesap varsa yeni doğrulama bağlantısı gönderildi. Gelen kutunuzu ve gereksiz klasörünü kontrol edin.",
  });
}
