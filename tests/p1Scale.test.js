"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const pg = require("../lib/pagination");
const ev = require("../lib/appEventsCore");
const rev = require("../lib/revisionFormat");
const labels = require("../lib/auditLabels");
const { LIMITS } = require("../lib/rateLimitCore");

const ID = "f1400000-0000-0000-0000-000000000123";
const TS = "2026-09-29T10:11:12.345678+00:00";

test("cursor mikrosaniyeyi aynen korur ve geri çözülür", () => {
  const c = pg.encodeCursor(TS, ID);
  assert.deepEqual(pg.decodeCursor(c), { t: TS, id: ID });
});

test("bozuk / kötü niyetli cursor reddedilir", () => {
  const bad = [
    null,
    "",
    "x".repeat(300),
    "not-base64-json",
    Buffer.from(JSON.stringify({ t: TS, id: "1 or 1=1" })).toString("base64url"),
    Buffer.from(JSON.stringify({ t: "2026-09-29),id.gt.(", id: ID })).toString("base64url"),
    Buffer.from(JSON.stringify({ t: 5, id: ID })).toString("base64url"),
  ];
  for (const b of bad) assert.equal(pg.decodeCursor(b), null, String(b).slice(0, 40));
});

test("keyset filtresi (created_at, id) < cursor kuralını üretir", () => {
  assert.equal(pg.keysetOrFilter(null), null);
  assert.equal(pg.keysetOrFilter({ t: TS, id: ID }), `created_at.lt.${TS},and(created_at.eq.${TS},id.lt.${ID})`);
});

test("plaka arama anahtarı plate_key ile aynı normalize edilir", () => {
  assert.equal(pg.plateKeyQuery("34 abc 123"), "34ABC123");
  assert.equal(pg.plateKeyQuery("34-ab,c).or(1"), "34ABCOR1");
  assert.equal(pg.plateKeyQuery(null), "");
  assert.equal(pg.plateKeyQuery("1".repeat(40)).length, 16);
});

test("limit+1 satırdan sonraki sayfa bilgisi çıkar; sayfalar birleşince eksiksiz ve tekrarsızdır", () => {
  const all = Array.from({ length: 173 }, (_, i) => ({ id: `f1400000-0000-0000-0000-${String(1000 - i).padStart(12, "0")}`, created_at: `2026-09-29T10:00:00.${String(999999 - i).padStart(6, "0")}+00:00` }));
  const seen = [];
  let cur = null;
  for (let guard = 0; guard < 10; guard++) {
    const rows = all.filter((r) => !cur || r.created_at < cur.t || (r.created_at === cur.t && r.id < cur.id)).slice(0, pg.PAGE_SIZE + 1);
    const p = pg.splitPage(rows);
    seen.push(...p.rows);
    if (!p.hasMore) break;
    cur = pg.decodeCursor(p.nextCursor);
  }
  assert.equal(seen.length, all.length);
  assert.equal(new Set(seen.map((r) => r.id)).size, all.length);
  assert.equal(pg.splitPage([]).nextCursor, null);
});

test("olay yardımcıları kişisel veri taşımaz", () => {
  assert.equal(ev.safeRoute("/api/signup?email=a@b.com"), "/api/signupemailab.com".replace(/[^A-Za-z0-9/_\-[\]]/g, ""));
  assert.ok(!String(ev.safeRoute("/r/abc?x=a@b")).includes("@"));
  assert.equal(ev.safeCode({ code: "over_email_send_rate_limit" }), "over_email_send_rate_limit");
  assert.equal(ev.safeCode({ message: "a@b.com bulunamadı" }), null);
  assert.ok(!ev.CLIENT_EVENT_KINDS.has("api_5xx"));
  for (const k of ev.CLIENT_EVENT_KINDS) assert.ok(ev.EVENT_KINDS.has(k));
});

test("Auth hataları sınıflandırılır", () => {
  assert.equal(ev.classifyAuthError(null), null);
  assert.equal(ev.classifyAuthError({ status: 429, message: "x" }), "rate_limited");
  assert.equal(ev.classifyAuthError({ code: "over_email_send_rate_limit" }), "rate_limited");
  assert.equal(ev.classifyAuthError({ status: 500, message: "Error sending confirmation email" }), "email_send_error");
  assert.equal(ev.classifyAuthError({ status: 400, message: "weak password" }), "signup_error");
});

test("düzeltme geçmişi yalnız anlamlı alanları okunur gösterir", () => {
  const ch = rev.describeChanges({
    changed_fields: ["km_at_service", "description", "updated_by"],
    old_values: { km_at_service: 120000, description: "Yağ" },
    new_values: { km_at_service: 125000, description: "Yağ + filtre" },
  });
  assert.equal(ch.length, 2);
  assert.equal(ch[0].label, "Kilometre");
  assert.match(ch[0].from, /120\.000 km/);
  assert.match(ch[0].to, /125\.000 km/);
  assert.equal(ch[1].to, "Yağ + filtre");
  assert.equal(rev.formatValue("cost", null), "—");
  assert.equal(rev.formatValue("service_date", "2026-09-01"), "01.09.2026");
});

test("revizyonlar kayda göre gruplanır, en yeni önce", () => {
  const g = rev.groupByRecord([{ record_id: "a", revision: 2 }, { record_id: "b", revision: 2 }, { record_id: "a", revision: 3 }]);
  assert.deepEqual(g.a.map((r) => r.revision), [3, 2]);
  assert.equal(g.b.length, 1);
});

test("işlem kaydı türleri Türkçe gösterilir", () => {
  assert.equal(labels.actionLabel("maintenance_record_revised"), "Servis kaydı düzeltildi");
  assert.equal(labels.actionLabel("bilinmeyen_islem"), "bilinmeyen islem");
  assert.equal(labels.actionLabel(null), "");
});

test("P1 hız sınırları tanımlı ve makul", () => {
  for (const k of ["resolverMissIp10m", "clientEventIp10m", "adminBatchHour", "userWriteMinute", "documentUploadUserDay"]) {
    assert.ok(LIMITS[k], k);
    assert.ok(LIMITS[k].max > 0 && LIMITS[k].windowSeconds > 0, k);
  }
});

// DÜZELTME 01 — Yönetim > Araçlar toplam sayacı
const { vehicleCountView } = require("../lib/vehicleCount");

test("araç sayacı: aramasız toplam belirgin ve tr-TR biçimli (5K/25K)", () => {
  assert.equal(vehicleCountView({ allTotal: 6, matchTotal: 6, shown: 6, query: "", loading: false }).headline, "6");
  const v5 = vehicleCountView({ allTotal: 5000, matchTotal: 5000, shown: 50, query: "", loading: false });
  assert.equal(v5.headline, "5.000");
  assert.equal(v5.detail, "en yeni önce · 50 gösteriliyor");
  const v25 = vehicleCountView({ allTotal: 25009, matchTotal: 25009, shown: 100, query: "", loading: false });
  assert.equal(v25.headline, "25.009");
  assert.match(v25.detail, /100 gösteriliyor/);
});

test("araç sayacı: aramada genel toplam kalır, eşleşen sayı ayrıca yazılır", () => {
  const v = vehicleCountView({ allTotal: 25009, matchTotal: 1234, shown: 50, query: " 34 test ", loading: false });
  assert.equal(v.headline, "25.009");
  assert.equal(v.searching, true);
  assert.equal(v.detail, "“34 test” için 1.234 sonuç · 50 gösteriliyor");
  const none = vehicleCountView({ allTotal: 6, matchTotal: 0, shown: 0, query: "ZZZ", loading: false });
  assert.equal(none.detail, "“ZZZ” için 0 sonuç · 0 gösteriliyor");
});

test("araç sayacı: yüklenirken ve toplam alınamadığında boş kalmaz", () => {
  assert.equal(vehicleCountView({ allTotal: null, matchTotal: null, shown: 0, query: "", loading: true }).headline, "…");
  assert.equal(vehicleCountView({ allTotal: 6, matchTotal: null, shown: 0, query: "34", loading: true }).detail, "Aranıyor…");
  const err = vehicleCountView({ allTotal: null, matchTotal: null, shown: 0, query: "", loading: false });
  assert.equal(err.headline, "—");
  assert.match(err.detail, /alınamadı/);
});
