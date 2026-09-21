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
  isValidNextServiceDate,
  isValidCurrentKmUpdate,
  computeAutoNextServicePlan,
  describeMaintenancePlan,
  todayIsoIstanbul,
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

// ---------------------------------------------------------------------
// İkinci düzeltme turu, madde 8: ek kabul testleri
// ---------------------------------------------------------------------

test("madde 8: normalize edilmiş mükerrer plaka — farklı yazımlar aynı kanonik forma indirgenir", () => {
  const variants = ["06 OTOIZ 01", "06otoiz01", "06-otoiz-01", " 06  OTOIZ   01 "];
  const canonical = variants.map((v) => normalizePlate(v));
  for (const c of canonical) {
    assert.equal(c, "06 OTOIZ 01");
  }
});

test("madde 8: isValidNextServiceDate — geçmiş tarih reddedilir, bugün/gelecek kabul edilir", () => {
  assert.equal(isValidNextServiceDate("2026-09-19", "2026-09-20"), false, "dün reddedilmeli");
  assert.equal(isValidNextServiceDate("2026-09-20", "2026-09-20"), true, "bugün kabul edilmeli");
  assert.equal(isValidNextServiceDate("2026-09-21", "2026-09-20"), true, "yarın kabul edilmeli");
  assert.equal(isValidNextServiceDate(null, "2026-09-20"), true, "boş tarih (plan yok) her zaman geçerli");
});

test("madde 8: 132.000 km → varsayılan plan 142.000 km hesaplar (+10.000 km / 12 ay)", () => {
  const plan = computeMaintenancePlan({ currentKm: 132000, planType: "default", today: "2026-09-19" });
  assert.equal(plan.nextServiceKm, 142000);
  assert.equal(isValidNextServiceKm(132000, plan.nextServiceKm), true);
});

test("madde 8: güncel kilometreden düşük sonraki bakım değeri her zaman reddedilir (132.000 → 130.000)", () => {
  assert.equal(isValidNextServiceKm(132000, 130000), false);
});

// ---------------------------------------------------------------------
// Pilot bugfix turu — araç düzenleme ve servis hızlı bakım kaydında
// sonraki bakım km/tarihinin yanlışlıkla ezilmesini engelleme
// ---------------------------------------------------------------------

test("todayIsoIstanbul: YYYY-MM-DD biçiminde, gerçek bugüne (UTC gün farkı içinde) yakın bir tarih döner", () => {
  const iso = todayIsoIstanbul();
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
  const utcToday = new Date().toISOString().slice(0, 10);
  const diffDays = Math.abs((new Date(iso).getTime() - new Date(utcToday).getTime()) / 86400000);
  assert.ok(diffDays <= 1, "İstanbul günü, UTC gününden en fazla 1 gün farklı olmalı");
});

test("isValidCurrentKmUpdate: yeni km eski km'den düşükse reddedilir, eşit/büyükse kabul edilir", () => {
  assert.equal(isValidCurrentKmUpdate(40000, 39999), false);
  assert.equal(isValidCurrentKmUpdate(40000, 40000), true);
  assert.equal(isValidCurrentKmUpdate(40000, 40001), true);
  assert.equal(isValidCurrentKmUpdate(40000, ""), false);
  assert.equal(isValidCurrentKmUpdate(null, 100), true, "önceki km bilinmiyorsa her değer kabul edilir");
});

test("computeAutoNextServicePlan: hiç periyot yoksa (veya hepsi varsayılandan geç) varsayılan +10.000 km / 12 ay döner", () => {
  const plan = computeAutoNextServicePlan({ currentKm: 40000, today: "2026-09-19", selectedItemIntervals: {} });
  assert.equal(plan.nextServiceKm, 50000);
  assert.equal(plan.nextServiceDate, "2027-09-19");

  const withLateInterval = computeAutoNextServicePlan({
    currentKm: 40000,
    today: "2026-09-19",
    selectedItemIntervals: { lastik: 40000 }, // 40000+40000=80000, varsayılan 50000'den GEÇ
  });
  assert.equal(withLateInterval.nextServiceKm, 50000, "varsayılandan daha geç bir periyot varsayılanı EZMEMELİ");
});

test("computeAutoNextServicePlan: seçili işlemlerden DAHA ERKEN periyodu olan kazanır", () => {
  // Motor Yağı: +10.000 (vade 50.000) — Hava Filtresi: +15.000 (vade 55.000).
  // İkisi de varsayılan tabanla (50.000) AYNI/GEÇ; erken kazanan senaryo
  // için 5.000 km periyotlu bir kalem eklenir (vade 45.000 < 50.000).
  const plan = computeAutoNextServicePlan({
    currentKm: 40000,
    today: "2026-09-19",
    selectedItemIntervals: { motor_yagi: 10000, fren_on_balata: 5000 },
  });
  assert.equal(plan.nextServiceKm, 45000, "5.000 km periyotlu kalem (vade 45.000) en erken olmalı");
});

test("computeAutoNextServicePlan: manuel giriş yokken bu fonksiyonun sonucu ARACIN ESKİ next_service_km'inden bağımsızdır", () => {
  // Bu, panel/[id] sayfasındaki "eski plan sessizce manuel giriş sanılıp
  // otomatik öneriyi ezmesin" hatasının kök nedenini doğrudan test eder:
  // fonksiyon aracın ESKİ next_service_km/next_service_date değerini HİÇ
  // PARAMETRE olarak ALMAZ — yalnızca güncel km + seçili periyotlardan
  // hesaplar.
  const staleOldNextServiceKm = 999999; // aracın DB'deki eski (alakasız) planı
  const plan = computeAutoNextServicePlan({ currentKm: 40000, today: "2026-09-19", selectedItemIntervals: { motor_yagi: 10000 } });
  assert.notEqual(plan.nextServiceKm, staleOldNextServiceKm);
  assert.equal(plan.nextServiceKm, 50000);
});

test("madde 8: beş bakım planı seçeneği — hesapla → describeMaintenancePlan ile göster → aynı girdiyle tekrar hesapla tutarlı (kaydet/yenile simülasyonu)", () => {
  const currentKm = 52430;
  const today = "2026-09-19";
  const planTypes = ["default", "extended_km", "extended_months", "custom", "later"];

  for (const planType of planTypes) {
    const opts = planType === "custom" ? { customNextKm: "70000", customNextDate: "2027-06-01" } : {};
    const firstCompute = computeMaintenancePlan({ currentKm, planType, today, ...opts });
    const shown = describeMaintenancePlan({ nextServiceKm: firstCompute.nextServiceKm, nextServiceDate: firstCompute.nextServiceDate });

    // "Yenileme" (sayfa yenilenip aynı kayıttan tekrar okunması) simülasyonu:
    // DB'den geri okunan ham next_service_km/next_service_date değerleri
    // describeMaintenancePlan'a tekrar verildiğinde AYNI etiketi üretmeli —
    // tutarsızlık (ör. "Planlanmadı" + "Sonraki bakım: X km" çelişkisi,
    // PILOT FIX 03 madde A4) olmamalı.
    const reloaded = describeMaintenancePlan({ nextServiceKm: firstCompute.nextServiceKm, nextServiceDate: firstCompute.nextServiceDate });
    assert.deepEqual(reloaded, shown, `${planType} planı yeniden yüklendiğinde tutarlı kalmalı`);

    if (planType === "later") {
      assert.equal(shown.hasPlan, false);
    } else {
      assert.equal(shown.hasPlan, true);
    }
  }
});
