const test = require("node:test");
const assert = require("node:assert/strict");

const {
  kmRemaining,
  daysRemaining,
  shouldSendReminder,
  prepareOwnershipTransfer,
  anonymizeCustomerRecord,
  normalizePlate,
  plateSearchKey,
  validateVehicleInput,
  computeMaintenancePlan,
  isValidNextServiceKm,
  describeMaintenancePlan,
} = require("../lib/logic");

const { generateQrCode, QR_CODE_ALPHABET } = require("../lib/qrToken");

// ---------------------------------------------------------------------
// Reminder km logic
// ---------------------------------------------------------------------

test("kmRemaining: null sonraki bakım km'i varsa null döner", () => {
  assert.equal(kmRemaining(10000, null), null);
});

test("kmRemaining: kalan kilometreyi doğru hesaplar", () => {
  assert.equal(kmRemaining(9500, 10000), 500);
  assert.equal(kmRemaining(10500, 10000), -500);
});

test("shouldSendReminder: km eşiğinin altına girince true döner", () => {
  const due = shouldSendReminder({
    currentKm: 9600,
    nextServiceKm: 10000,
    nextServiceDateISO: null,
    todayISO: "2026-01-01",
    reminderKmBefore: 500,
    reminderDaysBefore: 14,
  });
  assert.equal(due, true);
});

test("shouldSendReminder: km eşiğinin çok uzağındaysa false döner", () => {
  const due = shouldSendReminder({
    currentKm: 5000,
    nextServiceKm: 10000,
    nextServiceDateISO: null,
    todayISO: "2026-01-01",
    reminderKmBefore: 500,
    reminderDaysBefore: 14,
  });
  assert.equal(due, false);
});

// ---------------------------------------------------------------------
// Reminder date logic
// ---------------------------------------------------------------------

test("daysRemaining: tarih verilmemişse null döner", () => {
  assert.equal(daysRemaining("2026-01-01", null), null);
});

test("daysRemaining: kalan gün sayısını doğru hesaplar", () => {
  assert.equal(daysRemaining("2026-01-01", "2026-01-15"), 14);
  assert.equal(daysRemaining("2026-01-20", "2026-01-15"), -5);
});

test("shouldSendReminder: tarih eşiğinin altına girince true döner (km bilgisi olmasa bile)", () => {
  const due = shouldSendReminder({
    currentKm: 1000,
    nextServiceKm: null,
    nextServiceDateISO: "2026-01-10",
    todayISO: "2026-01-01",
    reminderKmBefore: 500,
    reminderDaysBefore: 14,
  });
  assert.equal(due, true);
});

test("shouldSendReminder: hem km hem tarih uzaksa false döner", () => {
  const due = shouldSendReminder({
    currentKm: 1000,
    nextServiceKm: 20000,
    nextServiceDateISO: "2026-06-01",
    todayISO: "2026-01-01",
    reminderKmBefore: 500,
    reminderDaysBefore: 14,
  });
  assert.equal(due, false);
});

// ---------------------------------------------------------------------
// Sahiplik devri: kişisel veri ayrımı (KVKK)
// ---------------------------------------------------------------------

test("prepareOwnershipTransfer: önceki sahip yoksa PII alanı içermeyen boş özet döner", () => {
  const { anonymizedSnapshot, fieldsToErase } = prepareOwnershipTransfer(null, "2026-01-01");
  assert.equal(fieldsToErase.length, 0);
  assert.equal(anonymizedSnapshot.full_name, undefined);
  assert.equal(anonymizedSnapshot.phone, undefined);
  assert.equal(anonymizedSnapshot.email, undefined);
});

test("prepareOwnershipTransfer: önceki sahip varsa anonimleştirilmiş özette hiçbir kişisel veri bulunmaz", () => {
  const previousCustomer = {
    full_name: "Ahmet Yılmaz",
    phone: "0555 111 22 33",
    email: "ahmet@example.com",
  };
  const { anonymizedSnapshot, fieldsToErase } = prepareOwnershipTransfer(previousCustomer, "2026-01-01");

  const snapshotText = JSON.stringify(anonymizedSnapshot);
  assert.equal(snapshotText.includes("Ahmet"), false);
  assert.equal(snapshotText.includes("0555"), false);
  assert.equal(snapshotText.includes("ahmet@example.com"), false);

  assert.deepEqual(fieldsToErase.sort(), ["email", "full_name", "phone"]);
});

test("anonymizeCustomerRecord: kişisel alanları temizlenmiş bir kayıt döner", () => {
  const record = anonymizeCustomerRecord();
  assert.equal(record.full_name, "Silinmis Kullanici");
  assert.equal(record.phone, null);
  assert.equal(record.email, null);
});

// ---------------------------------------------------------------------
// QR/token yardımcı fonksiyonları: temel güvenlik davranışı
// ---------------------------------------------------------------------

test("generateQrCode: istenen uzunlukta kod üretir", () => {
  const code = generateQrCode(12);
  assert.equal(code.length, 12);
});

test("generateQrCode: yalnızca izin verilen (karışabilecek karakterler hariç) alfabeden üretir", () => {
  const code = generateQrCode(200);
  for (const ch of code) {
    assert.ok(QR_CODE_ALPHABET.includes(ch), `beklenmeyen karakter: ${ch}`);
  }
  assert.equal(/[01oOlI]/.test(code), false);
});

test("generateQrCode: ardışık üretimler pratikte tekrar etmez (çarpışma testi)", () => {
  const seen = new Set();
  const count = 2000;
  for (let i = 0; i < count; i++) {
    seen.add(generateQrCode(12));
  }
  assert.equal(seen.size, count);
});

test("generateQrCode: aynı girdilerle deterministik OLMAYAN (rastgele) sonuç üretir", () => {
  const a = generateQrCode(16);
  const b = generateQrCode(16);
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------
// PILOT FIX 03 — plaka normalizasyonu, araç doğrulama, bakım planı
// ---------------------------------------------------------------------

test("normalizePlate: aynı plakanın üç ayraç varyasyonu birebir aynı kanonik forma iner", () => {
  const a = normalizePlate("06otoiz01");
  const b = normalizePlate("06 OTOIZ 01");
  const c = normalizePlate("06-otoiz-01");
  assert.equal(a, "06 OTOIZ 01");
  assert.equal(a, b);
  assert.equal(b, c);
});

test("normalizePlate: baştaki/sondaki boşlukları temizler", () => {
  assert.equal(normalizePlate("  34 abc 123  "), "34 ABC 123");
});

test("plateSearchKey: ayraçtan bağımsız arama anahtarı üretir", () => {
  assert.equal(plateSearchKey("06 OTOIZ 01"), plateSearchKey("06otoiz01"));
  assert.equal(plateSearchKey("06-otoiz-01"), "06OTOIZ01");
});

test("validateVehicleInput: tamamen boş form tüm zorunlu alanlarda hata döner, valid=false", () => {
  const result = validateVehicleInput({ plate: "", brand: "", model: "", year: "", current_km: "" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.plate);
  assert.ok(result.errors.brand);
  assert.ok(result.errors.model);
  assert.ok(result.errors.year);
  assert.ok(result.errors.current_km);
});

test("validateVehicleInput: yalnızca boşluk içeren alanlar dolu sayılmaz", () => {
  const result = validateVehicleInput({ plate: "   ", brand: "   ", model: "   ", year: 2020, current_km: 100 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.plate);
  assert.ok(result.errors.brand);
  assert.ok(result.errors.model);
});

test("validateVehicleInput: makul olmayan model yılı reddedilir", () => {
  const tooOld = validateVehicleInput({ plate: "34 ABC 1", brand: "X", model: "Y", year: 1900, current_km: 0 });
  assert.equal(tooOld.valid, false);
  assert.ok(tooOld.errors.year);

  const tooFuture = validateVehicleInput({ plate: "34 ABC 1", brand: "X", model: "Y", year: new Date().getFullYear() + 5, current_km: 0 });
  assert.equal(tooFuture.valid, false);
  assert.ok(tooFuture.errors.year);
});

test("validateVehicleInput: negatif kilometre reddedilir", () => {
  const result = validateVehicleInput({ plate: "34 ABC 1", brand: "X", model: "Y", year: 2020, current_km: -5 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.current_km);
});

test("validateVehicleInput: geçerli girdi valid=true döner ve normalize edilmiş değerleri taşır", () => {
  const result = validateVehicleInput({ plate: "06otoiz01", brand: " Toyota ", model: " Corolla ", year: "2020", current_km: "52430" });
  assert.equal(result.valid, true);
  assert.equal(Object.keys(result.errors).length, 0);
  assert.equal(result.normalized.plate, "06 OTOIZ 01");
  assert.equal(result.normalized.brand, "Toyota");
  assert.equal(result.normalized.model, "Corolla");
  assert.equal(result.normalized.year, 2020);
  assert.equal(result.normalized.current_km, 52430);
});

test("computeMaintenancePlan: varsayılan plan güncel km + 10.000 / +12 ay üretir", () => {
  const plan = computeMaintenancePlan({ currentKm: 132000, planType: "default", today: "2026-09-19" });
  assert.equal(plan.nextServiceKm, 142000);
  assert.equal(plan.nextServiceDate, "2027-09-19");
});

test("computeMaintenancePlan: +15.000/12 ay ve +10.000/6 ay alternatifleri doğru hesaplanır", () => {
  const extendedKm = computeMaintenancePlan({ currentKm: 52430, planType: "extended_km", today: "2026-09-19" });
  assert.equal(extendedKm.nextServiceKm, 67430);
  assert.equal(extendedKm.nextServiceDate, "2027-09-19");

  const extendedMonths = computeMaintenancePlan({ currentKm: 52430, planType: "extended_months", today: "2026-09-19" });
  assert.equal(extendedMonths.nextServiceKm, 62430);
  assert.equal(extendedMonths.nextServiceDate, "2027-03-19");
});

test("computeMaintenancePlan: 'sonra belirle' km/tarihi null bırakır", () => {
  const plan = computeMaintenancePlan({ currentKm: 52430, planType: "later" });
  assert.equal(plan.nextServiceKm, null);
  assert.equal(plan.nextServiceDate, null);
});

test("computeMaintenancePlan: özel plan verilen değerleri aynen kullanır", () => {
  const plan = computeMaintenancePlan({ currentKm: 52430, planType: "custom", customNextKm: "70000", customNextDate: "2027-01-01" });
  assert.equal(plan.nextServiceKm, 70000);
  assert.equal(plan.nextServiceDate, "2027-01-01");
});

test("isValidNextServiceKm: mevcut km'den küçük/eşit mutlak sonraki km reddedilir", () => {
  assert.equal(isValidNextServiceKm(132000, 10000), false);
  assert.equal(isValidNextServiceKm(132000, 132000), false);
  assert.equal(isValidNextServiceKm(132000, 142000), true);
  assert.equal(isValidNextServiceKm(132000, null), true);
});

test("describeMaintenancePlan: km veya tarih varsa 'Planlanmadı' göstermez", () => {
  const onlyKm = describeMaintenancePlan({ nextServiceKm: 62430, nextServiceDate: null });
  assert.equal(onlyKm.hasPlan, true);
  assert.equal(onlyKm.label, "62.430 km");

  const none = describeMaintenancePlan({ nextServiceKm: null, nextServiceDate: null });
  assert.equal(none.hasPlan, false);
  assert.equal(none.label, "Planlanmadı");
});
