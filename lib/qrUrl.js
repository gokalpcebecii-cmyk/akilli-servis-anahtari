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
// Tanımlı değilse (yerel geliştirme, henüz ayarlanmamış staging) eski
// davranış korunur: <sayfanın origin'i>/p/<kod>. Production build'i bu
// değişken olmadan başlamaz (lib/envCheck.js).

const QR_TOKEN_RE = /^[abcdefghjkmnpqrstuvwxyz23456789]{26}$/;

function isQrToken(value) {
  return typeof value === "string" && QR_TOKEN_RE.test(value);
}

function qrBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_QR_BASE_URL;
  return typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
}

// Basılacak / QR görüntüsüne çevrilecek adres. Yalnız 26 karakterlik güncel
// format resolver'dan geçer; eski kısa kodlar (hepsi iptal edilmiş olmalı)
// yalnız eski /p/ adresiyle gösterilir.
function buildQrUrl(code, fallbackOrigin) {
  const base = qrBaseUrl();
  if (base && isQrToken(code)) return `${base}/${code}`;
  const origin = String(fallbackOrigin || "").replace(/\/+$/, "");
  return `${origin}/p/${code}`;
}

// Kalıcı resolver adresi tanımlı mı? (Baskı ekranlarında uyarı göstermek için.)
function hasPermanentQrBase() {
  return qrBaseUrl().length > 0;
}

module.exports = { QR_TOKEN_RE, isQrToken, qrBaseUrl, buildQrUrl, hasPermanentQrBase };
