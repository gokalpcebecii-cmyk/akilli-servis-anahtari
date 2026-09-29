"use client";

// OTOİZ Aşama E — "Sonraki Bakım" görseli + "Araç Durumu" kartları.
// Saf sunum: hesap lib/vehicleStatus.js'de (unit testli). Durumlar yalnız
// tarih/km/bakım planı/kayıt üzerinden; mekanik teşhis metni YOK.
import { colors, radius, cardStyle } from "@/lib/theme";
const { buildVehicleStatus, LEVELS, DISCLAIMER } = require("@/lib/vehicleStatus");
const { todayIsoIstanbul } = require("@/lib/logic");

export const STATUS_TONE: Record<string, { fg: string; bg: string; dot: string }> = {
  ok: { fg: colors.greenDark, bg: colors.greenSoft, dot: colors.greenDark },
  soon: { fg: "#8A6400", bg: colors.warningSoft, dot: "#E0A800" },
  late: { fg: colors.danger, bg: colors.dangerSoft, dot: colors.danger },
  none: { fg: colors.textMuted, bg: colors.neutralSoft, dot: "#9AA5B1" },
};

export function StatusPill({ level }: { level: string }) {
  const t = STATUS_TONE[level] ?? STATUS_TONE.none;
  return (
    <span
      data-level={level}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: t.fg, background: t.bg, borderRadius: radius.pill, padding: "3px 9px", whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: t.dot }} />
      {LEVELS[level]?.label ?? "Veri Yok"}
    </span>
  );
}

export function NextServiceHero({ status }: { status: any }) {
  const t = STATUS_TONE[status.level] ?? STATUS_TONE.none;
  return (
    <section
      data-testid="sonraki-bakim"
      data-level={status.level}
      aria-label="Sonraki bakım"
      style={{ ...cardStyle, padding: 0, overflow: "hidden", borderColor: t.dot, borderWidth: 1.5 }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div aria-hidden="true" style={{ width: 8, background: t.dot, flex: "0 0 8px" }} />
        <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: colors.textMuted }}>SONRAKİ BAKIM</span>
            <StatusPill level={status.level} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: t.fg, marginTop: 6, lineHeight: 1.2 }}>{status.headline}</div>
          {status.detail && <div style={{ fontSize: 14, fontWeight: 700, color: colors.textDark, marginTop: 4 }}>{status.detail}</div>}
          {status.target && <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4 }}>Hedef: {status.target}</div>}
        </div>
      </div>
    </section>
  );
}

export function VehicleStatusPanel({
  vehicle,
  items,
  labels,
  lastMuayene,
  lastDetailing,
  showHero = true,
  compact = false,
}: {
  vehicle: any;
  items: any[];
  labels: Record<string, string>;
  lastMuayene?: any;
  lastDetailing?: any;
  showHero?: boolean;
  compact?: boolean;
}) {
  const { cards, nextService } = buildVehicleStatus({ vehicle, items, labels, lastMuayene, lastDetailing, today: todayIsoIstanbul() });
  const main = cards.filter((c: any) => c.key !== "yaklasan");
  const upcoming = cards.find((c: any) => c.key === "yaklasan");
  return (
    <>
      {showHero && <NextServiceHero status={nextService} />}
      <section data-testid="arac-durumu" aria-label="Araç durumu" style={{ ...cardStyle, padding: compact ? 14 : 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.textDark, margin: "0 0 12px" }}>Araç Durumu</h2>
        <div className="otoiz-status-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {main.map((c: any) => {
            const t = STATUS_TONE[c.level] ?? STATUS_TONE.none;
            return (
              <div
                key={c.key}
                data-testid={`durum-${c.key}`}
                data-level={c.level}
                style={{ background: t.bg, borderRadius: radius.md, padding: "10px 12px", minWidth: 0, borderLeft: `4px solid ${t.dot}` }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>{c.title}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: t.fg, marginTop: 2, overflowWrap: "anywhere" }}>{c.value}</div>
                {!compact && <div style={{ fontSize: 11.5, color: colors.textDark, marginTop: 3, lineHeight: 1.35, overflowWrap: "anywhere" }}>{c.detail}</div>}
              </div>
            );
          })}
          {upcoming && (
            <div
              data-testid="durum-yaklasan"
              data-level={upcoming.level}
              style={{
                gridColumn: "1 / -1",
                background: (STATUS_TONE[upcoming.level] ?? STATUS_TONE.none).bg,
                borderLeft: `4px solid ${(STATUS_TONE[upcoming.level] ?? STATUS_TONE.none).dot}`,
                borderRadius: radius.md,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>{upcoming.title}</span>
                <StatusPill level={upcoming.level} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: (STATUS_TONE[upcoming.level] ?? STATUS_TONE.none).fg, marginTop: 2 }}>{upcoming.value}</div>
              <div style={{ fontSize: 11.5, color: colors.textDark, marginTop: 3, lineHeight: 1.35 }}>{upcoming.detail}</div>
            </div>
          )}
        </div>
        <p style={{ fontSize: 11, color: colors.textMuted, margin: "10px 0 0", lineHeight: 1.4 }}>{DISCLAIMER}</p>
      </section>
    </>
  );
}
