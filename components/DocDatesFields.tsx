"use client";

// OTOİZ Aşama E.1: Sonraki Muayene, Kasko Bitiş ve Zorunlu Trafik Sigortası
// Bitiş tarihleri. Her alanın yanında anlık durum: 30 gün ve daha az kaldıysa
// SARI, tarih geçtiyse KIRMIZI, tarih yoksa GRİ. Veritabanı kolonları
// (muayene_tarihi, kasko_bitis, trafik_sigortasi_bitis) değişmedi.
import { colors, inputStyle, labelStyle } from "@/lib/theme";
import { StatusPill } from "@/components/VehicleStatusPanel";
const { dateDueStatus, fmtDate } = require("@/lib/vehicleStatus");
const { todayIsoIstanbul } = require("@/lib/logic");

export const DOC_DATE_FIELDS = [
  { key: "muayene_tarihi", label: "Sonraki Muayene" },
  { key: "kasko_bitis", label: "Kasko Bitiş Tarihi" },
  { key: "trafik_sigortasi_bitis", label: "Zorunlu Trafik Sigortası Bitiş Tarihi" },
] as const;

export type DocDates = { muayene_tarihi?: string | null; kasko_bitis?: string | null; trafik_sigortasi_bitis?: string | null };

export function DocDatesFields({
  value,
  onChange,
  idPrefix = "belge",
}: {
  value: DocDates;
  onChange: (key: keyof DocDates, v: string) => void;
  idPrefix?: string;
}) {
  const today = todayIsoIstanbul();
  return (
    <fieldset data-testid="belge-tarihleri" style={{ border: "none", padding: 0, margin: "4px 0 12px" }}>
      <legend style={{ ...labelStyle, fontSize: 13.5, fontWeight: 800, color: colors.textDark, marginBottom: 8, padding: 0 }}>Muayene ve Sigorta Tarihleri</legend>
      {DOC_DATE_FIELDS.map((f) => {
        const v = (value as any)[f.key] || "";
        const st = dateDueStatus(v, today);
        const id = `${idPrefix}-${f.key}`;
        return (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <label htmlFor={id} style={{ ...labelStyle, margin: 0 }}>
                {f.label}
              </label>
              <span data-testid={`belge-durum-${f.key}`} data-level={st.level}>
                <StatusPill level={st.level} />
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id={id}
                data-field={f.key}
                type="date"
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                value={v}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
              {v && (
                <button
                  type="button"
                  aria-label={`${f.label} tarihini sil`}
                  onClick={() => onChange(f.key, "")}
                  style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surfaceLight, color: colors.textMuted, fontSize: 18, cursor: "pointer" }}
                >
                  ×
                </button>
              )}
            </div>
            {st.level !== "none" && (
              <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>
                {fmtDate(v)} · {st.daysLeft === 0 ? "bugün" : st.daysLeft < 0 ? `${Math.abs(st.daysLeft)} gün geçti` : `${st.daysLeft} gün kaldı`}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
