"use strict";

// OTOİZ P1 — Sistem Sağlığı olayları için saf yardımcılar (unit testli).
// Olaylar public.app_events tablosuna yalnız sunucudan (service_role) yazılır.
// KİŞİSEL VERİ YAZILMAZ: e-posta, IP, plaka, token, kod yok; yalnız tür,
// rota, HTTP durumu ve kısa teknik kod.

const EVENT_KINDS = new Set([
  "api_5xx",
  "resolver_error",
  "resolver_rate_limited",
  "rate_limited",
  "auth_error",
  "login_failed",
  "signup_error",
  "email_send_error",
]);

// İstemcinin bildirebileceği olaylar (/api/olay). Sunucu hatası gibi
// "kritik" türler istemciden gelemez (sahte alarm üretilemesin).
const CLIENT_EVENT_KINDS = new Set(["login_failed", "auth_error"]);
const CLIENT_AREAS = new Set(["bireysel", "servis", "yonetim", "sifre", "mfa"]);

function safeRoute(route) {
  return String(route || "").replace(/[^A-Za-z0-9/_\-[\]]/g, "").slice(0, 80) || null;
}

// Hata nesnesinden yalnız kısa teknik kod (mesaj metni kişisel veri içerebilir).
function safeCode(err) {
  const c = err && (err.code || err.name);
  return typeof c === "string" ? c.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 60) : null;
}

// Supabase Auth signUp/resend hatası: e-posta gönderilemediyse ayrı sayılır.
function classifyAuthError(err) {
  if (!err) return null;
  const status = Number(err.status) || 0;
  const text = `${err.code || ""} ${err.message || ""}`;
  if (status === 429 || /rate_limit/i.test(text)) return "rate_limited";
  if (/sending|smtp|confirmation email|magic link email|email_send/i.test(text)) return "email_send_error";
  return "signup_error";
}

module.exports = { EVENT_KINDS, CLIENT_EVENT_KINDS, CLIENT_AREAS, safeRoute, safeCode, classifyAuthError };
