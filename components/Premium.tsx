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
  soon: "#F5C451",
  late: "#EF5350",
  none: "#6F7783",
};

// İmza araç kartı: karanlıktan öne çıkan araç görseli + koyu overlay.
export function CarHero({
  children,
  top,
  tall = false,
  testId,
  label,
}: {
  children: React.ReactNode;
  top?: React.ReactNode;
  tall?: boolean;
  testId?: string;
  label?: string;
}) {
  return (
    <section className={`oz-hero${tall ? " is-tall" : ""}`} data-testid={testId} aria-label={label}>
      <div className="oz-hero-img" aria-hidden="true" />
      <div className="oz-hero-body">
        <div className="oz-hero-top">{top}</div>
        <div>{children}</div>
      </div>
    </section>
  );
}

export function StatCard({ label, value, level = "none", testId, onClick }: { label: string; value: string; level?: string; testId?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="oz-stat-label">
        <span className="oz-lvl" data-level={level} aria-hidden="true" />
        {label}
      </span>
      <span className="oz-stat-value">{value}</span>
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
  title,
  sub,
  level,
  onClick,
  href,
  calm = false,
  testId,
}: {
  icon: string;
  title: string;
  sub?: string;
  level?: string;
  onClick?: () => void;
  href?: string;
  calm?: boolean;
  testId?: string;
}) {
  const inner = (
    <>
      <span className="oz-tile-icon" aria-hidden="true">
        <Icon name={icon} color={calm ? "#A3ABB7" : "#86EFAC"} size={20} />
      </span>
      <span style={{ minWidth: 0, flex: calm ? 1 : undefined }}>
        <span className="oz-tile-title">{title}</span>
        {sub && (
          <span className="oz-tile-sub" data-level={level}>
            {sub}
          </span>
        )}
      </span>
      {calm && <Icon name="chevron-right" color="#6F7783" size={18} />}
    </>
  );
  const cls = `oz-tile${calm ? " is-calm" : ""}`;
  return href ? (
    <a className={cls} href={href} data-testid={testId}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick} data-testid={testId}>
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

export function Chips({ options, value, onChange, label }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div className="oz-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className="oz-chip" aria-pressed={value === o.key} data-filter={o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Büyük dairesel gösterge. fraction 0..1 (kalan oran), renk gerçek seviyeden.
export function RingGauge({ fraction, level, size = 232, children, testId }: { fraction: number; level: string; size?: number; children: React.ReactNode; testId?: string }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = LEVEL_COLOR[level] ?? LEVEL_COLOR.none;
  const f = Math.max(0, Math.min(1, fraction || 0));
  return (
    <div className="oz-ring" style={{ width: size, height: size }} data-testid={testId} data-level={level}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <filter id="oz-ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        {f > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * f} ${c}`}
            filter="url(#oz-ring-glow)"
          />
        )}
      </svg>
      <div className="oz-ring-center">{children}</div>
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
          <h2 id="oz-sheet-title" data-sheet-title tabIndex={-1} style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, outline: "none" }}>
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

// Dikey zaman çizelgesi: tarih — km, yapılan işlemler, kaynak + doğrulama rozeti.
export function TimelineList({ rows, testId = "gecmis-liste" }: { rows: any[]; testId?: string }) {
  return (
    <ol className="oz-tl" data-testid={testId}>
      {rows.map((ev: any) => {
        const d = describeEvent(ev);
        const { lines, note } = ev.kind === "record" ? recordLines(ev.title) : { lines: [ev.title], note: "" };
        const shown = lines.slice(0, 4);
        return (
          <li key={`${ev.kind}:${ev.id}`} className="oz-tl-item" data-testid="zaman-olay" data-source={d.source}>
            <span className="oz-tl-dot" data-source={d.source} aria-hidden="true" />
            <div className="oz-tl-date">
              {longDate(ev.event_date)}
              {ev.km != null && (
                <>
                  {" — "}
                  <strong>{fmtKm(ev.km)}</strong>
                </>
              )}
            </div>
            <ul className="oz-tl-lines">
              {shown.map((l: string, i: number) => (
                <li key={i}>{l}</li>
              ))}
              {lines.length > shown.length && <li style={{ color: "#A3ABB7", fontWeight: 600 }}>+{lines.length - shown.length} işlem daha</li>}
            </ul>
            <div className="oz-tl-meta">
              <span className="oz-badge" data-source={d.source}>
                {d.source === "service" && <Icon name="shield-check" color="#86EFAC" size={13} />}
                {d.sourceLabel}
              </span>
              {d.categoryLabel && <span className="oz-badge">{d.categoryLabel}</span>}
              {ev.revised && (
                <span className="oz-badge is-warn" data-testid="duzeltildi-rozet">
                  Düzeltilmiş kayıt
                </span>
              )}
              {d.source === "service" && ev.service_name && <span>{ev.service_name}</span>}
            </div>
            {note && <div style={{ fontSize: 12.5, color: "#6F7783", marginTop: 6 }}>Not: {note}</div>}
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
