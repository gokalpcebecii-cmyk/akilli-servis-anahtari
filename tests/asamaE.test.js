const test = require("node:test");
const assert = require("node:assert");
const {
  nextServiceStatus,
  dateDueStatus,
  itemStatus,
  recordCategory,
  latestOf,
  buildVehicleStatus,
  daysBetween,
  addMonthsIso,
  DISCLAIMER,
} = require("../lib/vehicleStatus");
const { normalizeTimelineResponse, mergeTimelinePages, describeEvent, groupByYear, SOURCE_LABELS } = require("../lib/timeline");
const { resolveQuickPlan } = require("../lib/logic");
const { ITEM_LABELS, DEFAULT_INTERVALS, SERVICE_QUICK_KEYS, NEXT_PLAN_OPTIONS } = require("../lib/maintenanceItems");

const T = "2026-09-29";

test("sonraki bakım: plan yoksa GRİ / Plan belirlenmedi", () => {
  const s = nextServiceStatus({ currentKm: 50000, nextServiceKm: null, nextServiceDate: null, today: T });
  assert.equal(s.level, "none");
  assert.equal(s.headline, "Plan belirlenmedi");
});

test("sonraki bakım: km ve tarih uzak → YEŞİL", () => {
  const s = nextServiceStatus({ currentKm: 50000, nextServiceKm: 60000, nextServiceDate: "2027-09-29", today: T });
  assert.equal(s.level, "ok");
  assert.equal(s.headline, "Bakım için zaman var");
});

test("sonraki bakım: km yaklaşınca SARI (tarih uzak olsa bile)", () => {
  const s = nextServiceStatus({ currentKm: 59200, nextServiceKm: 60000, nextServiceDate: "2027-09-29", today: T });
  assert.equal(s.level, "soon");
  assert.equal(s.driver, "km");
  assert.match(s.detail, /^800 km kaldı/);
});

test("sonraki bakım: tarih yaklaşınca SARI (km uzak olsa bile)", () => {
  const s = nextServiceStatus({ currentKm: 50000, nextServiceKm: 60000, nextServiceDate: "2026-10-15", today: T });
  assert.equal(s.level, "soon");
  assert.equal(s.driver, "date");
  assert.match(s.detail, /^16 gün kaldı/);
});

test("sonraki bakım: km aşıldıysa KIRMIZI (tarih + km çakışması: en erken kritik koşul)", () => {
  const s = nextServiceStatus({ currentKm: 61200, nextServiceKm: 60000, nextServiceDate: "2026-10-15", today: T });
  assert.equal(s.level, "late");
  assert.equal(s.driver, "km");
  assert.match(s.detail, /1\.200 km aşıldı/);
});

test("sonraki bakım: tarih geçtiyse KIRMIZI (km uzak olsa bile)", () => {
  const s = nextServiceStatus({ currentKm: 50000, nextServiceKm: 60000, nextServiceDate: "2026-09-20", today: T });
  assert.equal(s.level, "late");
  assert.equal(s.driver, "date");
  assert.match(s.detail, /^9 gün geçti/);
});

test("sonraki bakım: iki koşul da sarıysa daha yakın olan belirler", () => {
  const s = nextServiceStatus({ currentKm: 59800, nextServiceKm: 60000, nextServiceDate: "2026-10-25", today: T });
  assert.equal(s.level, "soon");
  assert.equal(s.driver, "km"); // 200/1000 < 26/30
});

test("sonraki bakım: yalnız km veya yalnız tarih", () => {
  assert.equal(nextServiceStatus({ currentKm: 0, nextServiceKm: 500, nextServiceDate: null, today: T }).level, "soon");
  assert.equal(nextServiceStatus({ currentKm: 0, nextServiceKm: null, nextServiceDate: "2028-01-01", today: T }).level, "ok");
});

test("tarih yardımcıları saat diliminden bağımsız", () => {
  assert.equal(daysBetween("2026-09-29", "2026-10-01"), 2);
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2); // DST geçişi
  assert.equal(addMonthsIso("2026-01-31", 1), "2026-02-28");
});

test("süre sonu (muayene/sigorta)", () => {
  assert.equal(dateDueStatus(null, T).level, "none");
  assert.equal(dateDueStatus("2026-09-28", T).level, "late");
  assert.equal(dateDueStatus("2026-09-29", T).level, "soon");
  assert.equal(dateDueStatus("2026-12-29", T).level, "ok");
});

test("bakım kalemi: km periyodu ve ay periyodu", () => {
  assert.equal(itemStatus({ interval_km: 10000, last_service_km: 40000 }, 49500, T).level, "soon");
  assert.equal(itemStatus({ interval_km: 10000, last_service_km: 40000 }, 51000, T).level, "late");
  assert.equal(itemStatus({ interval_months: 12, last_service_date: "2025-09-01" }, 0, T).level, "late");
  assert.equal(itemStatus({ last_service_date: "2026-01-01" }, 0, T).level, "none");
});

test("kayıt kategorisi (yalnız görsel etiket)", () => {
  assert.equal(recordCategory("Araç muayenesi"), "muayene");
  assert.equal(recordCategory("Seramik kaplama"), "detailing");
  assert.equal(recordCategory("Pasta cila"), "detailing");
  assert.equal(recordCategory("Motor Yağı, Yağ Filtresi"), "bakim");
  assert.equal(latestOf([{ description: "Muayene", service_date: "2025-01-01" }, { description: "muayene", service_date: "2026-01-01" }], "muayene").service_date, "2026-01-01");
});

test("Araç Durumu: boş veri → tüm kartlar GRİ", () => {
  const { cards } = buildVehicleStatus({ vehicle: { current_km: 1000 }, items: [], labels: ITEM_LABELS, today: T });
  assert.deepEqual(cards.map((c) => c.key), ["bakim", "muayene", "detailing", "belgeler", "yaklasan"]);
  for (const c of cards) assert.equal(c.level, "none", c.key);
});

test("Araç Durumu: gecikmiş bakım + yaklaşan muayene + sigorta → yaklaşan işlemler listesi", () => {
  const { cards, upcoming } = buildVehicleStatus({
    vehicle: { current_km: 61000, next_service_km: 60000, next_service_date: "2027-01-01", muayene_tarihi: "2026-10-10", trafik_sigortasi_bitis: "2027-06-01" },
    items: [{ item_key: "motor_yagi", interval_km: 10000, last_service_km: 50500 }],
    labels: ITEM_LABELS,
    lastDetailing: { service_date: "2025-01-01" },
    today: T,
  });
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
  assert.equal(byKey.bakim.level, "late");
  assert.equal(byKey.muayene.level, "soon");
  assert.equal(byKey.detailing.level, "soon");
  assert.equal(byKey.belgeler.level, "ok");
  assert.equal(byKey.yaklasan.level, "late");
  assert.equal(upcoming[0].level, "late");
  assert.ok(upcoming.some((u) => u.title === "Motor Yağı"));
});

test("Araç Durumu: plan var, yakın işlem yok → YEŞİL", () => {
  const { cards } = buildVehicleStatus({ vehicle: { current_km: 1000, next_service_km: 11000, next_service_date: "2027-09-29" }, items: [], labels: ITEM_LABELS, today: T });
  assert.equal(cards.find((c) => c.key === "yaklasan").level, "ok");
});

test("OTOİZ mekanik teşhis yapmaz: hiçbir metin sağlık/arıza iddiası içermez", () => {
  const forbidden = /(iyi durumda|kötü|sağlıklı|arızalı|arıza yok|mekanik olarak|motor sağlığı|sorunsuz)/i;
  const scenarios = [
    { current_km: 1000 },
    { current_km: 61000, next_service_km: 60000, next_service_date: "2026-01-01", muayene_tarihi: "2026-01-01", kasko_bitis: "2026-10-01" },
    { current_km: 1000, next_service_km: 11000, next_service_date: "2027-09-29", muayene_tarihi: "2028-01-01" },
  ];
  for (const v of scenarios) {
    const { cards, upcoming, nextService } = buildVehicleStatus({ vehicle: v, items: [], labels: ITEM_LABELS, lastDetailing: { service_date: "2026-01-01" }, today: T });
    const text = JSON.stringify({ cards, upcoming, nextService }) + DISCLAIMER;
    assert.doesNotMatch(text, forbidden);
  }
  assert.match(DISCLAIMER, /mekanik değerlendirme değildir/);
});

test("zaman çizelgesi: güvenli normalize, sayfa birleştirme, yıl grupları, kaynak etiketi", () => {
  assert.deepEqual(normalizeTimelineResponse([]), { rows: [], hasMore: false, total: 0 });
  assert.deepEqual(normalizeTimelineResponse(null), { rows: [], hasMore: false, total: 0 });
  const r = normalizeTimelineResponse({ rows: [{ id: 1 }], has_more: true, total: 30 });
  assert.equal(r.hasMore, true);
  assert.equal(r.total, 30);
  const merged = mergeTimelinePages([{ id: "a", kind: "record" }], [{ id: "a", kind: "record" }, { id: "a", kind: "qr_linked" }]);
  assert.equal(merged.length, 2);
  const g = groupByYear([{ event_date: "2027-01-01" }, { event_date: "2027-05-01" }, { event_date: "2026-03-01" }]);
  assert.deepEqual(g.map((x) => [x.year, x.items.length]), [["2027", 2], ["2026", 1]]);
  assert.equal(describeEvent({ source: "service", kind: "record", title: "Motor yağı" }).sourceLabel, "Servis Doğrulamalı");
  assert.equal(describeEvent({ source: "owner", kind: "record", title: "Araç muayenesi" }).categoryLabel, "Muayene");
  assert.equal(describeEvent({ source: "system", kind: "ownership_transfer", title: "Sahiplik devredildi" }).sourceLabel, "Sistem / Araç Olayı");
  assert.equal(describeEvent({ source: "bogus" }).source, "system");
  assert.deepEqual(Object.values(SOURCE_LABELS), ["Servis Doğrulamalı", "Bireysel Kayıt", "Sistem / Araç Olayı"]);
});

test("servis hızlı kayıt: 11 hızlı seçim + tüm varsayılan periyotlar tanımlı", () => {
  assert.equal(SERVICE_QUICK_KEYS.length, 11);
  for (const k of SERVICE_QUICK_KEYS) {
    assert.ok(ITEM_LABELS[k], k);
    assert.ok(DEFAULT_INTERVALS[k], k);
  }
  assert.deepEqual(NEXT_PLAN_OPTIONS.map((o) => o.label), ["+10.000 km / 12 ay", "+15.000 km / 12 ay", "+10.000 km / 6 ay", "Özel", "Sonra belirle"]);
});

test("servis hızlı kayıt: sonraki bakım önerisi km girilince otomatik", () => {
  assert.deepEqual(resolveQuickPlan({ planKey: "default", currentKm: 84200, today: T }), { nextServiceKm: 94200, nextServiceDate: "2027-09-29", error: null });
  assert.deepEqual(resolveQuickPlan({ planKey: "extended_km", currentKm: 84200, today: T }), { nextServiceKm: 99200, nextServiceDate: "2027-09-29", error: null });
  assert.deepEqual(resolveQuickPlan({ planKey: "extended_months", currentKm: 84200, today: T }), { nextServiceKm: 94200, nextServiceDate: "2027-03-29", error: null });
  assert.deepEqual(resolveQuickPlan({ planKey: "later", currentKm: 84200, today: T }), { nextServiceKm: null, nextServiceDate: null, error: null });
  // seçili işlemin daha kısa periyodu varsayılanı öne çeker
  assert.equal(resolveQuickPlan({ planKey: "default", currentKm: 84200, today: T, selectedItemIntervals: { x: "5000" } }).nextServiceKm, 89200);
});

test("servis hızlı kayıt: Özel plan doğrulaması (sunucuyla aynı kurallar)", () => {
  assert.ok(resolveQuickPlan({ planKey: "custom", currentKm: 84200, today: T }).error);
  assert.ok(resolveQuickPlan({ planKey: "custom", currentKm: 84200, today: T, customNextKm: "80000" }).error);
  assert.ok(resolveQuickPlan({ planKey: "custom", currentKm: 84200, today: T, customNextDate: "2026-01-01" }).error);
  assert.deepEqual(resolveQuickPlan({ planKey: "custom", currentKm: 84200, today: T, customNextKm: "95000" }), { nextServiceKm: 95000, nextServiceDate: null, error: null });
});
