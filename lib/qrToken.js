const { randomInt } = require("crypto");

// QR/NFC erişim kodları için kullanılan alfabe: karışabilecek karakterler
// (0/O, 1/l/I) bilerek çıkarılmıştır. 31 karakter.
const QR_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// 2026-09-24: canlı pilot öncesi zorunlu kural — QR kodu yalnız sunucuda,
// CSPRNG (crypto.randomInt) ile ve EN AZ 128 bit entropiyle üretilir.
// 26 karakter × log2(31) ≈ 128,8 bit.
const QR_CODE_LENGTH = 26;
const MIN_QR_ENTROPY_BITS = 128;

function qrEntropyBits(length) {
  return length * Math.log2(QR_CODE_ALPHABET.length);
}

function generateQrCode(length = QR_CODE_LENGTH) {
  if (qrEntropyBits(length) < MIN_QR_ENTROPY_BITS) {
    throw new Error(`QR kodu en az ${MIN_QR_ENTROPY_BITS} bit olmalı`);
  }
  let result = "";
  for (let i = 0; i < length; i++) {
    result += QR_CODE_ALPHABET[randomInt(QR_CODE_ALPHABET.length)];
  }
  return result;
}

// Kullanıcının elle girdiği kodu karşılaştırma öncesi normalize eder
// (boşluk, tire ve büyük harf farkları kodu değiştirmez).
function normalizeQrCode(raw) {
  return String(raw ?? "").toLowerCase().replace(/[\s-]+/g, "");
}

module.exports = { generateQrCode, normalizeQrCode, qrEntropyBits, QR_CODE_ALPHABET, QR_CODE_LENGTH, MIN_QR_ENTROPY_BITS };
