"use strict";

// OTOİZ P0 — hız sınırı (rate limit) saf yardımcıları (unit testli).
// Sayaç veritabanında tutulur (public.rate_limit_hit, yalnız service_role).
// Anahtarda ham IP / e-posta saklanmaz; sha256 özeti kullanılır.
const { createHash } = require("crypto");

// Vercel, istemci IP'sini x-forwarded-for'un ilk öğesine kendisi yazar
// (istemcinin gönderdiği değer üzerine yazılır). x-real-ip yedektir.
function clientIp(headers) {
  const get = (k) => (headers && typeof headers.get === "function" ? headers.get(k) : null) || "";
  const first = get("x-forwarded-for").split(",")[0].trim();
  const ip = first || get("x-real-ip").trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}

function rateKey(scope, value) {
  const v = String(value || "").trim().toLowerCase();
  return `${scope}:${createHash("sha256").update(v).digest("hex").slice(0, 40)}`;
}

// Uç nokta başına sınırlar. Supabase Auth ayrıca e-posta başına 60 sn ve
// saatlik gönderim sınırı uygular; bunlar onun ÜSTÜNE eklenir.
const LIMITS = {
  signupIp10m: { windowSeconds: 600, max: 5 },
  signupIpDay: { windowSeconds: 86400, max: 20 },
  signupEmailHour: { windowSeconds: 3600, max: 3 },
  resendIpHour: { windowSeconds: 3600, max: 10 },
  resendEmailHour: { windowSeconds: 3600, max: 3 },
  applicationUserHour: { windowSeconds: 3600, max: 5 },
};

const RATE_LIMIT_MESSAGE = "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.";

module.exports = { clientIp, rateKey, LIMITS, RATE_LIMIT_MESSAGE };
