"use client";

// OTOİZ Aşama E.1: Sonraki Muayene, Kasko Bitiş ve Zorunlu Trafik Sigortası
// Bitiş tarihleri. Her alanın yanında anlık durum: 30 gün ve daha az kaldıysa
// SARI, tarih geçtiyse KIRMIZI, tarih yoksa GRİ. Veritabanı kolonları
// (muayene_tarihi, kasko_bitis, trafik_sigortasi_bitis) değişmedi.
import { colors, inputStyle, labelStyle, helperStyle } from "@/lib/theme";
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
  hideLegend = false,
}: {
  value: DocDates;
  onChange: (key: keyof DocDates, v: string) => void;
  idPrefix?: string;
  hideLegend?: boolean;
}) {
  const today = todayIsoIstanbul();
  return (
    <fieldset data-testid="belge-tarihleri" style={{ border: "none", padding: 0, margin: "4px 0 16px", minWidth: 0 }}>
      <legend className={hideLegend ? "sr-only" : undefined} style={hideLegend ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } : { width: "100%", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textFaint, margin: "0 0 12px", padding: "0 0 8px", borderBottom: `1px solid ${colors.border}` }}>Muayene ve Sigorta Tarihleri</legend>
      {DOC_DATE_FIELDS.map((f) => {
        const v = (value as any)[f.key] || "";
        const st = dateDueStatus(v, today);
        const id = `${idPrefix}-${f.key}`;
        return (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
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
                  style={{ minWidth: 52, minHeight: 52, borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.surfaceRaised, color: colors.textMuted, fontSize: 20, cursor: "pointer" }}
                >
                  ×
                </button>
              )}
            </div>
            {st.level !== "none" && (
              <div style={{ ...helperStyle, color: colors.textMuted }}>
                {fmtDate(v)} · {st.daysLeft === 0 ? "bugün" : st.daysLeft < 0 ? `${Math.abs(st.daysLeft)} gün geçti` : `${st.daysLeft} gün kaldı`}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
