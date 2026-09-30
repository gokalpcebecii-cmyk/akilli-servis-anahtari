"use strict";

// OTOİZ Aşama E — araç zaman çizelgesi sunum yardımcıları (unit testli).
// Kaynak: public.vehicle_timeline() RPC'si (sayfalı, en yeni önce).
const { recordCategory, CATEGORY_LABELS } = require("./vehicleStatus");
const { isHistoryEvent } = require("./history");

const TIMELINE_PAGE = 20;

const SOURCE_LABELS = {
  service: "Servis Doğrulamalı",
  owner: "Bireysel Kayıt",
  owner_history: "Bireysel Geçmiş Kaydı",
  system: "Sistem / Araç Olayı",
};

// RPC yanıtını güvenli biçime getirir (mock/boş/hatalı yanıt ekranı kırmaz).
function normalizeTimelineResponse(data) {
  const o = data && !Array.isArray(data) && typeof data === "object" ? data : {};
  const rows = Array.isArray(o.rows) ? o.rows : [];
  return {
    rows,
    hasMore: o.has_more === true,
    total: typeof o.total === "number" ? o.total : rows.length,
  };
}

// Aynı olay iki sayfaya düşerse (araya yeni kayıt girmesi) tekrar gösterilmez.
function mergeTimelinePages(prev, next) {
  const seen = new Set((prev || []).map((r) => `${r.kind}:${r.id}`));
  const out = [...(prev || [])];
  for (const r of next || []) {
    const k = `${r.kind}:${r.id}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

// Olayın ekrandaki etiketi: kaynak + (kayıtsa) kategori.
function describeEvent(ev) {
  let source = SOURCE_LABELS[ev && ev.source] ? ev.source : "system";
  if (source === "owner" && isHistoryEvent(ev)) source = "owner_history";
  const category = ev && ev.kind === "record" ? recordCategory(ev.title) : null;
  return {
    source,
    sourceLabel: SOURCE_LABELS[source],
    category,
    categoryLabel: category && category !== "bakim" ? CATEGORY_LABELS[category] : null,
  };
}

// Yıl başlıklarıyla gruplama: [{ year, items }] (sıra korunur).
function groupByYear(rows) {
  const groups = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const year = String(r.event_date || "").slice(0, 4) || "—";
    const g = groups[groups.length - 1];
    if (g && g.year === year) g.items.push(r);
    else groups.push({ year, items: [r] });
  }
  return groups;
}

module.exports = { TIMELINE_PAGE, SOURCE_LABELS, normalizeTimelineResponse, mergeTimelinePages, describeEvent, groupByYear };
