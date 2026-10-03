"use strict";
// Pilot bloker fix paketi — birim/doğrulama testleri.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  validateFeedbackScreenshot,
  normalizeFeedback,
  feedbackLabel,
} = require("../lib/feedback");

test("kategoriler yeni sete dönüştürüldü", () => {
  assert.deepEqual(
    FEEDBACK_CATEGORIES.map((c) => c.key),
    ["hata", "istek", "kullanim_zorlugu", "diger"]
  );
});

test("eski kategori anahtarları yeni etiketle eşleşir", () => {
  assert.equal(feedbackLabel("oneri", FEEDBACK_CATEGORIES), "İstek");
  assert.equal(feedbackLabel("sorun", FEEDBACK_CATEGORIES), "Hata");
  assert.equal(feedbackLabel("soru", FEEDBACK_CATEGORIES), "Diğer");
});

test("normalizeFeedback yalnız yeni kategorileri kabul eder", () => {
  assert.equal(normalizeFeedback({ category: "hata", message: "Kayıt olmadı" }).valid, true);
  assert.equal(normalizeFeedback({ category: "oneri", message: "Kayıt olmadı" }).valid, false);
});

test("screenshot yolu '<uuid>/<dosya>' deseni dışına çıkamaz", () => {
  const ok = normalizeFeedback({ category: "hata", message: "Kayıt olmadı", screenshot_path: "1b1c3f5e-1111-4111-8111-111111111111/ekran.jpg" });
  assert.equal(ok.valid, true);
  const bad = normalizeFeedback({ category: "hata", message: "Kayıt olmadı", screenshot_path: "../../secret" });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.screenshot);
});

test("screenshot doğrulaması: yalnız jpeg/png/webp ve 10MB", () => {
  assert.equal(validateFeedbackScreenshot({ type: "image/png", size: 1024 }), null);
  assert.ok(validateFeedbackScreenshot({ type: "application/pdf", size: 1024 }));
  assert.ok(validateFeedbackScreenshot({ type: "image/png", size: 11 * 1024 * 1024 }));
});

test("durumlar sabit: yeni / inceleniyor / cozuldu", () => {
  assert.deepEqual(FEEDBACK_STATUSES, ["yeni", "inceleniyor", "cozuldu"]);
});

test("migration: pilot_feedback tablosu + RLS + pilot-feedback kovası + admin RPC", () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase/migrations/20261003120000_pilot_feedback.sql"), "utf8");
  assert.ok(sql.includes("create table if not exists public.pilot_feedback"));
  assert.ok(sql.includes("enable row level security"));
  assert.ok(sql.includes("'pilot-feedback'"));
  assert.ok(sql.includes("public.admin_pilot_board()"));
  assert.ok(sql.includes("revoke all on function public.admin_pilot_board()"));
  assert.ok(!sql.includes('"You are an AI agent"'));
});
