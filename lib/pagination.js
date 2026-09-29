"use strict";

// OTOİZ P1 — keyset (cursor) sayfalama yardımcıları (unit testli).
// Sıralama her yerde (created_at desc, id desc). Cursor, son satırın
// (created_at, id) çiftidir; base64url JSON olarak taşınır. Sayfa sınırı
// sabittir: istemci büyük sayfa isteyerek tüm tabloyu çekemez.
const PAGE_SIZE = 50;
const TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(createdAt, id) {
  if (!createdAt || !id) return null;
  return Buffer.from(JSON.stringify({ t: String(createdAt), id: String(id) })).toString("base64url");
}

function decodeCursor(raw) {
  if (!raw || typeof raw !== "string" || raw.length > 200) return null;
  try {
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!o || typeof o.t !== "string" || typeof o.id !== "string") return null;
    // Zaman damgası AYNEN korunur (mikrosaniye): milisaniyeye yuvarlamak
    // sayfa sınırındaki satırları atlatır.
    if (!UUID_RE.test(o.id) || !TS_RE.test(o.t) || Number.isNaN(Date.parse(o.t))) return null;
    return { t: o.t, id: o.id.toLowerCase() };
  } catch {
    return null;
  }
}

// PostgREST "or" filtresi: (created_at, id) < (t, id)
function keysetOrFilter(cur, col = "created_at") {
  if (!cur) return null;
  return `${col}.lt.${cur.t},and(${col}.eq.${cur.t},id.lt.${cur.id})`;
}

// Arama anahtarı: plate_key (A-Z0-9) ile birebir aynı normalizasyon;
// PostgREST like/or sözdizimini bozacak karakter kalmaz.
function plateKeyQuery(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

// limit+1 satır istenir; fazladan satır varsa bir sonraki sayfa vardır.
function splitPage(rows, size = PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const page = list.slice(0, size);
  const last = page[page.length - 1];
  return { rows: page, hasMore: list.length > size, nextCursor: list.length > size && last ? encodeCursor(last.created_at, last.id) : null };
}

module.exports = { PAGE_SIZE, encodeCursor, decodeCursor, keysetOrFilter, plateKeyQuery, splitPage };
