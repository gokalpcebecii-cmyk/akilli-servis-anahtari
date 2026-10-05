"use client";

// OTOİZ Premium — dijital kokpit yapı taşları. Yalnız sunum: veri ve iş
// kuralları çağıran sayfada / lib dosyalarında kalır. Stil sınıfları
// globals.css "OTOİZ PREMIUM" bölümünde (oz-*).
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
const { normalizeTimelineResponse, mergeTimelinePages, describeEvent } = require("@/lib/timeline");
const { longDate, fmtKm, recordLines } = require("@/lib/premiumUi");

export const LEVEL_COLOR: Record<string, string> = {
  ok: "#22C55E",
  soon: "#F5A524",
  late: "#EF4444",
  none: "#6F7783",
};

// Adım 3: seviyeye göre ikon tonu — yeşil (OTOİZ) varsayılan; amber/kırmızı
// yalnız yaklaşan/gecikmiş durumda.
export function levelTone(level?: string | null) {
  return level === "late" ? "red-t" : level === "soon" ? "amber-t" : "green-t";
}

// İkon karesi: tek aile, aynı görsel ağırlık (yeşil çizgi ikon; uyarıda
// amber/kırmızı).
export function IconSquare({ icon, tone = "gray", size = "md", iconColor }: { icon: string; tone?: string; size?: "sm" | "md" | "lg"; iconColor?: string }) {
  const solid = tone === "green" || tone === "blue" || tone === "amber";
  const color =
    iconColor ??
    (solid ? (tone === "blue" ? "#FFFFFF" : "#04110A") : tone === "green-t" ? "#4ADE80" : tone === "amber-t" ? "#FBBF24" : tone === "red-t" ? "#F87171" : "#C3C9D1");
  const px = size === "sm" ? 18 : size === "lg" ? 26 : 22;
  return (
    <span className={`oz-ico${size === "sm" ? " is-sm" : size === "lg" ? " is-lg" : ""}`} data-tone={tone} aria-hidden="true">
      <Icon name={icon} color={color} size={px} />
    </span>
  );
}

// Alt ekran başlığı: geri oku + ortada başlık (+ isteğe bağlı sağ aksiyon).
export function SubHeader({ title, onBack, backHref, action, id }: { title: string; onBack?: () => void; backHref?: string; action?: React.ReactNode; id?: string }) {
  const arrow = <Icon name="arrow-left" color="#F5F7FA" size={22} />;
  return (
    <header className="oz-subhead">
      {backHref ? (
        <a href={backHref} className="oz-iconbtn" aria-label="Geri">
          {arrow}
        </a>
      ) : (
        <button type="button" className="oz-iconbtn" aria-label="Geri" onClick={onBack}>
          {arrow}
        </button>
      )}
      <h1 className="oz-subhead-title" id={id}>
        {title}
      </h1>
      <span style={{ display: "flex", justifyContent: "flex-end" }}>{action}</span>
    </header>
  );
}

export function StatCard({
  label,
  value,
  level = "none",
  icon,
  tone,
  testId,
  onClick,
}: {
  label: string;
  value: string;
  level?: string;
  icon: string;
  tone: string;
  testId?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <IconSquare icon={icon} tone={tone} size="sm" />
      <span className="oz-stat-label">{label}</span>
      <span className="oz-stat-value" data-level={level}>
        {value}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="oz-stat" data-testid={testId} data-level={level} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="oz-stat" data-testid={testId} data-level={level}>
      {body}
    </div>
  );
}

export function Tile({
  icon,
  tone,
  title,
  sub,
  level,
  onClick,
  href,
  testId,
}: {
  icon: string;
  tone: string;
  title: string;
  sub?: string;
  level?: string;
  onClick?: () => void;
  href?: string;
  testId?: string;
}) {
  const inner = (
    <>
      <IconSquare icon={icon} tone={tone} />
      <span style={{ minWidth: 0 }}>
        <span className="oz-tile-title">{title}</span>
        {sub && (
          <span className="oz-tile-sub" data-level={level}>
            {sub}
          </span>
        )}
      </span>
    </>
  );
  return href ? (
    <a className="oz-tile" href={href} data-testid={testId}>
      {inner}
    </a>
  ) : (
    <button type="button" className="oz-tile" onClick={onClick} data-testid={testId}>
      {inner}
    </button>
  );
}

export function SectionHead({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="oz-head">
      <h2 className="oz-h2" id={id}>
        {title}
      </h2>
      {action}
    </div>
  );
}

// Sekmeli filtre (referanstaki Tümü / Servis / Kullanıcı kutusu).
export function Segmented({ options, value, onChange, label }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div className="oz-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className="oz-seg-btn" aria-pressed={value === o.key} data-filter={o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Alttan açık dairesel gösterge (300°). fraction 0..1 = dolu oran.
// variant "warm": amber → yeşil geçiş (yaklaşan bakım), "green": yeşil tonları.
export function Gauge({
  fraction,
  level,
  variant = "green",
  size = 220,
  children,
  testId,
}: {
  fraction: number;
  level: string;
  variant?: "warm" | "green";
  size?: number;
  children: React.ReactNode;
  testId?: string;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const SWEEP = 300;
  const START = 210; // derece, saat 12 = 0, saat yönünde
  const f = Math.max(0, Math.min(1, fraction || 0));
  const pt = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const arc = (from: number, sweep: number) => {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(from + sweep);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const gid = `oz-g-${variant}-${level}`;
  const stops =
    level === "late"
      ? [["0%", "#F87171"], ["100%", "#EF4444"]]
      : level === "none"
        ? [["0%", "#3A4148"], ["100%", "#3A4148"]]
        : variant === "warm"
          ? [["0%", "#F5A524"], ["45%", "#F5C451"], ["70%", "#4ADE80"], ["100%", "#22C55E"]]
          : level === "soon"
            ? [["0%", "#F5A524"], ["100%", "#FBBF24"]]
            : [["0%", "#16A34A"], ["100%", "#4ADE80"]];
  return (
    <div className="oz-gauge" style={{ width: size, height: size }} data-testid={testId} data-level={level}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            {stops.map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <path d={arc(START, SWEEP)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} strokeLinecap="round" />
        {f > 0 && <path d={arc(START, Math.max(1, SWEEP * f))} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round" />}
      </svg>
      <div className="oz-gauge-center">{children}</div>
    </div>
  );
}

// Alt pencere (bottom sheet). Telefonda alttan açılır, masaüstünde ortalanır.
// Sınıflar QuickActionSheet ile ortak (otoiz-sheet-*).
export function BottomSheet({ open, title, onClose, children, testId }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; testId?: string }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-sheet-title]")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="otoiz-sheet-root">
      <div className="otoiz-sheet-backdrop" aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="oz-sheet-title" data-testid={testId} tabIndex={-1} className="otoiz-sheet-panel">
        <div className="otoiz-sheet-grab" aria-hidden="true" />
        <div className="otoiz-sheet-head">
          <h2 id="oz-sheet-title" data-sheet-title tabIndex={-1} style={{ flex: 1, fontSize: 19, fontWeight: 700, letterSpacing: "-0.015em", margin: 0, outline: "none" }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="oz-iconbtn">
            <Icon name="close" color="#F5F7FA" size={18} />
          </button>
        </div>
        <div className="otoiz-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// Zaman çizelgesi verisi (vehicle_timeline RPC, mevcut yetki kuralları).
export function useTimeline(supabase: any, vehicleId: string | null, pageSize = 20, reloadKey: any = 0) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);

  async function fetchPage(offset: number) {
    const { data, error: e } = await supabase.rpc("vehicle_timeline", { p_vehicle_id: vehicleId, p_offset: offset, p_limit: pageSize });
    return { page: normalizeTimelineResponse(data), failed: !!e };
  }

  useEffect(() => {
    if (!vehicleId) return;
    const my = ++seq.current;
    setLoading(true);
    fetchPage(0).then(({ page, failed }) => {
      if (my !== seq.current) return;
      setRows(page.rows);
      setTotal(page.total);
      setHasMore(page.hasMore);
      setError(failed);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, reloadKey]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { page } = await fetchPage(rows.length);
    setRows((prev) => mergeTimelinePages(prev, page.rows));
    setTotal(page.total);
    setHasMore(page.hasMore);
    setLoadingMore(false);
  }

  return { rows, total, hasMore, loading, error, loadMore, loadingMore };
}

// Kaynak etiketi (referans dili): servis = "Servis Doğrulamalı", sahibin
// kendi kaydı = "Kullanıcı Kaydı".
function sourceText(source: string, fallback: string) {
  if (source === "owner" || source === "owner_history") return "Kullanıcı Kaydı";
  if (source === "system") return "Araç Olayı";
  return fallback;
}

// Dikey zaman çizelgesi: tarih (sol) — km (sağ), işlemler, kaynak rozeti.
// compact: ana ekranda işlemler tek satırda "•" ile birleşir.
export function TimelineList({ rows, testId = "gecmis-liste", compact = false }: { rows: any[]; testId?: string; compact?: boolean }) {
  return (
    <ol className="oz-tl" data-testid={testId}>
      {rows.map((ev: any) => {
        const d = describeEvent(ev);
        const { lines, note } = ev.kind === "record" ? recordLines(ev.title) : { lines: [ev.title], note: "" };
        const shown = compact ? lines : lines.slice(0, 6);
        return (
          <li key={`${ev.kind}:${ev.id}`} className="oz-tl-item" data-testid="zaman-olay" data-source={d.source}>
            <span className="oz-tl-dot" data-source={d.source} aria-hidden="true" />
            <div className="oz-tl-top">
              <span className="oz-tl-date">{longDate(ev.event_date)}</span>
              {ev.km != null && <span className="oz-tl-km">{fmtKm(ev.km)}</span>}
            </div>
            {compact ? (
              <div className="oz-tl-inline">{shown.join(" • ")}</div>
            ) : (
              <ul className="oz-tl-lines">
                {shown.map((l: string, i: number) => (
                  <li key={i}>{l}</li>
                ))}
                {lines.length > shown.length && <li style={{ color: "#A3ABB7" }}>+{lines.length - shown.length} işlem daha</li>}
              </ul>
            )}
            <div className="oz-tl-meta">
              {d.source === "service" ? (
                <span className="oz-src" data-source="service">
                  <span className="oz-src-dot" aria-hidden="true">
                    <Icon name="check" color="#04110A" size={11} />
                  </span>
                  {d.sourceLabel}
                </span>
              ) : (
                <span className="oz-pill" data-source={d.source}>
                  <Icon name={d.source === "system" ? "qr" : "user"} color="#C3C9D1" size={12} />
                  {sourceText(d.source, d.sourceLabel)}
                </span>
              )}
              {d.source === "service" && ev.service_name && (
                <span className="oz-pill">
                  <Icon name="tool" color="#C3C9D1" size={12} />
                  {ev.service_name}
                </span>
              )}
              {d.categoryLabel && <span className="oz-pill" style={{ paddingLeft: 10 }}>{d.categoryLabel}</span>}
              {ev.revised && (
                <span className="oz-pill is-warn" data-testid="duzeltildi-rozet">
                  Düzeltilmiş kayıt
                </span>
              )}
            </div>
            {note && !compact && <div style={{ fontSize: 12.5, color: "#8B939E", marginTop: 6 }}>Not: {note}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function Skeleton({ height = 60, count = 1 }: { height?: number; count?: number }) {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="otoiz-skeleton" style={{ height, borderRadius: 16 }} />
      ))}
    </div>
  );
}
