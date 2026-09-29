"use strict";

// OTOİZ Aşama E.1: biçimlenen input'larda imleç konumu (unit testli).
// Değişiklik anında imleçten önceki "anlamlı" karakter sayısı saklanır;
// biçimlenmiş yeni değerde imleç aynı sayıda anlamlı karakterin arkasına
// konur. km gibi alanlarda anlamlı karakter yalnız rakamdır.
const ALNUM = /[\p{L}\p{N}]/u;
const DIGITS = /[0-9]/;

function charsFor(kind) {
  return kind === "digits" ? DIGITS : ALNUM;
}

function countSignificant(s, re) {
  let n = 0;
  for (const ch of String(s)) if (re.test(ch)) n++;
  return n;
}

function caretAfterSignificant(value, n, re) {
  if (n <= 0) return 0;
  let seen = 0;
  const v = String(value);
  for (let i = 0; i < v.length; i++) {
    if (re.test(v[i])) {
      seen++;
      if (seen === n) return i + 1;
    }
  }
  return v.length;
}

module.exports = { charsFor, countSignificant, caretAfterSignificant };
