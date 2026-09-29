"use strict";

// OTOİZ Aşama E — "Araç Durumu" ve "Sonraki Bakım" hesapları (unit testli).
//
// ÇOK ÖNEMLİ: OTOİZ mekanik teşhis yapmaz. Buradaki her durum YALNIZ kayıtlı
// tarih, kilometre, bakım periyodu ve kayıtlar üzerinden hesaplanır; hiçbir
// metin aracın mekanik sağlığı hakkında iddia taşımaz ("araç iyi durumda",
// "motor kötü" vb. YOK — tests/asamaE.test.js bunu denetler).
//
// Seviyeler: ok (YEŞİL, Uygun) · soon (SARI, Yaklaşıyor) · late (KIRMIZI,
// Gecikti) · none (GRİ, Veri Yok).

const KM_SOON = 1000; // bu kadar km veya daha az kaldıysa "yaklaşıyor"
const DAYS_SOON = 30; // bu kadar gün veya daha az kaldıysa "yaklaşıyor"
const DETAILING_MONTHS = 12;

const LEVELS = {
  ok: { label: "Uygun", color: "green" },
  soon: { label: "Yaklaşıyor", color: "yellow" },
  late: { label: "Gecikti", color: "red" },
  none: { label: "Veri Yok", color: "gray" },
};
const RANK = { none: 0, ok: 1, soon: 2, late: 3 };

const DISCLAIMER = "Durumlar yalnız kayıtlı tarih, kilometre ve bakım planına göre hesaplanır; mekanik değerlendirme değildir.";

function worst(a, b) {
  return RANK[b] > RANK[a] ? b : a;
}

function fmtKm(n) {
  return `${Math.abs(Math.round(Number(n))).toLocaleString("tr-TR")} km`;
}

function isoParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Takvim günü farkı (saat dilimi bağımsız: yalnız yıl/ay/gün).
function daysBetween(todayIso, targetIso) {
  const a = isoParts(todayIso);
  const b = isoParts(targetIso);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

function addMonthsIso(iso, months) {
  const p = isoParts(iso);
  if (!p) return null;
  const total = p[0] * 12 + (p[1] - 1) + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(p[2], dim)).padStart(2, "0")}`;
}

function fmtDate(iso) {
  const p = isoParts(iso);
  return p ? `${String(p[2]).padStart(2, "0")}.${String(p[1]).padStart(2, "0")}.${p[0]}` : "";
}

function levelForKm(kmLeft) {
  if (kmLeft == null) return "none";
  if (kmLeft <= 0) return "late";
  if (kmLeft <= KM_SOON) return "soon";
  return "ok";
}

function levelForDays(daysLeft, soonDays = DAYS_SOON) {
  if (daysLeft == null) return "none";
  if (daysLeft < 0) return "late";
  if (daysLeft <= soonDays) return "soon";
  return "ok";
}

function kmPhrase(kmLeft) {
  if (kmLeft == null) return null;
  if (kmLeft === 0) return "kilometre sınırına gelindi";
  return kmLeft < 0 ? `${fmtKm(kmLeft)} aşıldı` : `${fmtKm(kmLeft)} kaldı`;
}

function dayPhrase(daysLeft) {
  if (daysLeft == null) return null;
  if (daysLeft === 0) return "bugün";
  return daysLeft < 0 ? `${Math.abs(daysLeft)} gün geçti` : `${daysLeft} gün kaldı`;
}

// Sonraki bakım: hem tarih hem km varsa EN ERKEN kritik koşul belirler.
function nextServiceStatus({ currentKm, nextServiceKm, nextServiceDate, today }) {
  const hasKm = nextServiceKm != null && nextServiceKm !== "" && !Number.isNaN(Number(nextServiceKm));
  const hasDate = !!isoParts(nextServiceDate);
  if (!hasKm && !hasDate) {
    return { level: "none", driver: null, kmLeft: null, daysLeft: null, headline: "Plan belirlenmedi", detail: "Sonraki bakım için km veya tarih girilmemiş." };
  }
  const kmLeft = hasKm ? Number(nextServiceKm) - (Number(currentKm) || 0) : null;
  const daysLeft = hasDate ? daysBetween(today, nextServiceDate) : null;
  const kmLevel = hasKm ? levelForKm(kmLeft) : "none";
  const dayLevel = hasDate ? levelForDays(daysLeft) : "none";
  const level = worst(kmLevel, dayLevel);
  // Hangi koşul belirleyici: daha kötü seviye; eşitse kalan oranı daha az olan.
  let driver;
  if (RANK[kmLevel] !== RANK[dayLevel]) driver = RANK[kmLevel] > RANK[dayLevel] ? "km" : "date";
  else if (!hasKm) driver = "date";
  else if (!hasDate) driver = "km";
  else driver = kmLeft / KM_SOON <= daysLeft / DAYS_SOON ? "km" : "date";

  const headline = { late: "Bakım gecikti", soon: "Bakım yaklaşıyor", ok: "Bakım için zaman var" }[level];
  const parts = [];
  const first = driver === "km" ? kmPhrase(kmLeft) : dayPhrase(daysLeft);
  const second = driver === "km" ? dayPhrase(daysLeft) : kmPhrase(kmLeft);
  if (first) parts.push(first);
  if (second) parts.push(second);
  const target = [hasKm ? `${Number(nextServiceKm).toLocaleString("tr-TR")} km` : null, hasDate ? fmtDate(nextServiceDate) : null].filter(Boolean).join(" · ");
  return { level, driver, kmLeft, daysLeft, headline, detail: parts.join(" · "), target };
}

// Tarihi olan bir süre sonu (muayene, sigorta, kasko).
function dateDueStatus(dueIso, today, soonDays = DAYS_SOON) {
  if (!isoParts(dueIso)) return { level: "none", daysLeft: null };
  const daysLeft = daysBetween(today, dueIso);
  return { level: levelForDays(daysLeft, soonDays), daysLeft };
}

// Bakım kalemleri (maintenance_items): periyot km ve/veya ay üzerinden.
function itemStatus(item, currentKm, today) {
  if (!item) return { level: "none", kmLeft: null, daysLeft: null };
  let kmLeft = null;
  let daysLeft = null;
  if (item.interval_km && item.last_service_km != null) {
    kmLeft = Number(item.interval_km) - ((Number(currentKm) || 0) - Number(item.last_service_km));
  }
  if (item.interval_months && item.last_service_date) {
    daysLeft = daysBetween(today, addMonthsIso(item.last_service_date, Number(item.interval_months)));
  }
  const level = worst(kmLeft == null ? "none" : levelForKm(kmLeft), daysLeft == null ? "none" : levelForDays(daysLeft));
  return { level, kmLeft, daysLeft };
}

// Kayıt açıklamasından kategori (yalnız görsel etiket; kayıt değişmez).
function recordCategory(description) {
  const d = String(description || "").toLocaleLowerCase("tr-TR");
  if (/muayene/.test(d)) return "muayene";
  if (/(seramik|detailing|detay temizli|pasta|cila|kaplama|ppf|boya koruma|iç temizlik|koltuk temizli)/.test(d)) return "detailing";
  return "bakim";
}

const CATEGORY_LABELS = { muayene: "Muayene", detailing: "Detailing", bakim: "Bakım" };

function latestOf(records, category) {
  let best = null;
  for (const r of Array.isArray(records) ? records : []) {
    if (recordCategory(r.description) !== category) continue;
    if (!best || String(r.service_date) > String(best.service_date)) best = r;
  }
  return best;
}

// "Araç Durumu" kartları. items: maintenance_items; labels: item_key → ad.
// lastMuayene / lastDetailing: ilgili son kayıt ({ service_date }) ya da null.
function buildVehicleStatus({ vehicle, items, labels, lastMuayene, lastDetailing, today }) {
  const v = vehicle || {};
  const cards = [];
  const upcoming = [];

  // 1) Bakım
  const ns = nextServiceStatus({ currentKm: v.current_km, nextServiceKm: v.next_service_km, nextServiceDate: v.next_service_date, today });
  cards.push({ key: "bakim", title: "Bakım", level: ns.level, value: ns.level === "none" ? "Plan yok" : ns.headline, detail: ns.level === "none" ? ns.detail : ns.detail });
  if (ns.level === "soon" || ns.level === "late") upcoming.push({ key: "sonraki_bakim", title: "Periyodik bakım", level: ns.level, detail: ns.detail, sort: ns.driver === "km" ? ns.kmLeft / KM_SOON : ns.daysLeft / DAYS_SOON });

  // 2) Muayene (vehicles.muayene_tarihi = sonraki muayene tarihi)
  const mu = dateDueStatus(v.muayene_tarihi, today);
  let muDetail;
  if (mu.level === "none") muDetail = lastMuayene ? `Son muayene kaydı ${fmtDate(lastMuayene.service_date)} · sonraki tarih girilmedi` : "Sonraki muayene tarihi girilmedi.";
  else muDetail = `${fmtDate(v.muayene_tarihi)} · ${dayPhrase(mu.daysLeft)}`;
  cards.push({ key: "muayene", title: "Muayene", level: mu.level, value: mu.level === "none" ? "Tarih yok" : LEVELS[mu.level].label, detail: muDetail });
  if (mu.level === "soon" || mu.level === "late") upcoming.push({ key: "muayene", title: "Araç muayenesi", level: mu.level, detail: dayPhrase(mu.daysLeft), sort: mu.daysLeft / DAYS_SOON });

  // 3) Detailing (yalnız kayıt tarihinden)
  let dLevel = "none";
  let dDetail = "Detailing kaydı yok.";
  if (lastDetailing && isoParts(lastDetailing.service_date)) {
    const since = daysBetween(addMonthsIso(lastDetailing.service_date, DETAILING_MONTHS), today);
    dLevel = since > 0 ? "soon" : "ok";
    dDetail = `Son işlem ${fmtDate(lastDetailing.service_date)}${since > 0 ? " · 12 aydan eski" : ""}`;
  }
  cards.push({ key: "detailing", title: "Detailing", level: dLevel, value: dLevel === "none" ? "Kayıt yok" : LEVELS[dLevel].label, detail: dDetail });

  // 4) Belgeler (trafik sigortası, kasko bitişleri)
  const docs = [
    { key: "trafik", title: "Trafik sigortası", due: v.trafik_sigortasi_bitis },
    { key: "kasko", title: "Kasko", due: v.kasko_bitis },
  ]
    .map((d) => ({ ...d, st: dateDueStatus(d.due, today) }))
    .filter((d) => d.st.level !== "none");
  let docLevel = "none";
  let docDetail = "Belge bitiş tarihi girilmedi.";
  if (docs.length) {
    docs.sort((a, b) => a.st.daysLeft - b.st.daysLeft);
    docLevel = docs.reduce((acc, d) => worst(acc, d.st.level), "none");
    docDetail = docs.map((d) => `${d.title}: ${dayPhrase(d.st.daysLeft)}`).join(" · ");
    for (const d of docs) {
      if (d.st.level === "soon" || d.st.level === "late") upcoming.push({ key: d.key, title: `${d.title} bitişi`, level: d.st.level, detail: dayPhrase(d.st.daysLeft), sort: d.st.daysLeft / DAYS_SOON });
    }
  }
  cards.push({ key: "belgeler", title: "Belgeler", level: docLevel, value: docLevel === "none" ? "Tarih yok" : LEVELS[docLevel].label, detail: docDetail });

  // 5) Yaklaşan işlemler (bakım kalemleri dahil)
  for (const it of Array.isArray(items) ? items : []) {
    const st = itemStatus(it, v.current_km, today);
    if (st.level === "soon" || st.level === "late") {
      const byKm = st.kmLeft != null && levelForKm(st.kmLeft) === st.level;
      upcoming.push({
        key: `item_${it.item_key}`,
        title: (labels && labels[it.item_key]) || it.item_key,
        level: st.level,
        detail: byKm ? kmPhrase(st.kmLeft) : dayPhrase(st.daysLeft),
        sort: byKm ? st.kmLeft / KM_SOON : st.daysLeft / DAYS_SOON,
      });
    }
  }
  upcoming.sort((a, b) => RANK[b.level] - RANK[a.level] || a.sort - b.sort);
  const hasAnyPlan = ns.level !== "none" || mu.level !== "none" || docLevel !== "none" || (Array.isArray(items) && items.some((i) => i.interval_km || i.interval_months));
  const upLevel = upcoming.length ? upcoming.reduce((acc, u) => worst(acc, u.level), "none") : hasAnyPlan ? "ok" : "none";
  cards.push({
    key: "yaklasan",
    title: "Yaklaşan işlemler",
    level: upLevel,
    value: upcoming.length ? `${upcoming.length} işlem` : upLevel === "ok" ? "Yakın işlem yok" : "Plan yok",
    detail: upcoming.length ? upcoming.slice(0, 3).map((u) => `${u.title}: ${u.detail}`).join(" · ") : upLevel === "ok" ? `Önümüzdeki ${DAYS_SOON} gün / ${KM_SOON.toLocaleString("tr-TR")} km içinde işlem yok.` : "Takip edilecek plan yok.",
  });

  return { cards, upcoming, nextService: ns };
}

module.exports = {
  KM_SOON,
  DAYS_SOON,
  LEVELS,
  DISCLAIMER,
  CATEGORY_LABELS,
  daysBetween,
  addMonthsIso,
  nextServiceStatus,
  dateDueStatus,
  itemStatus,
  recordCategory,
  latestOf,
  buildVehicleStatus,
  fmtDate,
};
