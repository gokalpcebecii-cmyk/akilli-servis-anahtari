"use client";

// OTOİZ Nihai UX — tek bir bireysel geçmiş kaydı: işlem tarihi, o tarihteki
// km, yapılan işlemler (servis ekranıyla aynı ızgara), isteğe bağlı not.
// "diger" türünde işlem ızgarası yerine kısa açıklama yazılır.
import { colors, inputStyle, labelStyle, errorTextStyle } from "@/lib/theme";
import { CaretSafeInput } from "@/components/CaretSafeInput";
import { ItemChipGrid } from "@/components/ItemChipGrid";
import type { HistoryEntry } from "@/lib/historySave";

function formatKm(v: string) {
  const d = String(v ?? "").replace(/\D/g, "");
  return d ? Number(d).toLocaleString("tr-TR") : "";
}

export function HistoryEntryFields({
  idPrefix,
  entry,
  onChange,
  today,
  minDate,
  error,
  kind = "bakim",
}: {
  idPrefix: string;
  entry: HistoryEntry;
  onChange: (next: HistoryEntry) => void;
  today: string;
  minDate: string;
  error?: { field: string; message: string } | null;
  kind?: "bakim" | "diger";
}) {
  const selected: Record<string, boolean> = Object.fromEntries(entry.items.map((k) => [k, true]));
  const errFor = (f: string) => (error && error.field === f ? error.message : "");
  return (
    <div data-testid="gecmis-kayit" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="otoiz-two-fields" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <label htmlFor={`${idPrefix}-tarih`} style={labelStyle}>İşlem tarihi</label>
          <input
            id={`${idPrefix}-tarih`}
            type="date"
            max={today}
            min={minDate}
            aria-invalid={!!errFor("date")}
            style={{ ...inputStyle, borderColor: errFor("date") ? colors.danger : colors.border }}
            value={entry.date}
            onChange={(e) => onChange({ ...entry, date: e.target.value })}
          />
          {errFor("date") && <p role="alert" style={errorTextStyle}>{errFor("date")}</p>}
        </div>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <label htmlFor={`${idPrefix}-km`} style={labelStyle}>
            O tarihteki kilometre{kind === "diger" && <span style={{ color: colors.textFaint, fontWeight: 500 }}> (isteğe bağlı)</span>}
          </label>
          <CaretSafeInput
            caretChars="digits"
            id={`${idPrefix}-km`}
            type="text"
            inputMode="numeric"
            placeholder="Örn. 72.000"
            aria-invalid={!!errFor("km")}
            style={{ ...inputStyle, fontWeight: 800, fontSize: 17, borderColor: errFor("km") ? colors.danger : colors.border }}
            value={formatKm(entry.km)}
            onChange={(e) => onChange({ ...entry, km: e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") })}
          />
          {errFor("km") && <p role="alert" style={errorTextStyle}>{errFor("km")}</p>}
        </div>
      </div>

      {kind === "bakim" ? (
        <div>
          <div style={labelStyle}>Yapılan işlemler</div>
          <ItemChipGrid
            selected={selected}
            onToggle={(k) => onChange({ ...entry, items: entry.items.includes(k) ? entry.items.filter((x) => x !== k) : [...entry.items, k] })}
            otherOn={entry.otherOn}
            onToggleOther={() => onChange({ ...entry, otherOn: !entry.otherOn })}
            otherText={entry.otherText}
            onOtherText={(v) => onChange({ ...entry, otherText: v })}
          />
          {errFor("items") && <p role="alert" style={errorTextStyle}>{errFor("items")}</p>}
        </div>
      ) : (
        <div>
          <label htmlFor={`${idPrefix}-aciklama`} style={labelStyle}>Yapılan işlem</label>
          <input
            id={`${idPrefix}-aciklama`}
            maxLength={80}
            placeholder="Örn. Araç muayenesi, Seramik kaplama"
            aria-invalid={!!errFor("items")}
            style={{ ...inputStyle, borderColor: errFor("items") ? colors.danger : colors.border }}
            value={entry.otherText}
            onChange={(e) => onChange({ ...entry, otherOn: true, otherText: e.target.value })}
          />
          {errFor("items") && <p role="alert" style={errorTextStyle}>{errFor("items")}</p>}
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-not`} style={labelStyle}>
          Not <span style={{ color: colors.textFaint, fontWeight: 500 }}>(isteğe bağlı)</span>
        </label>
        <input
          id={`${idPrefix}-not`}
          maxLength={200}
          placeholder="Örn. yetkili serviste yapıldı"
          style={inputStyle}
          value={entry.note}
          onChange={(e) => onChange({ ...entry, note: e.target.value })}
        />
      </div>
    </div>
  );
}
