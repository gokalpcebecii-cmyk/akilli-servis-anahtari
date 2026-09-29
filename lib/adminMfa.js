"use strict";

// OTOİZ P0 — yönetici paneli için iki adımlı doğrulama (TOTP) kuralı.
// Unit testli saf yardımcılar; yetki kararı lib/adminAuth.ts'de sunucuda verilir.

// Varsayılan: ZORUNLU. Yalnız acil durumda (ör. doğrulayıcı cihazları
// kaybolduysa) Vercel ortam değişkeni OTOIZ_ADMIN_MFA_ENFORCE=off ile geçici
// olarak kapatılabilir; bu da yeni bir deploy gerektirir ve kayda geçer.
function adminMfaEnforced(env) {
  const v = String((env && env.OTOIZ_ADMIN_MFA_ENFORCE) || "").trim().toLowerCase();
  return !(v === "off" || v === "false" || v === "0");
}

// Access token'daki "aal" (Authenticator Assurance Level) alanı.
// Token'ın imzası ÖNCE Auth sunucusunda (getUser) doğrulanmış olmalıdır;
// bu fonksiyon yalnız doğrulanmış token'ın içeriğini okur.
function tokenAal(bearer) {
  try {
    const token = String(bearer || "").replace(/^Bearer\s+/i, "");
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof json.aal === "string" ? json.aal : null;
  } catch {
    return null;
  }
}

function isSixDigitCode(code) {
  return /^[0-9]{6}$/.test(String(code || "").replace(/\s+/g, ""));
}

module.exports = { adminMfaEnforced, tokenAal, isSixDigitCode };
