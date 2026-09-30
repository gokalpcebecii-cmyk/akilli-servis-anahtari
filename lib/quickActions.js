"use strict";

// OTOİZ — Hızlı İşlem Alanı (araç ekranı "İşlem Ekle" alt penceresi).
// Saf yardımcılar (unit testli): bakım işlem listesi, bakım kaydı
// doğrulaması, sonraki bakım önerisi ve belge dosyası kontrolü.
const { PERIODIC_KEYS, DEFAULT_INTERVALS } = require("./maintenanceItems");
const { validateHistoryEntry } = require("./history");
const { computeAutoNextServicePlan, isValidNextServiceKm, isValidNextServiceDate } = require("./logic");

// Brifteki sırayla bakım işlemleri (sonda "Diğer" ayrı eklenir). Anahtarlar
// maintenance_items_item_key_check içinde zaten var; yeni anahtar yok.
const OWNER_ACTION_KEYS = [
  "motor_yagi",
  "yag_filtresi",
  "hava_filtresi",
  "polen_filtresi",
  "yakit_filtresi",
  "fren_balatasi",
  "fren_diski",
  "aku",
  "antifriz",
  "sanziman_yagi",
  "buji",
  "triger_seti",
  "lastik",
];

const DOC_TYPES = [
  { key: "fatura", label: "Fatura" },
  { key: "servis_fisi", label: "Servis Fişi" },
  { key: "muayene", label: "Muayene Belgesi" },
  { key: "sigorta", label: "Sigorta Belgesi" },
  { key: "kasko", label: "Kasko Belgesi" },
  { key: "diger", label: "Diğer" },
];
const DOC_TYPE_LABELS = Object.fromEntries(DOC_TYPES.map((t) => [t.key, t.label]));

const DOC_MAX_BYTES = 10 * 1024 * 1024;
const DOC_NOTE_MAX = 200;
// Uzantı → MIME. Bazı telefonlar dosya türünü boş gönderir; uzantıdan bulunur.
const DOC_MIME_BY_EXT = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};
const DOC_ALLOWED_MIME = Array.from(new Set(Object.values(DOC_MIME_BY_EXT)));
const DOC_ACCEPT = "application/pdf,image/*";

// Dosya kontrolü: yalnız PDF ve fotoğraf, en fazla 10 MB.
function checkDocumentFile(file) {
  if (!file || !file.name) return { ok: false, error: "Bir dosya seçin." };
  const m = /\.([a-z0-9]+)$/i.exec(String(file.name));
  const ext = m ? m[1].toLowerCase() : "";
  let mime = String(file.type || "").toLowerCase();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!mime || mime === "application/octet-stream") mime = DOC_MIME_BY_EXT[ext] || "";
  if (!DOC_ALLOWED_MIME.includes(mime)) return { ok: false, error: "Yalnız PDF veya fotoğraf (JPG, PNG, HEIC) yükleyebilirsiniz." };
  const size = Number(file.size) || 0;
  if (size <= 0) return { ok: false, error: "Dosya boş görünüyor; başka bir dosya seçin." };
  if (size > DOC_MAX_BYTES) return { ok: false, error: "Dosya en fazla 10 MB olabilir." };
  const outExt = DOC_MIME_BY_EXT[ext] === mime ? ext : Object.keys(DOC_MIME_BY_EXT).find((k) => DOC_MIME_BY_EXT[k] === mime);
  return { ok: true, mime, ext: outExt, size };
}

// Depolama yolu: "<araç id>/<rastgele id>.<uzantı>" (kullanıcının dosya adı
// yola girmez; RLS araç klasörüne göre kontrol eder).
function documentPath(vehicleId, id, ext) {
  return `${vehicleId}/${id}.${ext}`;
}

function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

// Bakım kaydı doğrulaması. Bugün tarihli kayıt: km, kayıtlı km'den düşük
// olamaz (km ilerler). Geçmiş tarihli kayıt: "Bireysel Geçmiş Kaydı" kuralı
// (km, güncel km'den büyük olamaz; ileri tarih yok).
function validateMaintenanceAction(entry, { today, currentKm, minDate = "2000-01-01" }) {
  const e = entry || {};
  if (e.date && e.date === today) {
    const kmStr = e.km == null ? "" : String(e.km);
    if (kmStr === "") return { field: "km", message: "Güncel kilometreyi girin." };
    const km = Number(kmStr);
    if (!Number.isInteger(km) || km <= 0) return { field: "km", message: "Geçerli bir kilometre girin." };
    if (currentKm != null && currentKm !== "" && km < Number(currentKm)) {
      return { field: "km", message: `Kilometre, kayıtlı son kilometreden (${Number(currentKm).toLocaleString("tr-TR")} km) düşük olamaz.` };
    }
    const err = validateHistoryEntry({ ...e, km: "1" }, { today, currentKm: null, minDate, kind: "bakim" });
    return err;
  }
  return validateHistoryEntry(e, { today, currentKm, minDate, kind: "bakim" });
}

// Sonraki bakım önerisi (yalnız bugün tarihli kayıtta, periyodik bakım
// işlemi seçildiyse): +10.000 km / 12 ay, seçilen işlemin daha kısa
// periyodu varsa o. Periyodik işlem yoksa mevcut plan korunur.
function nextServiceSuggestion({ items, km, today, intervalFor }) {
  const keys = Array.isArray(items) ? items : [];
  if (!keys.some((k) => PERIODIC_KEYS.includes(k))) return null;
  const kmNum = Number(km);
  if (!Number.isFinite(kmNum) || kmNum <= 0) return null;
  const sel = {};
  for (const k of keys) {
    const iv = intervalFor ? intervalFor(k) : DEFAULT_INTERVALS[k];
    if (iv) sel[k] = String(iv);
  }
  return computeAutoNextServicePlan({ currentKm: kmNum, today, selectedItemIntervals: sel });
}

// Bugün tarihli kaydın RPC'ye gidecek sonraki bakım değerleri. Öneri varsa
// o yazılır. Yoksa mevcut plan korunur; RPC geçersiz (km'si geride kalmış ya
// da tarihi geçmiş) değeri kabul etmediği için o kısım RPC'ye boş gider ve
// kayıttan sonra aynen geri yazılır (restore).
function visitNextValues({ suggestion, km, today, existingKm, existingDate }) {
  if (suggestion) return { rpc: { km: suggestion.nextServiceKm, date: suggestion.nextServiceDate }, restore: null };
  const kmNum = Number(km);
  const exKm = existingKm === "" || existingKm == null ? null : Number(existingKm);
  const exDate = existingDate || null;
  const kmOk = exKm == null || isValidNextServiceKm(kmNum, exKm);
  const dateOk = exDate == null || isValidNextServiceDate(exDate, today);
  const rpc = { km: kmOk ? exKm : null, date: dateOk ? exDate : null };
  const restore = kmOk && dateOk ? null : { next_service_km: exKm, next_service_date: exDate };
  return { rpc, restore };
}

module.exports = {
  OWNER_ACTION_KEYS,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_MAX_BYTES,
  DOC_NOTE_MAX,
  DOC_ALLOWED_MIME,
  DOC_ACCEPT,
  checkDocumentFile,
  documentPath,
  fmtSize,
  validateMaintenanceAction,
  nextServiceSuggestion,
  visitNextValues,
};
