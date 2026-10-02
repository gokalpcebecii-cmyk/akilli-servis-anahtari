"use strict";

// OTOİZ — Alıcı Raporu ("Alıcıya Göster") için saf yardımcılar.
// Token güvenliği, süre kontrolleri ve buyer-safe raporu (allowlist)
// burada üretilir; UI ve server route'ları bu tek kaynağı kullanır.

const { createHash, randomBytes, timingSafeEqual } = require("crypto");

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------
const BUYER_TOKEN_BYTES = 32; // 256 bit CSPRNG
const BUYER_DURATIONS = { "24h": 24, "3d": 72, "7d": 168 };

// Kriptografik güvenli rastgele token (URL-safe base64url). Math.random YOK.
function generateShareToken() {
  return randomBytes(BUYER_TOKEN_BYTES).toString("base64url");
}

// DB'de yalnız sha256 özeti tutulur — ham token verili merkezinde bulunmaz.
function hashShareToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function durationHoursFor(key) {
  return BUYER_DURATIONS[key] || null;
}

// Süre sonu zamanı (ISO) üretir.
function sharesExpireAt(key, now = new Date()) {
  const hours = durationHoursFor(key);
  if (!hours) return null;
  return new Date(now.getTime() + hours * 3600000).toISOString();
}

// Paylaşım halen geçerli mi? revoked VEYA süresi geçmiş ise hayır.
function isShareActive(share, nowMs = Date.now()) {
  if (!share) return false;
  if (share.revoked_at) return false;
  const exp = Date.parse(String(share.expires_at || ""));
  if (!Number.isFinite(exp)) return false;
  return exp > nowMs;
}

function isShareExpired(share, nowMs = Date.now()) {
  if (!share || !share.expires_at) return true;
  return Date.parse(String(share.expires_at)) <= nowMs;
}

// Timing-attack sızıntısı önlemek için hash karşılaştırması sabit zamanlı.
function hashesEqual(a, b) {
  try {
    const x = Buffer.from(String(a || ""), "hex");
    const y = Buffer.from(String(b || ""), "hex");
    return x.length === y.length && timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rapor allowlist'i — buyer'a ASLA çıkmayacak alanlar için allowlist mantığı
// açık tutulur. DB satırı ne kadar zengin olursa olsun yalnız bu alanlar
// rapora girer.
// ---------------------------------------------------------------------------
const ALLOWED_VEHICLE_FIELDS = ["plate", "brand", "model", "year", "current_km", "next_service_km", "next_service_date", "muayene_tarihi", "kasko_bitis", "trafik_sigortasi_bitis", "notes_safe_flag"];
const ALLOWED_RECORD_FIELDS = ["service_date", "km_at_service", "description", "service_verified", "tenant_id_present"];

function safeStr(v, max = 200) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// Kayıttan yalnız alıcı istatistikleri + türetilmiş teknik bilgiler üretir.
// tenant_id'nin kendisi rapora yazılmaz; yalnız servis mi bireysel mi etiketi.
function buildBuyerReport(vehicle, records) {
  const v = vehicle || {};
  const rows = Array.isArray(records) ? records : [];
  const serviceVerified = (r) => r && (r.tenant_id !== null && r.tenant_id !== undefined && r.tenant_id !== "") || r.service_verified === true;

  const chron = rows
    .filter((r) => r && r.service_date)
    .sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)))
    .map((r) => ({
      date: String(r.service_date).slice(0, 10),
      km: r.km_at_service === null || r.km_at_service === undefined ? null : Number(r.km_at_service),
      // Kişisel notlar buyer raporuna dahil edilmez: sadece işlemler kısmı
      // (" — Not: …" sonrası atılır).
      items: safeStr(String(r.description || "").split(" — Not:")[0], 240),
      source: serviceVerified(r) ? "servis" : "bireysel",
    }));

  const servisCount = chron.filter((r) => r.source === "servis").length;
  const bireyselCount = chron.length - servisCount;
  const last = chron[0] || null;

  return {
    vehicle: {
      plate: safeStr(v.plate, 20),
      brand: safeStr(v.brand, 60),
      model: safeStr(v.model, 60),
      year: v.year === null || v.year === undefined ? null : Number(v.year),
      current_km: v.current_km === null || v.current_km === undefined ? null : Number(v.current_km),
      next_service_km: v.next_service_km === null || v.next_service_km === undefined ? null : Number(v.next_service_km),
      next_service_date: v.next_service_date ? String(v.next_service_date).slice(0, 10) : null,
      muayene_tarihi: v.muayene_tarihi ? String(v.muayene_tarihi).slice(0, 10) : null,
      kasko_bitis: v.kasko_bitis ? String(v.kasko_bitis).slice(0, 10) : null,
      trafik_sigortasi_bitis: v.trafik_sigortasi_bitis ? String(v.trafik_sigortasi_bitis).slice(0, 10) : null,
    },
    stats: {
      total: chron.length,
      servis: servisCount,
      bireysel: bireyselCount,
    },
    last,
    chronology: chron,
    passportActive: true,
  };
}

// Kanıt özeti satırı: "27 kayıt · 11 servis doğrulamalı · 16 bireysel kayıt"
function buildProofLine(stats) {
  const s = stats || { total: 0, servis: 0, bireysel: 0 };
  return `${s.total} kayıt · ${s.servis} servis doğrulamalı · ${s.bireysel} bireysel kayıt`;
}

// Email format: basit ve anlamlı (@ bulunmalı, 3+2 karakter).
function isBuyerEmail(v) {
  const s = String(v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;
}

module.exports = {
  BUYER_TOKEN_BYTES,
  BUYER_DURATIONS,
  generateShareToken,
  hashShareToken,
  durationHoursFor,
  sharesExpireAt,
  isShareActive,
  isShareExpired,
  hashesEqual,
  ALLOWED_VEHICLE_FIELDS,
  ALLOWED_RECORD_FIELDS,
  buildBuyerReport,
  buildProofLine,
  safeStr,
  isBuyerEmail,
};
