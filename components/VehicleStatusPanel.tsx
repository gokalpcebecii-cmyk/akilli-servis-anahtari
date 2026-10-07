"use client";

// OTOİZ Aşama E — "Sonraki Bakım" görseli + "Araç Durumu" kartları.
// Saf sunum: hesap lib/vehicleStatus.js'de (unit testli). Durumlar yalnız
// tarih/km/bakım planı/kayıt üzerinden; mekanik teşhis metni YOK.
import { colors, radius, cardStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
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
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, marginTop: 8, lineHeight: 1.25 }}>{status.headline}</div>
          {status.detail && <div style={{ fontSize: 14, fontWeight: 700, color: t.fg, marginTop: 4 }}>{status.detail}</div>}
          {status.target && <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4 }}>Hedef: {status.target}</div>}
        </div>
      </div>
    </section>
  );
}

// Nihai UX — araç detay / Genel Bakış hiyerarşisi (bakım TEK yerde):
//  1) Sonraki Bakım ana kartı
//  2) Muayene · Kasko · Trafik Sigortası küçük kartları
//  3) Yaklaşan İşlemler
//  4) Detailing ve diğer takipler
// Son düzenleme: afterDates telefonda kritik tarihlerden hemen sonra gelen
// "Hızlı İşlemler" içindir; extra diğer takipler bölümüne eklenir.
export function VehicleStatusPanel({
  vehicle,
  items,
  labels,
  lastMuayene,
  lastDetailing,
  compact = false,
  onOpenDocs,
  afterDates,
  extra,
}: {
  vehicle: any;
  items: any[];
  labels: Record<string, string>;
  lastMuayene?: any;
  lastDetailing?: any;
  compact?: boolean;
  onOpenDocs?: () => void;
  afterDates?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const { cards, upcoming, nextService } = buildVehicleStatus({ vehicle, items, labels, lastMuayene, lastDetailing, today: todayIsoIstanbul() });
  const card = (k: string) => cards.find((c: any) => c.key === k) ?? { key: k, level: "none", value: "", detail: "" };
  const yak = card("yaklasan");
  const det = card("detailing");
  const docCount = [vehicle?.muayene_tarihi, vehicle?.kasko_bitis, vehicle?.trafik_sigortasi_bitis].filter(Boolean).length;
  const sub: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: colors.text, margin: "0 0 12px" };
  return (
    <div data-testid="arac-durumu" aria-label="Araç durumu" style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 16 }}>
      <NextServiceHero status={nextService} />

      <div className="otoiz-tri">
        {[
          { key: "muayene", title: "Muayene" },
          { key: "kasko", title: "Kasko" },
          { key: "trafik", title: "Trafik Sigortası" },
        ].map(({ key, title }) => {
          const c = card(key);
          const t = STATUS_TONE[c.level] ?? STATUS_TONE.none;
          const [date, phrase] = String(c.detail || "").split(" · ");
          return (
            <div
              key={key}
              data-testid={`durum-${key}`}
              data-level={c.level}
              style={{ position: "relative", overflow: "hidden", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "13px 12px 12px", minWidth: 0 }}
            >
              <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: t.dot }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, marginBottom: 8, overflowWrap: "anywhere" }}>{title}</div>
              <StatusPill level={c.level} />
              <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 6, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                {c.level === "none" ? "Tarih girilmedi" : (
                  <>
                    <span style={{ display: "block", color: colors.text, fontWeight: 600 }}>{date}</span>
                    {phrase}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {afterDates}

      <section data-testid="durum-yaklasan" data-level={yak.level} aria-label="Yaklaşan işlemler" style={{ ...cardStyle, padding: compact ? 16 : 18 }}>
        <h2 style={sub}>Yaklaşan İşlemler</h2>
        {upcoming.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {upcoming.slice(0, 5).map((u: any) => (
              <li key={u.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "11px 14px" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: colors.text }}>{u.title}</span>
                  <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{u.detail}</span>
                </span>
                <StatusPill level={u.level} />
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>{yak.detail}</p>
        )}
      </section>

      <section aria-label="Detailing ve diğer takipler" style={{ ...cardStyle, padding: compact ? 16 : 18 }}>
        <h2 style={sub}>Detailing ve Diğer Takipler</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div data-testid="durum-detailing" data-level={det.level} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "11px 14px" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: colors.text }}>Detailing</span>
              <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{det.detail}</span>
            </span>
            <StatusPill level={det.level} />
          </div>
          <button
            type="button"
            onClick={onOpenDocs}
            disabled={!onOpenDocs}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", background: colors.surfaceRaised, border: "none", borderRadius: radius.sm, padding: "11px 14px", cursor: onOpenDocs ? "pointer" : "default", fontFamily: "inherit", minHeight: 52 }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: colors.text }}>Önemli Tarihler</span>
              <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{docCount} / 3 tarih girildi</span>
            </span>
            {onOpenDocs && <Icon name="chevron-right" color={colors.textMuted} size={18} />}
          </button>
          {extra}
        </div>
      </section>

      <p style={{ fontSize: 12, color: colors.textFaint, margin: 0, lineHeight: 1.45 }}>{DISCLAIMER}</p>
    </div>
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
