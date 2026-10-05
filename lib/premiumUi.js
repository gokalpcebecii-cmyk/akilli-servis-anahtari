"use strict";

// OTOİZ Premium arayüz — yalnız SUNUM yardımcıları (unit testli).
// Hiçbir hesap/iş kuralı burada değişmez: bakım ve muayene durumu
// lib/vehicleStatus.js'den gelir, burada yalnız ekrandaki kısa ifadeye,
// gösterge doluluğuna ve filtreye çevrilir. Mekanik değerlendirme metni
// YOK (sağlık iddiası taşıyan ifade kullanılmaz).

const { fmtDate } = require("./vehicleStatus");

// Ana ekran bölümleri (alt gezinme). Sıra = alt çubuktaki sıra.
const SECTIONS = ["ana", "aracim", "belgeler", "bakim", "diger"];
// Alt gezinmede olmayan tam ekran görünümler (geri oku ile açılır).
const VIEWS = [...SECTIONS, "yaklasan", "muayene"];
const VIEW_NAV = { yaklasan: "bakim", muayene: "ana" };

function sectionFrom(value) {
  const v = String(value || "").toLowerCase();
  return VIEWS.includes(v) ? v : "ana";
}

// Görünüm → alt çubukta yanacak bölüm.
function navFor(view) {
  return VIEW_NAV[view] || (SECTIONS.includes(view) ? view : "ana");
}

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// "2026-09-12" → "12 Eylül 2026"
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS_TR[Number(m[2]) - 1]} ${m[1]}`;
}

function fmtKm(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "";
  return `${Math.round(Number(n)).toLocaleString("tr-TR")} km`;
}

// Kalan gün → kısa insan dili. 60 günden azsa gün, 24 aydan azsa ay, sonra yıl.
function remainingPhrase(days) {
  if (days == null || Number.isNaN(Number(days))) return "";
  const d = Number(days);
  if (d === 0) return "Bugün";
  if (d < 0) return `${Math.abs(d)} gün geçti`;
  if (d < 60) return `${d} gün kaldı`;
  const months = Math.floor(d / 30.44);
  if (months < 24) return `${months} ay kaldı`;
  return `${Math.floor(months / 12)} yıl kaldı`;
}

// Gösterge ortası için iki parça: { value: "7 ay", caption: "kaldı" }.
function remainingParts(days) {
  const p = remainingPhrase(days);
  if (!p) return { value: "", caption: "" };
  if (p === "Bugün") return { value: "Bugün", caption: "" };
  const m = /^(.*) (kaldı|geçti)$/.exec(p);
  return m ? { value: m[1], caption: m[2] } : { value: p, caption: "" };
}

// "Yaklaşık 3 ay" (yalnız gelecek için).
function approxPhrase(days) {
  if (days == null || Number(days) <= 0) return "";
  const d = Number(days);
  if (d < 45) return `Yaklaşık ${d} gün`;
  const months = Math.round(d / 30.44);
  return months >= 24 ? `Yaklaşık ${Math.round(months / 12)} yıl` : `Yaklaşık ${months} ay`;
}

// Bakım kısa durumu: seviye → ekrandaki kelime (mekanik iddia yok).
const MAINT_WORD = { ok: "Zamanında", soon: "Yaklaşıyor", late: "Gecikti", none: "Plan yok" };

function maintenanceWord(level) {
  return MAINT_WORD[level] || MAINT_WORD.none;
}

// Dairesel gösterge doluluğu (0..1): kalan / periyot. Gecikmede 1 (tam,
// kırmızı), veri yoksa 0.
function ringFraction(left, period) {
  if (left == null || !period) return 0;
  if (Number(left) <= 0) return 1;
  const f = Number(left) / Number(period);
  return Math.max(0.04, Math.min(1, f));
}

// Kayıt açıklaması ("Motor Yağı, Yağ Filtresi — Not: …") → işlem satırları.
function recordLines(title) {
  const t = String(title || "");
  const [head, note] = t.split(" — Not: ");
  const lines = head
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { lines: lines.length ? lines : [t.trim()].filter(Boolean), note: note ? note.trim() : "" };
}

// Bakım geçmişi filtresi: tümü / servis / kullanıcı (araç olayları yalnız
// "Tümü"nde görünür).
function filterTimeline(rows, filter) {
  const list = Array.isArray(rows) ? rows : [];
  if (filter === "servis") return list.filter((r) => r && r.kind === "record" && r.source === "service");
  if (filter === "kullanici") return list.filter((r) => r && r.kind === "record" && r.source === "owner");
  return list;
}

// En son SERVİS kaydı (yoksa null) — "Son servis" kartı.
function lastServiceRecord(rows) {
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && r.kind === "record" && r.source === "service") return r;
  }
  return null;
}

// Belgelerim filtresi: Tümü · Fatura · Servis Fişi · Diğer (diğer = geri kalan tüm türler).
const DOC_FILTERS = [
  { key: "tumu", label: "Tümü" },
  { key: "fatura", label: "Fatura" },
  { key: "servis_fisi", label: "Servis Fişi" },
  { key: "diger", label: "Diğer" },
];

function filterDocuments(docs, filter) {
  const list = Array.isArray(docs) ? docs : [];
  if (filter === "fatura" || filter === "servis_fisi") return list.filter((d) => d && d.doc_type === filter);
  if (filter === "diger") return list.filter((d) => d && d.doc_type !== "fatura" && d.doc_type !== "servis_fisi");
  return list;
}

function docCountPhrase(n) {
  if (n == null) return "";
  return n === 0 ? "Henüz belge yok" : `${n} belge kayıtlı`;
}

// Muayene özeti (gerçek veri): sonraki tarih vehicles.muayene_tarihi, son
// muayene kaydı varsa tarihi. Gösterge 2 yıllık periyot üzerinden.
const MUAYENE_PERIOD_DAYS = 730;

function muayeneView({ nextIso, daysLeft, level, lastIso }) {
  if (!nextIso) {
    return { empty: true, text: "Muayene bilgisi eklenmemiş.", value: "", caption: "", last: lastIso ? longDate(lastIso) : "", next: "", fraction: 0, level: "none" };
  }
  const parts = remainingParts(daysLeft);
  return {
    empty: false,
    text: remainingPhrase(daysLeft),
    value: parts.value,
    caption: parts.caption,
    last: lastIso ? longDate(lastIso) : "",
    next: longDate(nextIso),
    fraction: ringFraction(daysLeft, MUAYENE_PERIOD_DAYS),
    level,
  };
}

module.exports = {
  SECTIONS,
  VIEWS,
  sectionFrom,
  navFor,
  remainingParts,
  longDate,
  fmtKm,
  remainingPhrase,
  approxPhrase,
  maintenanceWord,
  ringFraction,
  recordLines,
  filterTimeline,
  lastServiceRecord,
  DOC_FILTERS,
  filterDocuments,
  docCountPhrase,
  MUAYENE_PERIOD_DAYS,
  muayeneView,
};
