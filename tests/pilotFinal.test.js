"use strict";

// OTOİZ — Pilot öncesi final kapanış testleri (AG listesinin eksik kalan
// parçaları). Onboarding tek-submit plan hesabı, belge dosya/path güvenliği,
// KM ve tarih doğrulamaları — üretim mantığı değişmeden, aynı kaynak
// modüllerle (lib/history, lib/quickActions, lib/logic).

const test = require("node:test");
const assert = require("node:assert/strict");

const { planFromHistory, validateHistoryEntry, isBlankEntry, emptyEntry, monthsAgoIso, historyDescription } = require("../lib/history");
const { checkDocumentFile, documentPath, validateMaintenanceAction, nextServiceSuggestion } = require("../lib/quickActions");
const { isValidCurrentKmUpdate, todayIsoIstanbul, computeMaintenancePlan } = require("../lib/logic");

// --- ONBOARDING: son bakım biliniyorsa sonraki bakım SON BAKIMDAN hesaplanır
test("onboarding: son bakım tarihinden 12 ay, kilometresinden +10.000 (motor yağı)", () => {
  const plan = planFromHistory(
    [{ date: "2026-04-10", km: "70000", items: ["motor_yagi"], otherOn: false, otherText: "", note: "" }],
    { existingLatestDate: null, existingItems: [], intervals: { motor_yagi: 10000 } }
  );
  assert.equal(plan.fromDate, "2026-04-10");
  assert.equal(plan.fromKm, 70000);
  assert.equal(plan.nextServiceKm, 80000);
  assert.equal(plan.nextServiceDate, "2027-04-10");
});

test("onboarding: periyodik kalem yoksa plan üretilmez (hatırlamıyorum = yalnız araç)", () => {
  const plan = planFromHistory(
    [{ date: "2026-04-10", km: "70000", items: ["silecek"], otherOn: false, otherText: "", note: "" }],
    { existingLatestDate: null, existingItems: [], intervals: {} }
  );
  assert.equal(plan, null);
});

test("onboarding: ayrı iki bakım → plan EN SON periyodik kayda göre", () => {
  const plan = planFromHistory(
    [
      { date: "2026-01-05", km: "60000", items: ["motor_yagi"], otherOn: false, otherText: "", note: "" },
      { date: "2026-05-01", km: "72000", items: ["yag_filtresi"], otherOn: false, otherText: "", note: "" },
    ],
    { existingLatestDate: null, existingItems: [], intervals: { motor_yagi: 10000, yag_filtresi: 10000 } }
  );
  assert.equal(plan.fromKm, 72000);
  assert.equal(plan.nextServiceKm, 82000);
});

test("onboarding: sonraki bakımı OTOİZ'e kayıt tarihi ezmez — son bakım km > kayıtlı en yeni servis kaydıysa ezilir", () => {
  const plan = planFromHistory(
    [{ date: "2026-06-01", km: "80000", items: ["motor_yagi"], otherOn: false, otherText: "", note: "" }],
    { existingLatestDate: "2026-08-01", existingItems: [], intervals: { motor_yagi: 10000 } }
  );
  assert.equal(plan, null); // araçtaki daha yeni kayıt var; eski bakım planı ezmez
});

// --- Tarihleri/geçmiş doğrulaması: "Hatırlamıyorum" yolu boş form
test("geçmiş: boş kayıt geçersiz ve tanımlı boş kontrolü var", () => {
  const blank = emptyEntry();
  assert.equal(isBlankEntry(blank), true);
  const err = validateHistoryEntry(blank, { today: todayIsoIstanbul(), currentKm: 1000, kind: "bakim" });
  assert.ok(err, "boş kayıt hata üretmeli");
});

// --- KM GÜNCELLE: negatif / bozuk / geri gidiş engellenir
test("km: negatif ve geçersiz değer reddedilir, kayıtlıdan düşük olamaz", () => {
  assert.equal(isValidCurrentKmUpdate(50000, "-100"), false);
  assert.equal(isValidCurrentKmUpdate(50000, "abc"), false);
  assert.equal(isValidCurrentKmUpdate(50000, "49999"), false);
  assert.equal(isValidCurrentKmUpdate(50000, "50000"), true);
  assert.equal(isValidCurrentKmUpdate(50000, "51000"), true);
});

test("bakım kaydı: km bugünle eşleşirse kayıtlı km'den düşük olamaz", () => {
  const today = todayIsoIstanbul();
  const err = validateMaintenanceAction({ date: today, km: "40000", items: ["motor_yagi"] }, { today, currentKm: 50000 });
  assert.ok(err && err.field === "km");
});

// --- Belge: MIME reddi, boyut sınırı, güvenli path
test("belge: PDF/JPG/PNG kabul, HTML/SVG/exe/unknown reddedilir", () => {
  assert.equal(checkDocumentFile({ name: "a.pdf", type: "application/pdf", size: 100 }).ok, true);
  assert.equal(checkDocumentFile({ name: "a.png", type: "image/png", size: 100 }).ok, true);
  assert.equal(checkDocumentFile({ name: "a.html", type: "text/html", size: 100 }).ok, false);
  assert.equal(checkDocumentFile({ name: "a.svg", type: "image/svg+xml", size: 100 }).ok, false);
  assert.equal(checkDocumentFile({ name: "a.exe", type: "application/x-msdownload", size: 100 }).ok, false);
  assert.equal(checkDocumentFile({ name: "a.bin", type: "", size: 100 }).ok, false);
});

test("belge: 10 MB sınırı", () => {
  assert.equal(checkDocumentFile({ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 }).ok, true);
  assert.equal(checkDocumentFile({ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }).ok, false);
});

test("belge: storage path kullanıcı dosya adı içermez, traversal tanınmaz", () => {
  const p = documentPath("veh-123", "req-abc", "pdf");
  assert.equal(p, "veh-123/req-abc.pdf");
  assert.ok(!p.includes(".."), "path traversal olasılığı olmamalı");
  assert.ok(/^[0-9a-z-]+\/[0-9a-z-]+\.[a-z]+$/i.test(p));
});

// --- Sonraki bakım önerisi (bakım kaydı sonrası +10.000 / 12 ay)
test("sonraki bakım: periyodik kalem varsa öneri üretilir, yoksa korunur", () => {
  const today = "2026-10-02";
  const withItems = nextServiceSuggestion({ items: ["motor_yagi"], km: "50000", today, intervalFor: () => 10000 });
  assert.equal(withItems.nextServiceKm, 60000);
  assert.equal(withItems.nextServiceDate, "2027-10-02");
  const none = nextServiceSuggestion({ items: ["lastik"], km: "50000", today });
  assert.equal(none, null);
});

test("geçmiş tanımı okunabilir Türkçe: chip etiketlerinden", () => {
  const e = { date: "2026-04-10", km: "70000", items: ["motor_yagi", "yag_filtresi"], otherOn: false, otherText: "", note: "" };
  const d = historyDescription(e);
  assert.match(d, /Motor Yağı/);
  assert.match(d, /Yağ Filtresi/);
});

test("aylar: son 12 ay sınır hesabı", () => {
  assert.equal(monthsAgoIso("2026-10-02", 12), "2025-10-02");
});

// --- LANDING: kritik metin + desteklenmeyen iddialar yok (kaynak taraması)
const fs = require("node:fs");
const path = require("node:path");
test("landing: ürünü 5 sn'de anlatan kritik başlık ve CTA'lar", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "LandingPage.tsx"), "utf8");
  // 2026-10-05 premium landing: kapalı tasarım metinleri.
  assert.match(src, /Aracınızın geçmişi kaybolmaz\./);
  assert.match(src, /Bakımlar, belgeler ve araç geçmişi tek yerde\./);
  assert.match(src, /Bireysel Kullanıcı/);
  assert.match(src, /Servis \/ İşletme/);
  for (const v of ["Bakım Geçmişi", "Belgeler", "Yaklaşan Bakımlar", "Güvenli Devir"]) assert.ok(src.includes(v), v);
  assert.match(src, /dijital servis pasaportu/i);
  assert.match(src, /Nasıl Çalışır\?/);
});

test("landing: desteklenmeyen iddialar (hacklenemez, NFC aktif, %100) kullanılmaz", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "LandingPage.tsx"), "utf8");
  for (const bad of [/hacklenemez/i, /%100/, /NFC aktif/i, /garant[ie] eder/i, /AI aktif/i, /native app/i]) {
    assert.doesNotMatch(src, bad, `yasak iddia: ${bad}`);
  }
});

// --- GÜVENLİK: storage path / belge MIME testlerinde kullanılan kaynaklar
// kullanıcı adını storage yoluna koymaz (lib/quickActions tek kaynak).
test("belge: dosya adı uzantısına göre MIME eşleştirilir (bozuk uzantı fallback)", () => {
  const r = checkDocumentFile({ name: "foto", type: "", size: 5 });
  assert.equal(r.ok, false); // uzantı yoksa kabul edilmez
});
