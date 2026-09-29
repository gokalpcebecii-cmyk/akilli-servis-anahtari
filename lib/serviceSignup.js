"use strict";

// OTOİZ P0 — servis (işletme) kaydı saf yardımcıları (unit testli).
//
// Akış: kayıt talebi → e-posta doğrulama → şifre belirleme + başvuru →
// OTOİZ onayı → servis hesabı aktif.
// Kayıt formunda şifre ALINMAZ. Hesap, kimsenin bilmediği rastgele bir
// şifreyle açılır; şifreyi yalnız e-posta kutusunun sahibi, doğrulama
// bağlantısıyla gelen oturumda belirler. Böylece başkasının e-postasıyla
// önceden kayıt açan biri, e-posta doğrulandıktan sonra o hesaba kendi
// şifresiyle giremez.
const { randomBytes } = require("crypto");

const SERVICE_COMPLETE_PATH = "/panel/kayit/tamamla";

function slugifyBusiness(text, suffix) {
  const trMap = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  let result = String(text || "").split("").map((c) => trMap[c] || c).join("");
  result = result.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  const s = suffix || randomBytes(3).toString("hex");
  return `${result || "servis"}-${s}`;
}

function cleanText(v, max) {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

// Başvuru alanlarını doğrular; hata varsa Türkçe metin döner.
function validateServiceFields(body) {
  const business_name = cleanText(body && body.business_name, 120);
  const phone = cleanText(body && body.phone, 40);
  const address = cleanText(body && body.address, 300);
  if (business_name.length < 2) return { error: "İşletme adı zorunlu." };
  if (phone && !/^[0-9+()\s-]{7,40}$/.test(phone)) return { error: "Telefon numarası geçersiz." };
  return { value: { business_name, phone, address } };
}

// Kayıt formunda şifre alınmadığı için Auth'a verilen, kimsenin bilmediği şifre.
function unguessablePassword() {
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}

// submit_service_application() kodlarının kullanıcıya gösterilecek metni.
function applicationMessage(code) {
  switch (code) {
    case "submitted":
      return "Başvurunuz alındı. OTOİZ onayından sonra araç ve bakım kaydı yapabilirsiniz.";
    case "already_applied":
      return "Bu hesabın işletme başvurusu zaten var.";
    case "email_not_confirmed":
      return "Önce e-posta adresinizi doğrulayın.";
    case "individual_account":
      return "Bu e-posta bir bireysel araç sahibi hesabına ait. İşletme için farklı bir e-posta kullanın.";
    case "invalid_business_name":
      return "İşletme adı geçersiz.";
    case "invalid_contact":
      return "Telefon veya adres çok uzun.";
    default:
      return "Başvuru kaydedilemedi. Lütfen tekrar deneyin.";
  }
}

module.exports = { SERVICE_COMPLETE_PATH, slugifyBusiness, validateServiceFields, unguessablePassword, applicationMessage };
