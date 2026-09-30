"use strict";

// OTOİZ Nihai UX — "Bireysel Geçmiş Kaydı" (son 12 aylık başlangıç geçmişi +
// zaman çizelgesindeki "Geçmiş İşlem Ekle"). Saf yardımcılar (unit testli).
//
// Veritabanı değişmedi: geçmiş kaydı, araç sahibinin (tenant_id = null)
// geçmiş bir işlem tarihiyle yazdığı normal bir bakım kaydıdır. Zaman
// çizelgesinde "Bireysel Geçmiş Kaydı" rozeti, kaydın işlem tarihi
// (service_date) kaydın OTOİZ'e girildiği günden (created_at, İstanbul)
// önce olduğunda gösterilir — servis doğrulamalı kayıt gibi görünmez.
const { ITEM_LABELS, DEFAULT_INTERVALS, PERIODIC_KEYS, CHIP_LABELS } = require("./maintenanceItems");
const { computeAutoNextServicePlan } = require("./logic");

const NOTE_MAX = 200;
const OTHER_MAX = 80;

function istanbulDateOf(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Zaman çizelgesi satırı bir bireysel geçmiş kaydı mı?
function isHistoryEvent(ev) {
  if (!ev || ev.kind !== "record" || ev.source !== "owner") return false;
  const entered = ev.event_ts ? istanbulDateOf(ev.event_ts) : null;
  return !!(entered && ev.event_date && String(ev.event_date) < entered);
}

function isIsoDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function emptyEntry() {
  return { date: "", km: "", items: [], otherOn: false, otherText: "", note: "" };
}

// Tek geçmiş kaydı doğrulaması. kind: "bakim" (işlem seçimi zorunlu, km
// zorunlu) | "diger" (açıklama zorunlu, km isteğe bağlı).
// Dönüş: { field, message } ya da null.
function validateHistoryEntry(entry, { today, currentKm, minDate = "2000-01-01", kind = "bakim" } = {}) {
  const e = entry || {};
  if (!e.date) return { field: "date", message: "İşlem tarihini seçin." };
  if (!isIsoDate(e.date)) return { field: "date", message: "Geçerli bir tarih seçin." };
  if (today && e.date > today) return { field: "date", message: "İşlem tarihi ileri bir tarih olamaz." };
  if (e.date < minDate) return { field: "date", message: "İşlem tarihi çok eski görünüyor; tarihi kontrol edin." };

  const kmStr = e.km == null ? "" : String(e.km);
  if (kmStr === "" && kind === "bakim") return { field: "km", message: "O tarihteki kilometreyi girin." };
  if (kmStr !== "") {
    const km = Number(kmStr);
    if (!Number.isInteger(km) || km < 0) return { field: "km", message: "Geçerli bir kilometre girin." };
    if (currentKm != null && currentKm !== "" && km > Number(currentKm)) {
      return { field: "km", message: `Kilometre, aracın güncel kilometresinden (${Number(currentKm).toLocaleString("tr-TR")} km) büyük olamaz.` };
    }
  }

  if (kind === "diger") {
    if (!String(e.otherText || "").trim()) return { field: "items", message: "Yapılan işlemi kısaca yazın." };
    return null;
  }
  const hasItems = Array.isArray(e.items) && e.items.length > 0;
  const hasOther = !!(e.otherOn && String(e.otherText || "").trim());
  if (!hasItems && !hasOther) return { field: "items", message: "En az bir işlem seçin ya da 'Diğer' ile yazın." };
  if (e.otherOn && !hasOther && !hasItems) return { field: "items", message: "Diğer işlem için kısa bir açıklama yazın." };
  return null;
}

// Kayıt açıklaması: servis hızlı kayıtla aynı biçim ("A, B — Not: …").
function historyDescription(entry, labels = ITEM_LABELS) {
  const e = entry || {};
  const parts = (Array.isArray(e.items) ? e.items : []).map((k) => labels[k] || k);
  const other = String(e.otherText || "").trim().replace(/\s+/g, " ").slice(0, OTHER_MAX);
  if ((e.otherOn || parts.length === 0) && other) parts.push(other);
  const note = String(e.note || "").trim().replace(/\s+/g, " ").slice(0, NOTE_MAX);
  return parts.join(", ") + (note ? ` — Not: ${note}` : "");
}

function newer(a, b) {
  // a, b: { date, km } — tarih, eşitse km büyük olan daha yeni.
  if (!b) return true;
  if (a.date !== b.date) return a.date > b.date;
  return Number(a.km || 0) > Number(b.km || 0);
}

// Her bakım kalemi için geçmişteki EN SON işlem → maintenance_items güncellemesi.
// Mevcut kalemin son tarihi daha yeniyse dokunulmaz (geçmiş kaydı daha yeni
// bir servis kaydını ezmez).
function itemUpdatesFromHistory(entries, existingItems = [], intervals = DEFAULT_INTERVALS) {
  const latestByKey = {};
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || e.km === "" || e.km == null) continue;
    for (const k of Array.isArray(e.items) ? e.items : []) {
      const cand = { date: e.date, km: Number(e.km) };
      if (newer(cand, latestByKey[k])) latestByKey[k] = cand;
    }
  }
  const out = [];
  for (const [key, h] of Object.entries(latestByKey)) {
    const ex = (existingItems || []).find((m) => m.item_key === key);
    if (ex && ex.last_service_date && String(ex.last_service_date) > h.date) continue;
    const iv = ex && ex.interval_km ? Number(ex.interval_km) : intervals[key] ?? null;
    out.push({ item_key: key, last_service_date: h.date, last_service_km: h.km, interval_km: iv });
  }
  return out;
}

// KRİTİK: sonraki bakım, OTOİZ'e kayıt tarihinden DEĞİL, periyodik bakım
// içeren EN SON geçmiş kaydının tarihi ve km'sinden başlar: taban +10.000 km
// / +12 ay; o kayıttaki işlemlerden biri daha kısa periyot gösteriyorsa o
// kazanır (servis hızlı kayıtla aynı kural). Periyodik işlem yoksa ya da
// araçta daha yeni bir kayıt varsa null (mevcut plan korunur).
function planFromHistory(entries, { existingLatestDate = null, existingItems = [], intervals = DEFAULT_INTERVALS } = {}) {
  let latest = null;
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !e.date || e.km === "" || e.km == null) continue;
    const items = Array.isArray(e.items) ? e.items : [];
    if (!items.some((k) => PERIODIC_KEYS.includes(k))) continue;
    const cand = { date: e.date, km: Number(e.km), items };
    if (newer(cand, latest)) latest = cand;
  }
  if (!latest) return null;
  if (existingLatestDate && String(existingLatestDate) > latest.date) return null;
  const sel = {};
  for (const k of latest.items) {
    const ex = (existingItems || []).find((m) => m.item_key === k);
    const iv = ex && ex.interval_km ? Number(ex.interval_km) : intervals[k];
    if (iv) sel[k] = String(iv);
  }
  const p = computeAutoNextServicePlan({ currentKm: latest.km, today: latest.date, selectedItemIntervals: sel });
  return { fromDate: latest.date, fromKm: latest.km, nextServiceKm: p.nextServiceKm, nextServiceDate: p.nextServiceDate };
}

// 12 ay önceki gün (varsayılan tarih önerisi / ipucu için).
function monthsAgoIso(today, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ""));
  if (!m) return null;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) - months;
  const y = Math.floor(total / 12);
  const mo = total % 12;
  const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return `${y}-${String(mo + 1).padStart(2, "0")}-${String(Math.min(Number(m[3]), dim)).padStart(2, "0")}`;
}

// Nihai UX son düzenleme — onboarding özet kartı: "20 Mart 2026 · 68.000 km"
// ve "Hava Filtresi · Ön Fren Balatası".
const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function fmtLongDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  return `${Number(m[3])} ${TR_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function entrySummary(entry, labels = CHIP_LABELS) {
  const e = entry || {};
  const head = [fmtLongDate(e.date), e.km !== "" && e.km != null ? `${Number(e.km).toLocaleString("tr-TR")} km` : null].filter(Boolean).join(" · ");
  const parts = (Array.isArray(e.items) ? e.items : []).map((k) => labels[k] || ITEM_LABELS[k] || k);
  const other = String(e.otherText || "").trim().replace(/\s+/g, " ").slice(0, OTHER_MAX);
  if (e.otherOn && other) parts.push(other);
  return { head, items: parts.join(" · "), note: String(e.note || "").trim() };
}

// Hiçbir alanı doldurulmamış kayıt (onboarding'de açık boş form yok sayılır).
function isBlankEntry(entry) {
  const e = entry || {};
  return !e.date && (e.km === "" || e.km == null) && !(Array.isArray(e.items) && e.items.length) && !String(e.otherText || "").trim() && !String(e.note || "").trim();
}

module.exports = {
  NOTE_MAX,
  fmtLongDate,
  entrySummary,
  isBlankEntry,
  istanbulDateOf,
  isHistoryEvent,
  emptyEntry,
  validateHistoryEntry,
  historyDescription,
  itemUpdatesFromHistory,
  planFromHistory,
  monthsAgoIso,
};
