"use strict";

// OTOİZ Faz 3 — aktivasyon kodu üretimi. YALNIZ sunucu (API route) kullanır;
// istemci paketine girmesin diye lib/activationCode.js'den ayrıdır.

const { randomInt } = require("crypto");
const { ACTIVATION_ALPHABET, ACTIVATION_CODE_LENGTH } = require("./activationCode");

function generateActivationCode() {
  let out = "";
  for (let i = 0; i < ACTIVATION_CODE_LENGTH; i++) {
    out += ACTIVATION_ALPHABET[randomInt(ACTIVATION_ALPHABET.length)];
  }
  return out;
}

module.exports = { generateActivationCode };
