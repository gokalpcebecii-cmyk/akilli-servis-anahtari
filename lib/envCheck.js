"use strict";

// OTOİZ 04A-S — Vercel build'i başlamadan önce çalışan, Production/staging
// environment karışmasını engelleyen fail-closed doğrulama.
//
// Bu dosya SAF, test edilebilir bir fonksiyon dışa aktarır — process.env'i
// OKUR ama process.exit()/console.* ÇAĞIRMAZ (o kısım scripts/verify-deploy-env.js
// CLI sarmalayıcısındadır). Hiçbir anahtar/secret DEĞERİ döndürülen
// nesnede veya hata mesajlarında görünmez — yalnızca isim, karşılaştırma
// sonucu ve (JWT ise) gömülü proje ref'i gibi güvenli meta bilgiler.

const STAGING_REF = "ctltjunojlaanzurxpzy";
const PRODUCTION_REF = "sbfsiwqxbsojcxdutnem";

const REQUIRED_VARS = [
  "OTOIZ_DEPLOYMENT_ROLE",
  "OTOIZ_EXPECTED_SUPABASE_REF",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];

const PLACEHOLDER_MARKERS = [
  "changeme",
  "change-me",
  "your-",
  "example",
  "placeholder",
  "todo",
  "xxxx",
  "fake",
  "dummy",
  "insert-",
  "replace-",
  "unavailable-in-this-session",
  "not-set",
  "<",
  ">",
];

const MIN_CRON_SECRET_LENGTH = 16;

function isPlaceholder(value) {
  if (typeof value !== "string") return true;
  const v = value.trim();
  if (v.length === 0) return true;
  const lower = v.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

// Yalnızca eski (legacy) JWT biçimi Supabase anahtarları için: 3 nokta ile
// ayrılmış base64url parça, ikinci parça { ref, role, ... } JSON'u taşır.
// Yeni opaque anahtar biçiminde (sb_publishable_/sb_secret_...) bu fonksiyon
// null döner — İÇERİK ASLA YAZDIRILMAZ, yalnızca "ref" alanı okunur.
function decodeJwtRef(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

function isLikelyValidKeyFormat(value) {
  if (isPlaceholder(value)) return false;
  const v = value.trim();
  const isJwtShaped = v.split(".").length === 3 && v.startsWith("eyJ");
  const isOpaqueShaped = /^sb_(publishable|secret)_[A-Za-z0-9_-]{10,}$/.test(v);
  // Bilinmeyen ama makul uzunlukta bir anahtar biçimini de (gelecekteki
  // Supabase anahtar formatları için) tamamen reddetmiyoruz — yalnızca
  // açıkça placeholder/sahte olanları eliyoruz.
  return isJwtShaped || isOpaqueShaped || v.length >= 20;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ ok: boolean, testMode: boolean, errors: string[], notices: string[] }}
 */
function validateDeploymentEnv(env) {
  env = env || {};
  const notices = [];
  const errors = [];

  const vercelDetected = env.VERCEL === "1";
  const testModeRequested = env.OTOIZ_ENV_CHECK_TEST_MODE === "1";

  if (testModeRequested && vercelDetected) {
    notices.push(
      "OTOIZ_ENV_CHECK_TEST_MODE Vercel ortamında (VERCEL=1) tespit edildi ve YOK SAYILDI — bypass denemesi reddedildi, tam doğrulama çalışıyor."
    );
  }

  const testModeActive = testModeRequested && !vercelDetected;
  if (testModeActive) {
    notices.push("Test modu aktif (yalnızca yerel, VERCEL algılanmadı) — rol/ref/URL/anahtar doğrulaması atlandı.");
    return { ok: true, testMode: true, errors: [], notices };
  }

  for (const name of REQUIRED_VARS) {
    if (!env[name] || String(env[name]).trim().length === 0) {
      errors.push(`${name} tanımlı değil veya boş.`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, testMode: false, errors, notices };
  }

  const role = env.OTOIZ_DEPLOYMENT_ROLE;
  const expectedRef = env.OTOIZ_EXPECTED_SUPABASE_REF.trim();
  const supabaseUrlRaw = env.NEXT_PUBLIC_SUPABASE_URL.trim();

  let targetRef;
  if (role === "staging") {
    targetRef = STAGING_REF;
  } else if (role === "production") {
    targetRef = PRODUCTION_REF;
  } else {
    errors.push(`OTOIZ_DEPLOYMENT_ROLE bilinmiyor veya eksik: "${role}" (beklenen: "staging" | "production").`);
    return { ok: false, testMode: false, errors, notices };
  }

  if (expectedRef !== targetRef) {
    errors.push(`OTOIZ_EXPECTED_SUPABASE_REF ("${expectedRef}") rol "${role}" için beklenen ref ("${targetRef}") ile eşleşmiyor.`);
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(supabaseUrlRaw);
  } catch {
    errors.push("NEXT_PUBLIC_SUPABASE_URL geçerli bir URL değil.");
  }

  if (parsedUrl) {
    if (parsedUrl.protocol !== "https:") {
      errors.push(`NEXT_PUBLIC_SUPABASE_URL https:// kullanmalı, "${parsedUrl.protocol}" bulundu.`);
    }
    const expectedHost = `${targetRef}.supabase.co`;
    if (parsedUrl.hostname !== expectedHost) {
      errors.push(`NEXT_PUBLIC_SUPABASE_URL hostu ("${parsedUrl.hostname}") beklenen ("${expectedHost}") ile eşleşmiyor.`);
    }
  }

  const otherRef = role === "staging" ? PRODUCTION_REF : STAGING_REF;
  if (supabaseUrlRaw.includes(otherRef)) {
    errors.push(
      `NEXT_PUBLIC_SUPABASE_URL içinde "${role === "staging" ? "Production" : "staging"}" ref'i (${otherRef}) tespit edildi — "${role}" build'inde bu YASAK.`
    );
  }

  for (const keyName of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const value = env[keyName];
    if (isPlaceholder(value)) {
      errors.push(`${keyName} bir placeholder/sahte değer gibi görünüyor (içerik güvenlik nedeniyle yazdırılmıyor).`);
      continue;
    }
    if (!isLikelyValidKeyFormat(value)) {
      errors.push(`${keyName} tanınan bir Supabase anahtar biçimine (legacy JWT veya opaque sb_*) uymuyor.`);
    }
    const embeddedRef = decodeJwtRef(value);
    if (embeddedRef !== null && embeddedRef !== targetRef) {
      errors.push(`${keyName} içine gömülü proje ref'i beklenen ref ("${targetRef}") ile eşleşmiyor.`);
    }
  }

  if (isPlaceholder(env.CRON_SECRET)) {
    errors.push("CRON_SECRET bir placeholder/sahte değer gibi görünüyor (içerik güvenlik nedeniyle yazdırılmıyor).");
  } else if (env.CRON_SECRET.trim().length < MIN_CRON_SECRET_LENGTH) {
    errors.push(`CRON_SECRET en az ${MIN_CRON_SECRET_LENGTH} karakter olmalı.`);
  }

  return { ok: errors.length === 0, testMode: false, errors, notices };
}

module.exports = {
  STAGING_REF,
  PRODUCTION_REF,
  REQUIRED_VARS,
  validateDeploymentEnv,
};
