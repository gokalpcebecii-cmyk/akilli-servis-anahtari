"use strict";
// Nihai UX + 12 aylık başlangıç geçmişi: geçmiş kaydı doğrulaması, sonraki
// bakımın geçmişten hesaplanması, zaman çizelgesi rozeti, kritik özet.
const test = require("node:test");
const assert = require("node:assert");
const {
  isHistoryEvent,
  validateHistoryEntry,
  historyDescription,
  itemUpdatesFromHistory,
  planFromHistory,
  monthsAgoIso,
  emptyEntry,
} = require("../lib/history");
const { describeEvent } = require("../lib/timeline");
const { buildVehicleStatus, criticalSummary } = require("../lib/vehicleStatus");
const { QUICK_GRID_KEYS, CHIP_LABELS, ITEM_LABELS } = require("../lib/maintenanceItems");

const TODAY = "2026-09-30";
const e = (o) => ({ ...emptyEntry(), ...o });

test("ızgara: brifteki 15 işlem sırasıyla, hepsi DB anahtarı; Triger kısa ad", () => {
  assert.equal(QUICK_GRID_KEYS.length, 15);
  assert.deepEqual(
    QUICK_GRID_KEYS.map((k) => CHIP_LABELS[k]),
    ["Motor Yağı", "Yağ Filtresi", "Hava Filtresi", "Polen Filtresi", "Yakıt Filtresi", "Ön Fren Balatası", "Arka Fren Balatası", "Fren Diski", "Şanzıman Yağı", "Antifriz", "Akü", "Lastik", "Buji", "Silecek", "Triger"]
  );
  for (const k of QUICK_GRID_KEYS) assert.ok(ITEM_LABELS[k], k);
  assert.equal(ITEM_LABELS.triger_seti, "Triger Seti");
});

test("geçmiş doğrulama: tarih, km ve işlem zorunlu; gelecek tarih ve güncel km üstü reddedilir", () => {
  const ctx = { today: TODAY, currentKm: 84200, minDate: "2018-01-01" };
  assert.equal(validateHistoryEntry(e({}), ctx).field, "date");
  assert.equal(validateHistoryEntry(e({ date: "2026-10-01", km: "80000", items: ["motor_yagi"] }), ctx).field, "date");
  assert.equal(validateHistoryEntry(e({ date: "2017-12-31", km: "80000", items: ["motor_yagi"] }), ctx).field, "date");
  assert.equal(validateHistoryEntry(e({ date: "2026-02-30", km: "80000", items: ["motor_yagi"] }), ctx).field, "date");
  assert.equal(validateHistoryEntry(e({ date: "2026-03-01", items: ["motor_yagi"] }), ctx).field, "km");
  assert.match(validateHistoryEntry(e({ date: "2026-03-01", km: "90000", items: ["motor_yagi"] }), ctx).message, /84\.200 km/);
  assert.equal(validateHistoryEntry(e({ date: "2026-03-01", km: "80000" }), ctx).field, "items");
  assert.equal(validateHistoryEntry(e({ date: "2026-03-01", km: "80000", otherOn: true, otherText: "  " }), ctx).field, "items");
  assert.equal(validateHistoryEntry(e({ date: "2026-03-01", km: "80000", items: ["motor_yagi"] }), ctx), null);
  assert.equal(validateHistoryEntry(e({ date: TODAY, km: "84200", otherOn: true, otherText: "Klima gazı" }), ctx), null);
});

test("diğer araç kaydı: açıklama zorunlu, km isteğe bağlı", () => {
  const ctx = { today: TODAY, currentKm: 84200, kind: "diger" };
  assert.equal(validateHistoryEntry(e({ date: "2026-05-01" }), ctx).field, "items");
  assert.equal(validateHistoryEntry(e({ date: "2026-05-01", otherOn: true, otherText: "Araç muayenesi" }), ctx), null);
});

test("açıklama: servis kaydıyla aynı biçim, not ayrı", () => {
  assert.equal(historyDescription(e({ items: ["motor_yagi", "triger_seti"], note: "  yetkili   serviste " })), "Motor Yağı, Triger Seti — Not: yetkili serviste");
  assert.equal(historyDescription(e({ items: ["aku"], otherOn: true, otherText: "Klima gazı" })), "Akü, Klima gazı");
  assert.equal(historyDescription(e({ otherOn: true, otherText: "Araç muayenesi" })), "Araç muayenesi");
});

test("KRİTİK: sonraki bakım en son periyodik geçmiş kaydının tarih ve km'sinden başlar", () => {
  const entries = [
    e({ date: "2025-11-12", km: "68000", items: ["motor_yagi", "yag_filtresi"] }),
    e({ date: "2026-06-03", km: "76500", items: ["motor_yagi", "yag_filtresi", "hava_filtresi"] }),
    e({ date: "2026-08-20", km: "79000", items: ["silecek"] }), // periyodik değil
  ];
  const p = planFromHistory(entries);
  assert.equal(p.fromDate, "2026-06-03");
  assert.equal(p.fromKm, 76500);
  assert.equal(p.nextServiceKm, 86500);
  assert.equal(p.nextServiceDate, "2027-06-03");
});

test("geçmiş planı: daha kısa periyotlu işlem kazanır; mevcut periyot ayarı kullanılır", () => {
  const entries = [e({ date: "2026-04-10", km: "70000", items: ["motor_yagi"] })];
  assert.equal(planFromHistory(entries, { existingItems: [{ item_key: "motor_yagi", interval_km: 7500 }] }).nextServiceKm, 77500);
});

test("geçmiş planı: periyodik kayıt yoksa ya da araçta daha yeni kayıt varsa plan değişmez", () => {
  assert.equal(planFromHistory([e({ date: "2026-04-10", km: "70000", items: ["aku"] })]), null);
  assert.equal(planFromHistory([]), null);
  const entries = [e({ date: "2026-04-10", km: "70000", items: ["motor_yagi"] })];
  assert.equal(planFromHistory(entries, { existingLatestDate: "2026-05-01" }), null);
  assert.ok(planFromHistory(entries, { existingLatestDate: "2026-04-10" }));
});

test("bakım kalemleri: her kalem için en son geçmiş işlemi; daha yeni mevcut kayıt ezilmez", () => {
  const entries = [
    e({ date: "2025-11-12", km: "68000", items: ["motor_yagi", "aku"] }),
    e({ date: "2026-06-03", km: "76500", items: ["motor_yagi"] }),
  ];
  const u = itemUpdatesFromHistory(entries, [{ item_key: "aku", last_service_date: "2026-01-05", last_service_km: 71000, interval_km: 30000 }]);
  assert.deepEqual(u, [{ item_key: "motor_yagi", last_service_date: "2026-06-03", last_service_km: 76500, interval_km: 10000 }]);
});

test("zaman çizelgesi: geçmiş tarihli bireysel kayıt 'Bireysel Geçmiş Kaydı'", () => {
  const hist = { kind: "record", source: "owner", event_date: "2026-06-03", event_ts: "2026-09-30T08:00:00Z", title: "Motor Yağı" };
  const same = { kind: "record", source: "owner", event_date: "2026-09-30", event_ts: "2026-09-30T08:00:00Z", title: "Motor Yağı" };
  // 21:30Z = İstanbul'da ertesi gün 00:30 → aynı gün girilmiş kayıt geçmiş sayılmaz.
  const lateNight = { kind: "record", source: "owner", event_date: "2026-10-01", event_ts: "2026-09-30T21:30:00Z", title: "Akü" };
  const svc = { kind: "record", source: "service", event_date: "2026-06-03", event_ts: "2026-09-30T08:00:00Z", title: "Motor Yağı" };
  assert.equal(isHistoryEvent(hist), true);
  assert.equal(isHistoryEvent(same), false);
  assert.equal(isHistoryEvent(lateNight), false);
  assert.equal(isHistoryEvent(svc), false);
  assert.equal(describeEvent(hist).sourceLabel, "Bireysel Geçmiş Kaydı");
  assert.equal(describeEvent(same).sourceLabel, "Bireysel Kayıt");
  assert.equal(describeEvent(svc).sourceLabel, "Servis Doğrulamalı");
  assert.equal(describeEvent({ kind: "vehicle_created", source: "system" }).sourceLabel, "Sistem / Araç Olayı");
});

test("12 ay önce: ay sonu taşması güvenli", () => {
  assert.equal(monthsAgoIso("2026-09-30", 12), "2025-09-30");
  assert.equal(monthsAgoIso("2024-02-29", 12), "2023-02-28");
});

test("kritik özet: sayı + en önemli iki işlem kısa cümle", () => {
  const vehicle = { current_km: 84200, next_service_km: 90000, next_service_date: "2027-06-01", trafik_sigortasi_bitis: "2026-09-27", kasko_bitis: "2026-10-18", muayene_tarihi: null };
  const s = criticalSummary(buildVehicleStatus({ vehicle, items: [], labels: ITEM_LABELS, today: TODAY }));
  assert.equal(s.title, "2 işlem dikkatinizi bekliyor");
  assert.equal(s.line, "Trafik sigortası gecikti · Kasko 18 gün sonra");
  assert.equal(s.level, "late");
  const ok = criticalSummary(buildVehicleStatus({ vehicle: { current_km: 1000, next_service_km: 11000 }, items: [], labels: ITEM_LABELS, today: TODAY }));
  assert.equal(ok.title, "Tüm işlemler zamanında");
  const none = criticalSummary(buildVehicleStatus({ vehicle: {}, items: [], labels: ITEM_LABELS, today: TODAY }));
  assert.equal(none.level, "none");
});

test("son düzenleme: onboarding özet kartı '20 Mart 2026 · 68.000 km' + işlemler; boş kayıt tanınır", () => {
  const { fmtLongDate, entrySummary, isBlankEntry } = require("../lib/history");
  assert.equal(fmtLongDate("2026-03-20"), "20 Mart 2026");
  assert.equal(fmtLongDate("2025-12-01"), "1 Aralık 2025");
  assert.equal(fmtLongDate(""), "");
  const s = entrySummary(e({ date: "2026-03-20", km: "68000", items: ["hava_filtresi", "fren_on_balata"] }));
  assert.equal(s.head, "20 Mart 2026 · 68.000 km");
  assert.equal(s.items, "Hava Filtresi · Ön Fren Balatası");
  assert.equal(entrySummary(e({ date: "2026-03-20", items: ["triger_seti"], otherOn: true, otherText: " Klima gazı " })).items, "Triger · Klima gazı");
  assert.equal(isBlankEntry(emptyEntry()), true);
  assert.equal(isBlankEntry(e({ km: "5" })), false);
});
