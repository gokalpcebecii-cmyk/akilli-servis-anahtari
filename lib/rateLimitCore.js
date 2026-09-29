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
  // P1 — merkezi sınırlar (hepsi aynı veritabanı sayacını kullanır)
  // QR okutma: yalnız sistemde OLMAYAN kodlar sayılır (tahmin/tarama girişimi);
  // gerçek anahtarlık okutmaları hiç sınırlanmaz ve veritabanına yazmaz.
  resolverMissIp10m: { windowSeconds: 600, max: 30 },
  // İstemci olay bildirimi (/api/olay): Sistem Sağlığı sayaçlarını şişirmesin.
  clientEventIp10m: { windowSeconds: 600, max: 30 },
  // Yönetici parti/QR üretimi: MFA'ya ek olarak saatlik üst sınır.
  adminBatchHour: { windowSeconds: 3600, max: 20 },
  // Araç sahibi anahtarlık işlemleri, QR eşleştirme, araç oluşturma.
  userWriteMinute: { windowSeconds: 60, max: 30 },
  // İleride belge yükleme: kullanıcı başına günlük adet (kota ayrıca MB ile).
  documentUploadUserDay: { windowSeconds: 86400, max: 30 },
  // Görüş bildir: kullanıcı başına saatte 5 ileti.
  feedbackUserHour: { windowSeconds: 3600, max: 5 },
};

// Tarayıcıdan doğrudan Supabase Auth'a giden akışlar (giriş, şifre sıfırlama,
// yeni doğrulama e-postası isteği) sunucumuzdan geçmez; onları Supabase Auth'un
// kendi IP başına sınırları korur. Bu tablo raporda ve Sistem Sağlığı
// açıklamasında kullanılır.
const AUTH_BUILTIN_LIMITS = {
  login: "Supabase Auth: IP başına giriş/token isteği sınırı (proje ayarı, varsayılan 5 dakikada 30)",
  passwordReset: "Supabase Auth: e-posta başına 60 sn + saatlik e-posta gönderim sınırı",
};

const RATE_LIMIT_MESSAGE = "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.";

module.exports = { clientIp, rateKey, LIMITS, AUTH_BUILTIN_LIMITS, RATE_LIMIT_MESSAGE };
