"use client";

// OTOİZ Aşama E — "Sonraki Bakım" görseli + "Araç Durumu" kartları.
// Saf sunum: hesap lib/vehicleStatus.js'de (unit testli). Durumlar yalnız
// tarih/km/bakım planı/kayıt üzerinden; mekanik teşhis metni YOK.
import { colors, radius, cardStyle } from "@/lib/theme";
const { buildVehicleStatus, LEVELS, DISCLAIMER } = require("@/lib/vehicleStatus");
const { todayIsoIstanbul } = require("@/lib/logic");

// Kapalı tasarım: rozet dolu renk (Uygun yeşil + koyu metin, Yaklaşıyor sarı +
// koyu metin, Gecikti kırmızı + beyaz metin, Veri yok gri); kartın kendisi
// sakin koyu yüzey — yalnız ince renk şeridi ve değer rengi durumu taşır.
export const STATUS_TONE: Record<string, { fg: string; bg: string; dot: string; pillBg: string; pillFg: string }> = {
  ok: { fg: colors.greenLight, bg: colors.surfaceRaised, dot: colors.green, pillBg: colors.green, pillFg: colors.onAccent },
  soon: { fg: colors.warning, bg: colors.surfaceRaised, dot: colors.warning, pillBg: colors.warning, pillFg: colors.onAccent },
  late: { fg: "#FF8A80", bg: colors.surfaceRaised, dot: colors.danger, pillBg: colors.danger, pillFg: "#FFFFFF" },
  none: { fg: colors.textMuted, bg: colors.surfaceRaised, dot: colors.gray, pillBg: colors.neutralSoft, pillFg: colors.textMuted },
};

export function StatusPill({ level }: { level: string }) {
  const t = STATUS_TONE[level] ?? STATUS_TONE.none;
  return (
    <span
      data-level={level}
      style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: t.pillFg, background: t.pillBg, borderRadius: radius.pill, padding: "3px 10px", whiteSpace: "nowrap", lineHeight: 1.4 }}
    >
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
      style={{ ...cardStyle, padding: 0, overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div aria-hidden="true" style={{ width: 4, background: t.dot, flex: "0 0 4px" }} />
        <div style={{ padding: "16px 18px", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: colors.textMuted }}>SONRAKİ BAKIM</span>
            <StatusPill level={status.level} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: colors.text, marginTop: 8, lineHeight: 1.25 }}>{status.headline}</div>
          {status.detail && <div style={{ fontSize: 14, fontWeight: 700, color: t.fg, marginTop: 4 }}>{status.detail}</div>}
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
      <section data-testid="arac-durumu" aria-label="Araç durumu" style={{ ...cardStyle, padding: compact ? 16 : 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: "0 0 14px" }}>Araç Durumu</h2>
        <div className="otoiz-status-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {main.map((c: any, i: number) => {
            const t = STATUS_TONE[c.level] ?? STATUS_TONE.none;
            // Tek sayıda kart varsa sonuncusu tam genişlik (boş hücre kalmasın).
            const span = main.length % 2 === 1 && i === main.length - 1;
            return (
              <div
                key={c.key}
                data-testid={`durum-${c.key}`}
                data-level={c.level}
                style={{ position: "relative", overflow: "hidden", background: t.bg, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "12px 14px", minWidth: 0, gridColumn: span ? "1 / -1" : undefined }}
              >
                <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: t.dot }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, minWidth: 0 }}>{c.title}</span>
                  <span aria-hidden="true" style={{ width: 8, height: 8, minWidth: 8, borderRadius: "50%", background: t.dot }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.fg, marginTop: 4, overflowWrap: "anywhere" }}>{c.value}</div>
                {!compact && <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.4, overflowWrap: "anywhere" }}>{c.detail}</div>}
              </div>
            );
          })}
          {upcoming && (
            <div
              data-testid="durum-yaklasan"
              data-level={upcoming.level}
              style={{
                gridColumn: "1 / -1",
                background: colors.surfaceRaised,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted }}>{upcoming.title}</span>
                <StatusPill level={upcoming.level} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: colors.text, marginTop: 4 }}>{upcoming.value}</div>
              <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.4 }}>{upcoming.detail}</div>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: colors.textFaint, margin: "12px 0 0", lineHeight: 1.45 }}>{DISCLAIMER}</p>
      </section>
    </>
  );
}

// Pilot öncesi son cila — ana ekran için 4'lü güçlü mini kart: Bakım,
// Muayene, Kasko, Trafik sigortası. Hesap buildVehicleStatus ile aynı.
const QUAD_KEYS: { key: string; title: string }[] = [
  { key: "bakim", title: "Bakım" },
  { key: "muayene", title: "Muayene" },
  { key: "kasko", title: "Kasko" },
  { key: "trafik", title: "Trafik Sigortası" },
];

export function vehicleStatusFor(vehicle: any, items: any[], labels: Record<string, string>, lastMuayene?: any, lastDetailing?: any) {
  return buildVehicleStatus({ vehicle, items, labels, lastMuayene, lastDetailing, today: todayIsoIstanbul() });
}

export function StatusQuad({ cards }: { cards: any[] }) {
  return (
    <div className="otoiz-status-quad" data-testid="durum-dortlu">
      {QUAD_KEYS.map(({ key, title }) => {
        const c = cards.find((x: any) => x.key === key) ?? { level: "none", value: "Veri yok", detail: "" };
        const t = STATUS_TONE[c.level] ?? STATUS_TONE.none;
        return (
          <div
            key={key}
            data-testid={`dortlu-${key}`}
            data-level={c.level}
            style={{ position: "relative", overflow: "hidden", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "14px 14px 13px", minWidth: 0, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8 }}
          >
            <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: t.dot }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted }}>{title}</div>
            <div>
              <StatusPill level={c.level} />
              <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 6, lineHeight: 1.35, overflowWrap: "anywhere" }}>{shortDetail(key, c)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shortDetail(key: string, c: any): string {
  if (c.level === "none") return key === "bakim" ? "Plan girilmedi" : "Tarih girilmedi";
  // "12.10.2026 · 13 gün kaldı" → "13 gün kaldı"; bakımda ilk ifade.
  const parts = String(c.detail || "").split(" · ");
  if (key === "bakim") return parts[0] || c.value;
  return parts[1] || parts[0] || c.value;
}
