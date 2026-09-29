const test = require("node:test");
const assert = require("node:assert");
const { buildVehicleStatus, dateDueStatus } = require("../lib/vehicleStatus");
const { isValidDocDate } = require("../lib/logic");
const { BRANDS, findBrand, modelsFor, pickerState } = require("../lib/vehicleCatalog");
const { charsFor, countSignificant, caretAfterSignificant } = require("../lib/caret");
const { createVehicle } = require("../lib/vehicleWrite");

const T = "2026-09-29";

// ---- 1-4: Sonraki Muayene / Kasko / Zorunlu Trafik Sigortası durumları
test("Belge tarihleri: 31 gün YEŞİL, 30 gün SARI, bugün SARI, dün KIRMIZI, boş GRİ", () => {
  assert.equal(dateDueStatus("2026-10-30", T).level, "ok");
  assert.equal(dateDueStatus("2026-10-29", T).level, "soon");
  assert.equal(dateDueStatus("2026-09-29", T).level, "soon");
  assert.equal(dateDueStatus("2026-09-28", T).level, "late");
  assert.equal(dateDueStatus(null, T).level, "none");
  assert.equal(dateDueStatus("", T).level, "none");
});

test("Araç Durumu: muayene, trafik sigortası ve kasko ayrı kartlar, ayrı renkler", () => {
  const { cards, upcoming } = buildVehicleStatus({
    vehicle: { current_km: 1000, muayene_tarihi: "2026-10-15", trafik_sigortasi_bitis: "2026-09-01", kasko_bitis: "2027-05-01" },
    items: [],
    labels: {},
    today: T,
  });
  const by = Object.fromEntries(cards.map((c) => [c.key, c]));
  assert.equal(by.muayene.title, "Sonraki Muayene");
  assert.equal(by.muayene.level, "soon");
  assert.equal(by.trafik.title, "Trafik Sigortası");
  assert.equal(by.trafik.level, "late");
  assert.match(by.trafik.detail, /01\.09\.2026 · 28 gün geçti/);
  assert.equal(by.kasko.level, "ok");
  assert.ok(upcoming.some((u) => u.title === "Zorunlu trafik sigortası bitişi" && u.level === "late"));
  assert.ok(upcoming.some((u) => u.key === "muayene" && u.level === "soon"));
  assert.ok(!upcoming.some((u) => u.key === "kasko"));
  assert.equal(by.yaklasan.level, "late");
});

test("Araç Durumu: tarih yoksa kasko ve trafik GRİ ve 'Tarih yok'", () => {
  const { cards } = buildVehicleStatus({ vehicle: { current_km: 0 }, items: [], labels: {}, today: T });
  for (const k of ["trafik", "kasko", "muayene"]) {
    const c = cards.find((x) => x.key === k);
    assert.equal(c.level, "none");
    assert.equal(c.value, "Tarih yok");
  }
});

test("isValidDocDate: boş ve geçmiş tarih geçerli, bozuk tarih geçersiz", () => {
  assert.equal(isValidDocDate(""), true);
  assert.equal(isValidDocDate(null), true);
  assert.equal(isValidDocDate("2020-01-15"), true);
  assert.equal(isValidDocDate("2028-02-29"), true);
  assert.equal(isValidDocDate("2027-02-29"), false);
  assert.equal(isValidDocDate("2027-13-01"), false);
  assert.equal(isValidDocDate("1999-12-31"), false);
  assert.equal(isValidDocDate("15.01.2027"), false);
  assert.equal(isValidDocDate("2027-01-01'; drop"), false);
});

// ---- 5-7: marka → model seçimi, mevcut kayıtları bozmama
test("Katalog: markalar sıralı, tekrar yok, her markada model var", () => {
  const sorted = [...BRANDS].sort((a, b) => a.localeCompare(b, "tr"));
  assert.deepEqual(BRANDS, sorted);
  assert.equal(new Set(BRANDS).size, BRANDS.length);
  for (const b of BRANDS) assert.ok(modelsFor(b).length > 0, b);
  assert.ok(modelsFor("Fiat").includes("Egea"));
  assert.ok(modelsFor("TOGG").includes("T10X"));
});

test("findBrand: büyük/küçük harf, boşluk ve tire farkını yok sayar", () => {
  assert.equal(findBrand("fiat"), "Fiat");
  assert.equal(findBrand(" VOLKSWAGEN "), "Volkswagen");
  assert.equal(findBrand("mercedes benz"), "Mercedes-Benz");
  assert.equal(findBrand("citroen"), "Citroën");
  assert.equal(findBrand("Anadol"), null);
  assert.equal(findBrand(""), null);
});

test("pickerState: listede olmayan eski kayıt elle giriş modunda AYNEN açılır", () => {
  assert.deepEqual(pickerState("Anadol", "A1"), { brandMode: "manual", brand: "Anadol", modelMode: "manual", model: "A1" });
  assert.deepEqual(pickerState("Fiat", "Egea 1.4 Fire Urban"), { brandMode: "list", brand: "Fiat", modelMode: "manual", model: "Egea 1.4 Fire Urban" });
  assert.deepEqual(pickerState("fiat", "egea"), { brandMode: "list", brand: "Fiat", modelMode: "list", model: "Egea" });
  assert.deepEqual(pickerState("", ""), { brandMode: "list", brand: "", modelMode: "list", model: "" });
  assert.deepEqual(pickerState("Toyota", ""), { brandMode: "list", brand: "Toyota", modelMode: "list", model: "" });
});

// ---- 8: imleç
test("İmleç: km ortasına rakam eklenince imleç yazılan rakamın arkasında kalır", () => {
  const D = charsFor("digits");
  // "84.200" içinde "84." sonrası "1" yazıldı → ham "84.1200", imleç 4
  const n = countSignificant("84.1", D);
  assert.equal(n, 3);
  // biçimlenmiş yeni değer "841.200": 3. rakamın arkası = 3
  assert.equal(caretAfterSignificant("841.200", n, D), 3);
  // silme: "84.|200" konumunda Backspace → ham "84200" imleç 2 → "84.200" içinde 2
  assert.equal(caretAfterSignificant("84.200", countSignificant("84", D), D), 2);
  // başa yazma
  assert.equal(caretAfterSignificant("184.200", countSignificant("1", D), D), 1);
});

test("İmleç: plakada küçük harf büyüğe çevrilince imleç yerinde kalır", () => {
  const A = charsFor("alnum");
  // "34 ABC" içinde "34 " sonrası "x" → ham "34 xABC", imleç 4 → "34 XABC"
  assert.equal(caretAfterSignificant("34 XABC", countSignificant("34 x", A), A), 4);
  // Türkçe harf
  assert.equal(caretAfterSignificant("34 İ", countSignificant("34 i", A), A), 4);
});

// ---- API: yeni araçta belge tarihleri
function fakeClient(captured) {
  const q = {
    select() { return q; },
    eq() { return q; },
    maybeSingle: async () => ({ data: null }),
    insert(payload) { captured.payload = payload; return { select: () => ({ single: async () => ({ data: { id: "v1", ...payload }, error: null }) }) }; },
  };
  return { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) }, from: () => q };
}
const base = { plate: "34 ABC 123", brand: "Fiat", model: "Egea", year: 2020, current_km: 1000 };

test("API: yeni araç belge tarihleriyle yazılır; bozuk tarih hiçbir şey yazmaz", async () => {
  const c1 = {};
  const ok = await createVehicle({ authHeader: "Bearer x", client: fakeClient(c1), body: { ...base, muayene_tarihi: "2027-05-01", kasko_bitis: "2026-01-01", trafik_sigortasi_bitis: "" } });
  assert.equal(ok.status, 200);
  assert.equal(c1.payload.muayene_tarihi, "2027-05-01");
  assert.equal(c1.payload.kasko_bitis, "2026-01-01");
  assert.equal(c1.payload.trafik_sigortasi_bitis, null);
  const c2 = {};
  const bad = await createVehicle({ authHeader: "Bearer x", client: fakeClient(c2), body: { ...base, kasko_bitis: "2027-02-30" } });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.errors.kasko_bitis);
  assert.equal(c2.payload, undefined);
});

test("API: belge tarihi gönderilmeyen eski istemci aynen çalışır (tarihler null)", async () => {
  const c = {};
  const r = await createVehicle({ authHeader: "Bearer x", client: fakeClient(c), body: base });
  assert.equal(r.status, 200);
  assert.equal(c.payload.muayene_tarihi, null);
  assert.equal(c.payload.brand, "Fiat");
});
