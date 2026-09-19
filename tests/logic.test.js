const test = require("node:test");
const assert = require("node:assert/strict");

const {
  kmRemaining,
  daysRemaining,
  shouldSendReminder,
  prepareOwnershipTransfer,
  anonymizeCustomerRecord,
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
