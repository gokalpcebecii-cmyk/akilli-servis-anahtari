"use strict";

// OTOİZ Faz 3 — fiziksel ürünün tek kullanımlık aktivasyon kodu.
//
// - Yalnız sunucuda, CSPRNG (crypto.randomInt) ile üretilir
//   (lib/activationCodeGen.js; bu dosya istemci paketine de girer).
// - QR'da YOKTUR; paket/kart içinde ayrıca basılır.
// - Veritabanında yalnız bcrypt özeti saklanır (activate_product /
//   admin_create_product_batch); düz metin yalnız parti üretiminde bir kez
//   döner.
// - 12 karakter × log2(31) ≈ 59,5 bit. Çevrimiçi deneme ürün başına 5
//   hatada 30 dk kilit ve kullanıcı başına saatte 10 hata ile sınırlıdır.
// - Karışabilecek karakterler (0/O, 1/I/L) alfabede yoktur; kullanıcı
//   boşluk, tire ve küçük harfle yazabilir.

const ACTIVATION_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ACTIVATION_CODE_LENGTH = 12;
const ACTIVATION_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

function normalizeActivationCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[\s-]+/g, "");
}

function isActivationCode(value) {
  return typeof value === "string" && ACTIVATION_CODE_RE.test(value);
}

// Kart/pakette gösterim: ABCD-EFGH-JKMN
function formatActivationCode(code) {
  const c = normalizeActivationCode(code);
  return c.match(/.{1,4}/g)?.join("-") ?? "";
}

// Seri no girişini normalize eder: "otz 000123", "OTZ000123" → "OTZ-000123".
function normalizeSerial(raw) {
  const s = String(raw ?? "").toUpperCase().replace(/[\s-]+/g, "");
  const m = /^OTZ(\d{6,})$/.exec(s);
  return m ? `OTZ-${m[1]}` : null;
}

// activate_product() hata kodları → kullanıcıya gösterilecek kısa Türkçe metin.
const ACTIVATION_ERRORS = {
  auth_required: "Devam etmek için giriş yapın.",
  email_not_verified: "Önce e-posta adresinizi doğrulayın. Gelen kutunuzdaki bağlantıya tıklayıp tekrar deneyin.",
  staff_account: "Servis hesabıyla ürün etkinleştirilemez. Kişisel (bireysel) hesabınızla giriş yapın.",
  too_many_attempts: "Çok fazla hatalı deneme yapıldı. Lütfen bir saat sonra tekrar deneyin.",
  invalid: "Aktivasyon kodu hatalı. Kartın üzerindeki kodu kontrol edip tekrar deneyin.",
  locked: "Bu ürün çok fazla hatalı deneme nedeniyle 30 dakika kilitlendi.",
  revoked: "Bu anahtarlık iptal edilmiş, etkinleştirilemez.",
  already_activated: "Bu anahtarlık zaten etkinleştirilmiş.",
  not_activatable: "Bu anahtarlık kodla etkinleştirilemez. Aldığınız yerle iletişime geçin.",
  vehicle_forbidden: "Bu araç size ait değil.",
  vehicle_has_active_qr: "Bu aracın zaten aktif bir anahtarlığı var. Eskisini aracın sayfasından iptal edip tekrar deneyin.",
};

function activationErrorMessage(code) {
  return ACTIVATION_ERRORS[code] || "Etkinleştirme şu an yapılamadı. Lütfen tekrar deneyin.";
}

module.exports = {
  ACTIVATION_ALPHABET,
  ACTIVATION_CODE_LENGTH,
  ACTIVATION_CODE_RE,
  ACTIVATION_ERRORS,
  normalizeActivationCode,
  isActivationCode,
  formatActivationCode,
  normalizeSerial,
  activationErrorMessage,
};
