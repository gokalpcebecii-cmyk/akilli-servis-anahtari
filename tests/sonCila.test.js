"use strict";
// Pilot öncesi son cila: Görüş Bildir doğrulaması + kapalı tasarım token'ları.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeFeedback, feedbackLabel, FEEDBACK_CATEGORIES, FEEDBACK_SCREENS, MESSAGE_MAX } = require("../lib/feedback");
const { LIMITS } = require("../lib/rateLimitCore");

test("görüş: geçerli girdi normalize edilir", () => {
  const r = normalizeFeedback({ category: "sorun", screen: "arac_detay", message: "  Kayıt\r\nbutonu çalışmıyor \u0007 " });
  assert.equal(r.valid, true);
  assert.deepEqual(r.value, { category: "sorun", screen: "arac_detay", message: "Kayıt\nbutonu çalışmıyor" });
});

test("görüş: konu zorunlu, mesaj en az 5 karakter", () => {
  const r = normalizeFeedback({ category: "x", message: "abc" });
  assert.equal(r.valid, false);
  assert.ok(r.errors.category);
  assert.ok(r.errors.message);
});

test("görüş: uzun mesaj reddedilir, bilinmeyen ekran 'diger' olur", () => {
  const r = normalizeFeedback({ category: "oneri", screen: "hack", message: "a".repeat(MESSAGE_MAX + 1) });
  assert.equal(r.valid, false);
  assert.match(r.errors.message, /En fazla/);
  assert.equal(r.value.screen, "diger");
  assert.equal(normalizeFeedback(null).valid, false);
});

test("görüş: etiketler ve hız sınırı", () => {
  assert.equal(feedbackLabel("soru", FEEDBACK_CATEGORIES), "Soru");
  assert.equal(feedbackLabel("yok", FEEDBACK_SCREENS), "");
  assert.deepEqual(LIMITS.feedbackUserHour, { windowSeconds: 3600, max: 5 });
});

test("kapalı tasarım: token'lar talimattaki hex kodlarla aynı", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "theme.ts"), "utf8");
  for (const hex of ["#0F1115", "#151922", "#181D27", "#1F2531", "#2D3542", "#F5F7FA", "#A9B3C1", "#7F8896", "#22C55E", "#86EFAC", "#F5C451", "#EF5350", "#60A5FA", "#8B95A7"]) {
    assert.ok(src.includes(hex), hex + " eksik");
  }
  assert.match(src, /minHeight: 52/);
  assert.match(src, /lg: 18/);
  assert.match(src, /md: 14/);
});
