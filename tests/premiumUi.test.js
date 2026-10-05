"use strict";

// OTOİZ Premium arayüz — sunum yardımcıları (lib/premiumUi.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ui = require("../lib/premiumUi");

test("bölüm: yalnız 5 ana bölüm, bilinmeyen değer ana sayfaya düşer", () => {
  assert.deepEqual(ui.SECTIONS, ["ana", "aracim", "belgeler", "bakim", "diger"]);
  assert.equal(ui.sectionFrom("BELGELER"), "belgeler");
  assert.equal(ui.sectionFrom("yonetim"), "ana");
  assert.equal(ui.sectionFrom(null), "ana");
});

test("tarih ve km biçimi", () => {
  assert.equal(ui.longDate("2026-09-12"), "12 Eylül 2026");
  assert.equal(ui.longDate(""), "");
  assert.equal(ui.fmtKm(142350), "142.350 km");
  assert.equal(ui.fmtKm(null), "");
});

test("kalan süre ifadesi", () => {
  assert.equal(ui.remainingPhrase(0), "Bugün");
  assert.equal(ui.remainingPhrase(-4), "4 gün geçti");
  assert.equal(ui.remainingPhrase(20), "20 gün kaldı");
  assert.equal(ui.remainingPhrase(220), "7 ay kaldı");
  assert.equal(ui.remainingPhrase(800), "2 yıl kaldı");
  assert.equal(ui.approxPhrase(92), "Yaklaşık 3 ay");
  assert.equal(ui.approxPhrase(-3), "");
});

test("bakım kelimesi mekanik iddia taşımaz", () => {
  const forbidden = /(iyi durumda|kötü|sağlıklı|arızalı|arıza yok|mekanik olarak|motor sağlığı|sorunsuz)/i;
  for (const lvl of ["ok", "soon", "late", "none", "x"]) assert.doesNotMatch(ui.maintenanceWord(lvl), forbidden);
  assert.equal(ui.maintenanceWord("ok"), "Zamanında");
  assert.equal(ui.maintenanceWord("late"), "Gecikti");
});

test("gösterge doluluğu", () => {
  assert.equal(ui.ringFraction(null, 10000), 0);
  assert.equal(ui.ringFraction(-5, 10000), 1);
  assert.equal(ui.ringFraction(2350, 10000), 0.235);
  assert.equal(ui.ringFraction(20000, 10000), 1);
});

test("kayıt satırları: işlemler ve not ayrılır", () => {
  assert.deepEqual(ui.recordLines("Motor Yağı, Yağ Filtresi, Hava Filtresi — Not: 5W30"), { lines: ["Motor Yağı", "Yağ Filtresi", "Hava Filtresi"], note: "5W30" });
  assert.deepEqual(ui.recordLines("Araç OTOİZ'e eklendi"), { lines: ["Araç OTOİZ'e eklendi"], note: "" });
});

test("bakım geçmişi filtresi ve son servis", () => {
  const rows = [
    { id: 1, kind: "vehicle_created", source: "system" },
    { id: 2, kind: "record", source: "owner", event_date: "2026-09-20" },
    { id: 3, kind: "record", source: "service", event_date: "2026-09-12" },
  ];
  assert.equal(ui.filterTimeline(rows, "tumu").length, 3);
  assert.deepEqual(ui.filterTimeline(rows, "servis").map((r) => r.id), [3]);
  assert.deepEqual(ui.filterTimeline(rows, "kullanici").map((r) => r.id), [2]);
  assert.equal(ui.lastServiceRecord(rows).id, 3);
  assert.equal(ui.lastServiceRecord([rows[0]]), null);
});

test("belge filtresi: Diğer = fatura ve servis fişi dışındaki tüm türler", () => {
  const docs = [{ doc_type: "fatura" }, { doc_type: "servis_fisi" }, { doc_type: "muayene" }, { doc_type: "diger" }];
  assert.deepEqual(ui.DOC_FILTERS.map((f) => f.label), ["Tümü", "Fatura", "Servis Fişi", "Diğer"]);
  assert.equal(ui.filterDocuments(docs, "tumu").length, 4);
  assert.equal(ui.filterDocuments(docs, "fatura").length, 1);
  assert.equal(ui.filterDocuments(docs, "diger").length, 2);
  assert.equal(ui.docCountPhrase(4), "4 belge kayıtlı");
});

test("muayene görünümü: veri yoksa sabit metin", () => {
  assert.equal(ui.muayeneView({ nextIso: null }).text, "Muayene bilgisi eklenmemiş.");
  const v = ui.muayeneView({ nextIso: "2027-05-01", daysLeft: 210, level: "ok", lastIso: "2025-05-01" });
  assert.equal(v.text, "6 ay kaldı");
  assert.equal(v.next, "01.05.2027");
  assert.equal(v.last, "01.05.2025");
});

test("marka: kullanıcıya görünen ekranlarda yalnız OTOİZ", () => {
  const ROOT = path.join(__dirname, "..");
  const files = [
    "components/LandingPage.tsx",
    "app/giris/page.tsx",
    "components/AuthShell.tsx",
    "components/Premium.tsx",
    "components/BottomNav.tsx",
    "app/bireysel/araclar/page.tsx",
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(src, /OtoizGo|Otoiz Go|Akıllı Servis Anahtarı/, f);
  }
});
