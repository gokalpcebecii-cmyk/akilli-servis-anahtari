const test = require("node:test");
const assert = require("node:assert/strict");
const { authorizeCronRequest } = require("../lib/cronAuth");

// Bu testlerin kanıtladığı: /api/reminders'ın ÖNCEKİ hatası olan
// "CRON_SECRET tanımsızken 'Bearer undefined' kabul edilebilir" senaryosu
// artık İMKANSIZ — secret tanımsız/boşken header'la hiç karşılaştırma
// yapılmadan 503 döner.

test("CRON_SECRET tanımsız (undefined) -> 503, hiçbir header ile eşleşme denenmez", () => {
  const result = authorizeCronRequest("Bearer undefined", undefined);
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: "cron_not_configured" });
});

test("REGRESYON: CRON_SECRET tanımsızken istemci tam olarak 'Bearer undefined' gönderse bile KABUL EDİLMEZ", () => {
  // Eski hatalı kod: `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``
  // CRON_SECRET undefined ise bu template literal "Bearer undefined"
  // dizesine eşitti — istemci gerçekten bu diziyi gönderirse eşleşip
  // yetkilendirme BYPASS edilebiliyordu. Düzeltme sonrası: secret boş/
  // tanımsızken header'ın DEĞERİ önemsiz, her zaman reddedilir.
  const result = authorizeCronRequest("Bearer undefined", undefined);
  assert.equal(result.ok, false);
  assert.equal(result.status, 503, "'Bearer undefined' asla 200/401 dışı bir kabul üretmemeli — 503 (yapılandırılmamış) olmalı");
});

test("CRON_SECRET boş string -> 503", () => {
  const result = authorizeCronRequest("Bearer anything", "");
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("CRON_SECRET boşluklardan oluşuyor -> 503 (trim sonrası boş kabul edilir)", () => {
  const result = authorizeCronRequest("Bearer   ", "   ");
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("CRON_SECRET tanımlı, Authorization header eksik -> 401", () => {
  const result = authorizeCronRequest(null, "gercek-cok-gizli-secret-degeri");
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "unauthorized" });
});

test("CRON_SECRET tanımlı, header yanlış -> 401", () => {
  const result = authorizeCronRequest("Bearer yanlis-secret", "gercek-cok-gizli-secret-degeri");
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("CRON_SECRET tanımlı, header doğru -> yetkilendirilir (200)", () => {
  const result = authorizeCronRequest("Bearer gercek-cok-gizli-secret-degeri", "gercek-cok-gizli-secret-degeri");
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.body, null);
});
