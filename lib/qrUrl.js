"use strict";

// OTOİZ Aşama 1 — basılı QR içeriğinin TEK kaynağı.
//
// Fiziksel QR'a yalnızca kalıcı resolver adresi yazılır:
//   https://go.<final-domain>/<token>
// Uygulamanın iç route'ları (/p/..., araç ekranları) değişse bile bu adres
// değişmez; resolver token'ın güncel durumuna göre doğru ekrana yönlendirir.
//
// NEXT_PUBLIC_QR_BASE_URL build sırasında istemci paketine gömülür (Next.js
// yalnızca `process.env.NEXT_PUBLIC_...` biçimindeki DOĞRUDAN erişimi gömer).
// Tanımlı değilse uygulama normal çalışır (deploy engellenmez) ama QR
// üretimi ve QR görseli/baskısı KİLİTLİDİR (printableQrUrl → null,
// /api/admin/qr generate → 423).

const QR_TOKEN_RE = /^[abcdefghjkmnpqrstuvwxyz23456789]{26}$/;

function isQrToken(value) {
  return typeof value === "string" && QR_TOKEN_RE.test(value);
}

function qrBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_QR_BASE_URL;
  return typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
}

// Basılacak / QR görüntüsüne çevrilecek adres: YALNIZ kalıcı resolver adresi.
// Kalıcı adres tanımlı değilse (ya da kod eski kısa formattaysa) null döner ve
// çağıran ekran QR GÖRSELİ ÜRETMEZ. Böylece hiçbir ortamda geçici bir
// adresi (vercel.app/p/...) taşıyan fiziksel QR basılamaz.
function printableQrUrl(code) {
  const base = qrBaseUrl();
  if (!base || !isQrToken(code)) return null;
  return `${base}/${code}`;
}

function hasPermanentQrBase() {
  return qrBaseUrl().length > 0;
}

// QR üretimi (batch) ve basımı kilitli mi? Kalıcı adres yoksa kilitli.
function qrIssuanceLocked() {
  return !hasPermanentQrBase();
}

const QR_LOCK_MESSAGE =
  "Kalıcı QR adresi (go.<alan-adı>) bu ortamda tanımlı değil. QR üretimi ve basımı kilitli.";

module.exports = { QR_TOKEN_RE, isQrToken, qrBaseUrl, printableQrUrl, hasPermanentQrBase, qrIssuanceLocked, QR_LOCK_MESSAGE };
