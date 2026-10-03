"use strict";
// Hızlı İşlem Alanı: bakım işlem listesi, bakım kaydı doğrulaması (bugün /
// geçmiş tarih), sonraki bakım önerisi, mevcut planın korunması, belge
// dosyası kontrolü.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  OWNER_ACTION_KEYS,
  DOC_TYPES,
  checkDocumentFile,
  documentPath,
  fmtSize,
  validateMaintenanceAction,
  nextServiceSuggestion,
  visitNextValues,
} = require("../lib/quickActions");
const { CHIP_LABELS, ITEM_LABELS } = require("../lib/maintenanceItems");

const TODAY = "2026-09-30";

test("bakım işlemleri brifteki sırayla, hepsi mevcut DB anahtarı", () => {
  assert.deepEqual(
    OWNER_ACTION_KEYS.map((k) => CHIP_LABELS[k]),
    ["Motor Yağı", "Yağ Filtresi", "Hava Filtresi", "Polen Filtresi", "Yakıt Filtresi", "Fren Balatası", "Fren Diski", "Akü", "Antifriz", "Şanzıman Yağı", "Buji", "Triger", "Lastik"]
  );
  const mig = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260929125118_asama_e_timeline.sql"), "utf8");
  for (const k of OWNER_ACTION_KEYS) {
    assert.ok(ITEM_LABELS[k], k);
    assert.ok(mig.includes(`'${k}'`), `${k} item_key_check içinde`);
  }
});

test("belge tipleri brifteki 6 seçenek", () => {
  assert.deepEqual(DOC_TYPES.map((t) => t.label), ["Fatura", "Servis Fişi", "Muayene Belgesi", "Sigorta Belgesi", "Kasko Belgesi", "Diğer"]);
  const mig = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260930142256_vehicle_documents.sql"), "utf8");
  for (const t of DOC_TYPES) assert.ok(mig.includes(`'${t.key}'`), t.key);
});

test("bugün tarihli bakım: km kayıtlı km'den düşük olamaz, işlem zorunlu", () => {
  const ctx = { today: TODAY, currentKm: 84200 };
  assert.equal(validateMaintenanceAction({ date: TODAY, km: "", items: ["motor_yagi"] }, ctx).field, "km");
  assert.match(validateMaintenanceAction({ date: TODAY, km: "84000", items: ["motor_yagi"] }, ctx).message, /84\.200 km/);
  assert.equal(validateMaintenanceAction({ date: TODAY, km: "84200", items: [] }, ctx).field, "items");
  assert.equal(validateMaintenanceAction({ date: TODAY, km: "84200", items: ["motor_yagi"] }, ctx), null);
  assert.equal(validateMaintenanceAction({ date: TODAY, km: "85000", items: [], otherOn: true, otherText: "Klima gazı" }, ctx), null);
});

test("geçmiş tarihli bakım: Bireysel Geçmiş Kaydı kuralı (km güncelden büyük olamaz, ileri tarih yok)", () => {
  const ctx = { today: TODAY, currentKm: 84200 };
  assert.equal(validateMaintenanceAction({ date: "2026-05-01", km: "90000", items: ["aku"] }, ctx).field, "km");
  assert.equal(validateMaintenanceAction({ date: "2026-10-05", km: "80000", items: ["aku"] }, ctx).field, "date");
  assert.equal(validateMaintenanceAction({ date: "", km: "80000", items: ["aku"] }, ctx).field, "date");
  assert.equal(validateMaintenanceAction({ date: "2026-05-01", km: "80000", items: ["aku"] }, ctx), null);
});

test("sonraki bakım önerisi yalnız periyodik işlemde; kısa periyot kazanır", () => {
  assert.equal(nextServiceSuggestion({ items: ["aku", "lastik"], km: 84200, today: TODAY }), null);
  const s = nextServiceSuggestion({ items: ["motor_yagi"], km: 84200, today: TODAY });
  assert.equal(s.nextServiceKm, 94200);
  assert.equal(s.nextServiceDate, "2027-09-30");
  const s2 = nextServiceSuggestion({ items: ["motor_yagi"], km: 84200, today: TODAY, intervalFor: () => 7500 });
  assert.equal(s2.nextServiceKm, 91700);
});

test("periyodik işlem yoksa mevcut plan korunur (geçersiz kısım sonradan geri yazılır)", () => {
  const sug = { nextServiceKm: 94200, nextServiceDate: "2027-09-30" };
  assert.deepEqual(visitNextValues({ suggestion: sug, km: 84200, today: TODAY }), { rpc: { km: 94200, date: "2027-09-30" }, restore: null });
  assert.deepEqual(visitNextValues({ suggestion: null, km: 84200, today: TODAY, existingKm: 90000, existingDate: "2027-01-01" }), { rpc: { km: 90000, date: "2027-01-01" }, restore: null });
  assert.deepEqual(visitNextValues({ suggestion: null, km: 84200, today: TODAY, existingKm: null, existingDate: null }), { rpc: { km: null, date: null }, restore: null });
  const r = visitNextValues({ suggestion: null, km: 84200, today: TODAY, existingKm: 80000, existingDate: "2026-06-01" });
  assert.deepEqual(r.rpc, { km: null, date: null });
  assert.deepEqual(r.restore, { next_service_km: 80000, next_service_date: "2026-06-01" });
});

test("belge dosyası: PDF/fotoğraf, en fazla 10 MB, uzantıdan tür, güvenli yol", () => {
  assert.equal(checkDocumentFile(null).ok, false);
  assert.deepEqual(checkDocumentFile({ name: "fatura.pdf", type: "application/pdf", size: 1000 }), { ok: true, mime: "application/pdf", ext: "pdf", size: 1000 });
  assert.equal(checkDocumentFile({ name: "IMG_1.HEIC", type: "", size: 5 }).mime, "image/heic");
  assert.equal(checkDocumentFile({ name: "foto", type: "image/jpeg", size: 5 }).ext, "jpg");
  assert.equal(checkDocumentFile({ name: "a.jpg", type: "image/jpg", size: 5 }).mime, "image/jpeg");
  assert.equal(checkDocumentFile({ name: "virus.exe", type: "application/x-msdownload", size: 5 }).ok, false);
  assert.equal(checkDocumentFile({ name: "a.svg", type: "image/svg+xml", size: 5 }).ok, false);
  assert.equal(checkDocumentFile({ name: "a.pdf", type: "application/pdf", size: 0 }).ok, false);
  assert.match(checkDocumentFile({ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }).error, /10 MB/);
  assert.equal(documentPath("v1", "r1", "pdf"), "v1/r1.pdf");
  assert.equal(fmtSize(2048), "2 KB");
  assert.equal(fmtSize(3.5 * 1024 * 1024), "3,5 MB");
});

test("araç ekranı: tek Hızlı İşlemler kartı, eski 4 düğmeli dağınık alan yok", () => {
  const page = fs.readFileSync(path.join(__dirname, "../app/bireysel/araclar/[id]/page.tsx"), "utf8");
  const hub = fs.readFileSync(path.join(__dirname, "../components/QuickActionHub.tsx"), "utf8");
  assert.ok(!page.includes("function QuickActions("));
  assert.equal((page.match(/<QuickActionCard /g) || []).length, 2); // telefon + geniş ekran yerleşimi (yalnız biri görünür)
  for (const t of ["Hızlı İşlemler", "Bakım, kilometre, belge ve önemli tarihleri buradan kolayca yönetin.", "İşlem Ekle", "Ne eklemek istiyorsunuz?", "Bakım Kaydını Ekle", "Kilometreyi Güncelle", "Belgeyi Ekle", "Tarihleri Kaydet", "Bakım kaydı eklendi.", "Kilometre güncellendi.", "Belge eklendi.", "Tarihler güncellendi.", "Son 12 aya ait bir işlem eklemek ister misiniz?", "Geçmiş İşlem Ekle"]) {
    assert.ok(hub.includes(t), t);
  }
});
