"use strict";

// OTOİZ — "Görüş Bildir" (pilot bloker fix paketi). Kullanıcı görüşü artık
// public.pilot_feedback tablosuna yazılır; durum (yeni/inceleniyor/cozuldu)
// ve opsiyonel ekran görüntüsü destekler. Eski kategori anahtarları
// (oneri/sorun/soru) yeni sete BENZERSIZ değildir; normalizeFeedback yalnız
// yeni anahtarları kabul eder. Eski audit_log kayıtları dokunulmadan kalır
// ve yönetim > İşlem Kaydı > "Görüş bildirildi" filtresinde görünür.

const FEEDBACK_CATEGORIES = [
  { key: "hata", label: "Hata" },
  { key: "istek", label: "İstek" },
  { key: "kullanim_zorlugu", label: "Kullanım Zorluğu" },
  { key: "diger", label: "Diğer" },
];

// Eski anahtar → yeni anahtar (yalnızca gösterim/filtre eşlemesi; yazma
// tarafında kullanılmaz).
const FEEDBACK_CATEGORY_LEGACY_MAP = {
  oneri: "istek",
  sorun: "hata",
  soru: "diger",
  diger: "diger",
};

const FEEDBACK_SCREENS = [
  { key: "ana_ekran", label: "Ana ekran" },
  { key: "arac_detay", label: "Araç detayı" },
  { key: "arac_ekle", label: "Araç ekle / düzenle" },
  { key: "qr", label: "QR / anahtarlık" },
  { key: "giris", label: "Giriş / kayıt / şifre" },
  { key: "diger", label: "Diğer" },
];

const FEEDBACK_STATUSES = ["yeni", "inceleniyor", "cozuldu"];
const FEEDBACK_STATUS_LABELS = { yeni: "Yeni", inceleniyor: "İnceleniyor", cozuldu: "Çözüldü" };

// Ekran görüntüsü doğrulaması: yalnız jpeg/png/webp, 10 MB.
const FEEDBACK_SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;
const FEEDBACK_SCREENSHOT_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateFeedbackScreenshot(input) {
  const type = input && input.type;
  const size = input && input.size;
  if (!type || !FEEDBACK_SCREENSHOT_MIME.has(type)) {
    return "Yalnızca JPEG, PNG veya WebP yükleyebilirsiniz.";
  }
  if (typeof size !== "number" || size <= 0 || size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
    return "Görsel en fazla 10 MB olabilir.";
  }
  return null;
}

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
  // screenshot_path: "<user_id>/<dosya>" biçiminde, üst dizin kaçışı yok.
  let screenshot_path = null;
  if (typeof o.screenshot_path === "string" && o.screenshot_path.length > 0) {
    const p = o.screenshot_path.replace(/\\/g, "/");
    if (/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/.test(p) && !p.includes("..")) {
      screenshot_path = p;
    } else {
      errors.screenshot = "Görsel yolu geçersiz.";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors, value: { category, screen, message, screenshot_path } };
}

function feedbackLabel(key, list) {
  const hit = (list || []).find((x) => x.key === key);
  if (hit) return hit.label;
  // Eski anahtarlar yeni etiketlere map edilir (örn. "sorun" → "Hata").
  const mapped = FEEDBACK_CATEGORY_LEGACY_MAP[key];
  if (mapped) {
    const m = FEEDBACK_CATEGORIES.find((c) => c.key === mapped);
    if (m) return m.label;
  }
  return "";
}

module.exports = {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SCREENS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_CATEGORY_LEGACY_MAP,
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_SCREENSHOT_MIME,
  validateFeedbackScreenshot,
  MESSAGE_MIN,
  MESSAGE_MAX,
  normalizeFeedback,
  feedbackLabel,
};
