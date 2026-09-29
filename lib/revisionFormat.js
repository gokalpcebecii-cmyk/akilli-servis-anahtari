"use strict";

// OTOİZ P1 — servis kaydı düzeltme geçmişinin okunur hâle getirilmesi (unit testli).
// Kaynak: public.maintenance_record_history() (audit_log 'maintenance_record_revised').
const FIELD_LABELS = {
  service_date: "Servis tarihi",
  km_at_service: "Kilometre",
  description: "Yapılan işlem",
  cost: "Tutar",
};

function formatValue(field, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "km_at_service") return `${Number(v).toLocaleString("tr-TR")} km`;
  if (field === "cost") return `${Number(v).toLocaleString("tr-TR")} ₺`;
  if (field === "service_date") {
    const d = new Date(String(v).length === 10 ? `${v}T12:00:00Z` : v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  }
  return String(v);
}

// Tek revizyon → [{ label, from, to }]; yalnız kullanıcıya anlamlı alanlar.
function describeChanges(rev) {
  const fields = Array.isArray(rev && rev.changed_fields) ? rev.changed_fields : Object.keys((rev && rev.new_values) || {});
  const out = [];
  for (const f of fields) {
    if (!FIELD_LABELS[f]) continue;
    out.push({ field: f, label: FIELD_LABELS[f], from: formatValue(f, rev.old_values && rev.old_values[f]), to: formatValue(f, rev.new_values && rev.new_values[f]) });
  }
  return out;
}

// record_id → revizyonlar (en yeni önce)
function groupByRecord(list) {
  const map = {};
  for (const r of Array.isArray(list) ? list : []) {
    (map[r.record_id] = map[r.record_id] || []).push(r);
  }
  for (const k of Object.keys(map)) map[k].sort((a, b) => (b.revision || 0) - (a.revision || 0));
  return map;
}

module.exports = { FIELD_LABELS, formatValue, describeChanges, groupByRecord };
