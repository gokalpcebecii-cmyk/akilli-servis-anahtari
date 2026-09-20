function kmRemaining(currentKm, nextServiceKm) {
  if (nextServiceKm == null) return null;
  return nextServiceKm - currentKm;
}

function daysRemaining(todayISO, nextServiceDateISO) {
  if (!nextServiceDateISO) return null;
  const today = new Date(todayISO);
  const target = new Date(nextServiceDateISO);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function shouldSendReminder({ currentKm, nextServiceKm, nextServiceDateISO, todayISO, reminderKmBefore, reminderDaysBefore }) {
  const kmLeft = kmRemaining(currentKm, nextServiceKm);
  const daysLeft = daysRemaining(todayISO, nextServiceDateISO);

  const kmTrigger = kmLeft != null && kmLeft <= reminderKmBefore;
  const dateTrigger = daysLeft != null && daysLeft <= reminderDaysBefore;

  return kmTrigger || dateTrigger;
}

function prepareOwnershipTransfer(previousCustomer, transferDateISO) {
  if (!previousCustomer) {
    return {
      anonymizedSnapshot: { note: "onceki sahip kaydi yok", transfer_date: transferDateISO },
      fieldsToErase: [],
    };
  }

  return {
    anonymizedSnapshot: {
      had_owner: true,
      owner_since_unknown: true,
      transfer_date: transferDateISO,
    },
    fieldsToErase: ["full_name", "phone", "email"],
  };
}

function anonymizeCustomerRecord() {
  return {
    full_name: "Silinmis Kullanici",
    phone: null,
    email: null,
  };
}

// ============ PILOT FIX 03 — paylaşılan doğrulama/iş mantığı ============
// Bu fonksiyonlar HEM istemci (React formu, anında geri bildirim) HEM
// sunucu (app/api/vehicles/route.ts, gerçek kayıt katmanı) tarafından
// AYNI kod üzerinden çağrılır — "istemci doğrulaması yanında sunucu
// tarafında da aynı doğrulama yapılacak" gereksinimi böyle sağlanıyor.

// Plaka kanonikleştirme: "06otoiz01", "06 OTOIZ 01", "06-otoiz-01" gibi
// tüm ayraç varyasyonlarını AYNI okunabilir kanonik forma indirger —
// önce tüm boşluk/tire ayraçları silinir, sonra rakam/harf grupları
// tek boşlukla yeniden birleştirilir (Türk plaka biçimine benzer,
// "06 OTOIZ 01"). Böylece üçü de birebir aynı sonuca yakınsar.
function normalizePlate(raw) {
  if (raw == null) return "";
  const cleaned = String(raw)
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  const parts = cleaned.match(/[0-9]+|[A-ZÇĞİÖŞÜ]+/g) || [];
  return parts.join(" ");
}

// Arama/karşılaştırma anahtarı: ayraçtan tamamen bağımsız, sadece
// alfanümerik + büyük harf. Kullanıcı "otoiz01" yazsa bile depoda
// "06 OTOIZ 01" olarak duran plakayı bulabilsin diye hem aranan hem
// aranılan değer bu fonksiyondan geçirilip öyle karşılaştırılır.
function plateSearchKey(raw) {
  if (raw == null) return "";
  return String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, "");
}

// Araç oluşturma formu — hem bireysel hem servis tarafında AYNI kural
// seti. requireCurrentKm: servis "Hızlı Bakım" akışında da artık zorunlu
// (bkz. PILOT FIX 03 madde A1). Dönüş: { valid, errors } — errors alan
// adına göre anahtarlanmış TEK (ilk) hata mesajı taşır, formda "ilk hata
// alanına odaklan" davranışı için sırayla kontrol edilir.
function validateVehicleInput({ plate, brand, model, year, current_km }) {
  const errors = {};
  const currentYear = new Date().getFullYear();

  const normalizedPlate = normalizePlate(plate);
  if (!normalizedPlate) {
    errors.plate = "Plaka zorunlu.";
  }

  const trimmedBrand = typeof brand === "string" ? brand.trim() : "";
  if (!trimmedBrand) {
    errors.brand = "Marka zorunlu.";
  }

  const trimmedModel = typeof model === "string" ? model.trim() : "";
  if (!trimmedModel) {
    errors.model = "Model zorunlu.";
  }

  const yearNum = typeof year === "number" ? year : parseInt(year, 10);
  if (year === "" || year == null || Number.isNaN(yearNum) || !Number.isInteger(yearNum) || yearNum < 1950 || yearNum > currentYear + 1) {
    errors.year = `Model yılı 1950 ile ${currentYear + 1} arasında olmalı.`;
  }

  const kmNum = typeof current_km === "number" ? current_km : parseInt(current_km, 10);
  if (current_km === "" || current_km == null || Number.isNaN(kmNum) || !Number.isInteger(kmNum) || kmNum < 0) {
    errors.current_km = "Güncel kilometre zorunlu ve negatif olmayan bir sayı olmalı.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: { plate: normalizedPlate, brand: trimmedBrand, model: trimmedModel, year: yearNum, current_km: kmNum },
  };
}

// Bakım planı hesaplama — "next_maintenance_km" HER ZAMAN mutlak km'dir
// (periyot değil). Tüm liste/kart/detay bileşenleri aracın ham
// next_service_km/next_service_date alanlarını değil, BU fonksiyonun
// (veya describeMaintenancePlan'ın) çıktısını kullanır — tek kaynak.
function computeMaintenancePlan({ currentKm, planType, customNextKm, customNextDate, today }) {
  const km = Number(currentKm) || 0;
  const todayDate = today ? new Date(today) : new Date();

  function addMonthsIso(months) {
    const d = new Date(todayDate.getTime());
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }

  switch (planType) {
    case "extended_km":
      return { nextServiceKm: km + 15000, nextServiceDate: addMonthsIso(12) };
    case "extended_months":
      return { nextServiceKm: km + 10000, nextServiceDate: addMonthsIso(6) };
    case "custom": {
      const customKmNum = customNextKm === "" || customNextKm == null ? null : Number(customNextKm);
      return { nextServiceKm: customKmNum, nextServiceDate: customNextDate || null };
    }
    case "later":
      return { nextServiceKm: null, nextServiceDate: null };
    case "default":
    default:
      return { nextServiceKm: km + 10000, nextServiceDate: addMonthsIso(12) };
  }
}

// Özel plan girişinin geçerliliği: mutlak sonraki km, güncel km'den
// büyük olmalı (ör. güncel 132.000 iken 10.000 veya 132.000 kabul
// edilemez — bkz. PILOT FIX 03 madde A4).
function isValidNextServiceKm(currentKm, nextServiceKm) {
  if (nextServiceKm == null) return true;
  return Number(nextServiceKm) > Number(currentKm || 0);
}

// Bir aracın "planlı bakımı var mı" sorusunun TEK doğru cevabı — liste,
// özet kartı ve detay sayfası aynı anda birbirini yalanlamasın diye
// (ör. aynı ekranda hem "Planlı bakım yok" hem "Sonraki bakım: 62.430 km"
// görünmesi PILOT FIX 03'ün kapattığı asıl hata).
function describeMaintenancePlan({ nextServiceKm, nextServiceDate }) {
  const hasPlan = nextServiceKm != null || !!nextServiceDate;
  if (!hasPlan) {
    return { hasPlan: false, label: "Planlanmadı" };
  }
  const parts = [];
  if (nextServiceKm != null) parts.push(`${Number(nextServiceKm).toLocaleString("tr-TR")} km`);
  if (nextServiceDate) parts.push(new Date(nextServiceDate).toLocaleDateString("tr-TR"));
  return { hasPlan: true, label: parts.join(" · ") };
}

module.exports = {
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
};
