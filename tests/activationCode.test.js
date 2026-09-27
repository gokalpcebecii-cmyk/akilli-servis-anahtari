const test = require("node:test");
const assert = require("node:assert/strict");
const { generateActivationCode } = require("../lib/activationCodeGen");
const {
  normalizeActivationCode,
  isActivationCode,
  formatActivationCode,
  normalizeSerial,
  activationErrorMessage,
  ACTIVATION_ALPHABET,
  ACTIVATION_CODE_LENGTH,
} = require("../lib/activationCode");
const { printCsv, packingCsv, masterCsv } = require("../lib/productExport");

test("aktivasyon kodu: format, alfabe ve en az 59 bit", () => {
  assert.ok(ACTIVATION_CODE_LENGTH * Math.log2(ACTIVATION_ALPHABET.length) >= 59);
  for (const ch of "01OIL") assert.ok(!ACTIVATION_ALPHABET.includes(ch));
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const c = generateActivationCode();
    assert.ok(isActivationCode(c), c);
    seen.add(c);
  }
  assert.equal(seen.size, 5000);
});

test("aktivasyon kodu: kullanıcı girişi normalize edilir", () => {
  const c = generateActivationCode();
  const shown = formatActivationCode(c);
  assert.match(shown, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(normalizeActivationCode(shown.toLowerCase()), c);
  assert.equal(normalizeActivationCode(` ${shown.replace(/-/g, " ")} `), c);
  assert.equal(isActivationCode("ABCD-EFGH-JKMN"), false);
  assert.equal(isActivationCode("ABCDEFGHJKM0"), false);
});

test("seri no normalize", () => {
  assert.equal(normalizeSerial("otz-000123"), "OTZ-000123");
  assert.equal(normalizeSerial("OTZ 000123"), "OTZ-000123");
  assert.equal(normalizeSerial("OTZ000123"), "OTZ-000123");
  assert.equal(normalizeSerial("OTZ-12"), null);
  assert.equal(normalizeSerial("ABC-000123"), null);
});

test("hata mesajları Türkçe ve bilinmeyen kod güvenli", () => {
  assert.match(activationErrorMessage("invalid"), /hatalı/);
  assert.match(activationErrorMessage("zzz"), /tekrar/);
});

test("CSV çıktıları: baskı dosyasında aktivasyon kodu, paketlemede token yok", () => {
  const items = [
    { serial_no: "OTZ-000001", token: "abcdefghjkmnpqrstuvwxyz234", activation_code: "ABCDEFGHJKMN" },
    { serial_no: "OTZ-000002", token: "bcdefghjkmnpqrstuvwxyz2345", activation_code: "BCDEFGHJKMNP" },
  ];
  const url = (t) => `https://go.otoizgo.com/${t}`;
  const p = printCsv(items, url, "Parti 1");
  assert.ok(p.startsWith("﻿"));
  assert.ok(p.includes("https://go.otoizgo.com/abcdefghjkmnpqrstuvwxyz234"));
  assert.ok(!p.includes("ABCD-EFGH-JKMN"));
  const k = packingCsv(items, "Parti 1");
  assert.ok(k.includes("OTZ-000001,ABCD-EFGH-JKMN"));
  assert.ok(!k.includes("abcdefghjkmnpqrstuvwxyz234"));
  const m = masterCsv(items, url, 'Parti "x", 1');
  assert.ok(m.includes('"Parti ""x"", 1"'));
  assert.equal(m.trim().split("\r\n").length, 3);
});
