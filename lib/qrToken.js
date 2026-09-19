const { randomInt } = require("crypto");

// QR/NFC erişim kodları için kullanılan alfabe: karışabilecek karakterler
// (0/O, 1/l/I) bilerek çıkarılmıştır.
const QR_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function generateQrCode(length = 12) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += QR_CODE_ALPHABET[randomInt(QR_CODE_ALPHABET.length)];
  }
  return result;
}

module.exports = { generateQrCode, QR_CODE_ALPHABET };
