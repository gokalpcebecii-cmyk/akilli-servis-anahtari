"use strict";

// OTOİZ Faz 3.1 — bireysel kayıtta gerçek e-posta doğrulaması.
//
// Doğrulama tamamen Supabase Auth'a aittir: kayıt auth.signUp ile yapılır,
// Auth doğrulama e-postası gönderir, kullanıcı bağlantıya basınca Auth
// (/auth/v1/verify) email_confirmed_at'i kendisi yazar. Uygulama hiçbir
// parametreyle hesabı "doğrulanmış" sayamaz; activate_product() da
// auth.users.email_confirmed_at'i sunucu tarafında kontrol eder.
//
// Bu dosya yalnız saf yardımcıları içerir (unit testli).

// Doğrulama bağlantısından sonra dönülecek iç yol (açık yönlendirme yok).
function safeNext(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || /[\r\n]/.test(s) || s.length > 300) return "";
  return s;
}

// Auth'un e-postadaki bağlantıdan sonra yönlendireceği adres.
function confirmRedirectUrl(origin, next) {
  const base = String(origin || "").replace(/\/+$/, "");
  const n = safeNext(next);
  return `${base}/hesap/dogrulandi${n ? `?next=${encodeURIComponent(n)}` : ""}`;
}

// signUp / resend hatalarını kullanıcıya gösterilecek Türkçe metne çevirir.
// Ham teknik metin gösterilmez.
function signupErrorMessage(err) {
  const code = err && (err.code || err.error_code);
  const status = err && err.status;
  if (code === "over_email_send_rate_limit" || status === 429) {
    return "Şu anda çok fazla doğrulama e-postası gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") return "Geçerli bir e-posta adresi girin.";
  if (code === "weak_password") return "Şifre yeterince güçlü değil.";
  if (code === "email_address_not_authorized" || (typeof status === "number" && status >= 500)) {
    return "Doğrulama e-postası şu an gönderilemedi. Lütfen daha sonra tekrar deneyin.";
  }
  return "Hesap oluşturulamadı. Bilgilerinizi kontrol edip tekrar deneyin.";
}

// Doğrulama sonrası dönüş adresinin #hash kısmı: Auth hata ya da başarı bildirir.
function parseConfirmHash(hash) {
  const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (p.get("error") || p.get("error_code")) return { ok: false, error: p.get("error_code") || p.get("error") };
  if (p.get("type") === "signup" || p.get("type") === "email" || p.get("access_token")) return { ok: true };
  return { ok: null };
}

// Şifre sıfırlama e-postasındaki bağlantı: /hesap/sifre-guncelle?token_hash=…&type=recovery
// (Reset password şablonu: {{ .SiteURL }}/hesap/sifre-guncelle?token_hash={{ .TokenHash }}&type=recovery).
// token_hash, PKCE'nin aksine tarayıcıya bağlı değildir: bağlantı başka cihazda
// da açılır ve Auth'un OTP süresi boyunca geçerlidir; tek kullanımlıktır.
function parseRecoveryParams(search) {
  const p = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const tokenHash = p.get("token_hash") || "";
  if (!tokenHash) return null;
  if (p.get("type") !== "recovery" || !/^[A-Za-z0-9_-]{16,128}$/.test(tokenHash)) return { tokenHash: "", invalid: true };
  return { tokenHash, invalid: false };
}

// P0: e-posta doğrulandıktan sonra şifre belirleme sayfası.
// Kayıtta şifre alınmaz (doğrulanmamış hesabın şifresini veritabanı da
// rastgele tutar); şifreyi yalnız doğrulama bağlantısının açtığı oturum
// belirler. Servis kayıtları servis sayfasına, diğerleri bireysel sayfaya.
const INDIVIDUAL_COMPLETE_PATH = "/bireysel/kayit/tamamla";
const SERVICE_COMPLETE_PATH_REF = "/panel/kayit/tamamla";

function completionPathFor(next) {
  const n = safeNext(next);
  if (n.startsWith("/panel")) return SERVICE_COMPLETE_PATH_REF;
  const target = n && !n.startsWith(INDIVIDUAL_COMPLETE_PATH) ? n : "/bireysel/araclar";
  return `${INDIVIDUAL_COMPLETE_PATH}?next=${encodeURIComponent(target)}`;
}

// Doğrulama dönüşündeki oturum, şifre belirleme sayfasına aktarılmalı mı?
// Yalnız kayıt doğrulamasında (şifre sıfırlama / e-posta değişikliği değil).
function shouldForwardToCompletion(hash) {
  const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (!p.get("access_token") || !p.get("refresh_token")) return false;
  const t = p.get("type");
  return !t || t === "signup" || t === "invite" || t === "magiclink";
}

module.exports = {
  safeNext,
  confirmRedirectUrl,
  signupErrorMessage,
  parseConfirmHash,
  parseRecoveryParams,
  INDIVIDUAL_COMPLETE_PATH,
  completionPathFor,
  shouldForwardToCompletion,
};
