"use client";

// OTOİZ Nihai UX — yapılan işlemler için kompakt seçim ızgarası. Servis hızlı
// kayıt, bireysel hızlı kayıt ve geçmiş işlem ekleme aynı bileşeni kullanır:
// masaüstünde 3–4 sütun, mobilde 2 sütun (kapsayıcı genişliğine göre, bkz.
// globals.css .otoiz-chip-grid). Seçili işlem yeşil çerçeve + onay işareti.
import { colors, font, radius, inputStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
const { QUICK_GRID_KEYS, CHIP_LABELS } = require("@/lib/maintenanceItems");

export const GRID_ITEMS: { key: string; label: string }[] = QUICK_GRID_KEYS.map((key: string) => ({ key, label: CHIP_LABELS[key] }));

export function ItemChipGrid({
  selected,
  onToggle,
  otherOn,
  onToggleOther,
  otherText,
  onOtherText,
  otherPlaceholder = "Yapılan işlemi kısaca yazın",
  label = "Yapılan işlemler",
  items = GRID_ITEMS,
}: {
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
  otherOn: boolean;
  onToggleOther: () => void;
  otherText: string;
  onOtherText: (v: string) => void;
  otherPlaceholder?: string;
  label?: string;
  items?: { key: string; label: string }[];
}) {
  return (
    <div className="otoiz-chip-wrap">
      <div role="group" aria-label={label} className="otoiz-chip-grid otoiz-quick-chips" data-testid="islem-izgarasi">
        {items.map((it) => (
          <Chip key={it.key} on={!!selected[it.key]} label={it.label} onClick={() => onToggle(it.key)} />
        ))}
        <Chip on={otherOn} label="Diğer" onClick={onToggleOther} />
      </div>
      {otherOn && (
        <input
          placeholder={otherPlaceholder}
          aria-label="Diğer işlem"
          maxLength={80}
          style={{ ...inputStyle, marginTop: 8 }}
          value={otherText}
          onChange={(e) => onOtherText(e.target.value)}
        />
      )}
    </div>
  );
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 46,
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: radius.sm,
        border: `1px solid ${on ? colors.green : colors.border}`,
        background: on ? colors.greenSoft : colors.surfaceRaised,
        color: on ? colors.text : colors.textMuted,
        fontSize: 14,
        fontWeight: on ? 700 : 600,
        fontFamily: font,
        textAlign: "left",
        lineHeight: 1.2,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          minWidth: 20,
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1.5px solid ${on ? colors.green : colors.border}`,
          background: on ? colors.green : "transparent",
        }}
      >
        {on && <Icon name="check" color={colors.onAccent} size={14} strokeWidth={3} />}
      </span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
    </button>
  );
}
