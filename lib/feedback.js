"use strict";

// OTOİZ — "Görüş Bildir" (pilot öncesi son cila). Kullanıcı görüşü mevcut
// işlem kaydına (audit_log, action = user_feedback) yazılır; yönetici
// "İşlem Kaydı" sekmesinde "Görüş bildirildi" filtresiyle okur. Yeni tablo /
// migration yok. Saf doğrulama burada (unit testli).

const FEEDBACK_CATEGORIES = [
  { key: "oneri", label: "Öneri" },
  { key: "sorun", label: "Sorun / hata" },
  { key: "soru", label: "Soru" },
  { key: "diger", label: "Diğer" },
];

const FEEDBACK_SCREENS = [
  { key: "ana_ekran", label: "Ana ekran" },
  { key: "arac_detay", label: "Araç detayı" },
  { key: "arac_ekle", label: "Araç ekle / düzenle" },
  { key: "qr", label: "QR / anahtarlık" },
  { key: "giris", label: "Giriş / kayıt / şifre" },
  { key: "diger", label: "Diğer" },
];

const MESSAGE_MIN = 5;
const MESSAGE_MAX = 1000;

function normalizeFeedback(input) {
  const o = input && typeof input === "object" ? input : {};
  const errors = {};
  const category = FEEDBACK_CATEGORIES.some((c) => c.key === o.category) ? o.category : null;
  if (!category) errors.category = "Bir konu seçin.";
  const screen = FEEDBACK_SCREENS.some((c) => c.key === o.screen) ? o.screen : "diger";
  // Kontrol karakterleri temizlenir; satır sonları korunur.
  const message = String(o.message ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (message.length < MESSAGE_MIN) errors.message = "Lütfen birkaç kelimeyle yazın.";
  else if (message.length > MESSAGE_MAX) errors.message = `En fazla ${MESSAGE_MAX} karakter yazabilirsiniz.`;
  return { valid: Object.keys(errors).length === 0, errors, value: { category, screen, message } };
}

function feedbackLabel(key, list) {
  const hit = (list || []).find((x) => x.key === key);
  return hit ? hit.label : "";
}

module.exports = { FEEDBACK_CATEGORIES, FEEDBACK_SCREENS, MESSAGE_MIN, MESSAGE_MAX, normalizeFeedback, feedbackLabel };
