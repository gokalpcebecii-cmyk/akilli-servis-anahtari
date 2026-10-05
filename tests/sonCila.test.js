"use strict";
// Pilot öncesi son cila: Görüş Bildir doğrulaması + kapalı tasarım token'ları.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeFeedback, feedbackLabel, FEEDBACK_CATEGORIES, FEEDBACK_SCREENS, MESSAGE_MAX } = require("../lib/feedback");
const { LIMITS } = require("../lib/rateLimitCore");

test("görüş: geçerli girdi normalize edilir", () => {
  const r = normalizeFeedback({ category: "hata", screen: "arac_detay", message: "  Kayıt\r\nbutonu çalışmıyor \u0007 " });
  assert.equal(r.valid, true);
  assert.deepEqual(r.value, { category: "hata", screen: "arac_detay", message: "Kayıt\nbutonu çalışmıyor", screenshot_path: null });
});

test("görüş: konu zorunlu, mesaj en az 5 karakter", () => {
  const r = normalizeFeedback({ category: "x", message: "abc" });
  assert.equal(r.valid, false);
  assert.ok(r.errors.category);
  assert.ok(r.errors.message);
});

test("görüş: uzun mesaj reddedilir, bilinmeyen ekran 'diger' olur", () => {
  const r = normalizeFeedback({ category: "istek", screen: "hack", message: "a".repeat(MESSAGE_MAX + 1) });
  assert.equal(r.valid, false);
  assert.match(r.errors.message, /En fazla/);
  assert.equal(r.value.screen, "diger");
  assert.equal(normalizeFeedback(null).valid, false);
});

test("görüş: etiketler ve hız sınırı", () => {
  assert.equal(feedbackLabel("soru", FEEDBACK_CATEGORIES), "Diğer");
  assert.equal(feedbackLabel("sorun", FEEDBACK_CATEGORIES), "Hata");
  assert.equal(feedbackLabel("yok", FEEDBACK_SCREENS), "");
  assert.deepEqual(LIMITS.feedbackUserHour, { windowSeconds: 3600, max: 5 });
});

test("kapalı tasarım: token'lar talimattaki hex kodlarla aynı (2026-10-05 premium zemin; Adım 1: mavi yok)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "theme.ts"), "utf8");
  for (const hex of ["#07080A", "#0C0E11", "#111317", "#171A1F", "#24282F", "#F5F7FA", "#A9B3C1", "#7F8896", "#22C55E", "#86EFAC", "#F5C451", "#EF5350", "#C3C9D1", "#8B95A7"]) {
    assert.ok(src.includes(hex), hex + " eksik");
  }
  assert.ok(!/#60A5FA|#3B82F6|#2563EB/i.test(src), "mavi tema kaldırıldı");
  assert.match(src, /minHeight: 52/);
  assert.match(src, /lg: 18/);
  assert.match(src, /md: 14/);
});
