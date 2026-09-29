"use client";

// OTOİZ Aşama E — Araç Zaman Çizelgesi. Tek kronolojik akış (en yeni önce):
// servis doğrulamalı bakım, bireysel kayıt, muayene/detailing etiketi, araç
// olayları (eklenme, devir, QR bağlama/yenileme). Kaynak vehicle_timeline()
// RPC'si; 20'lik sayfalar "Daha fazla göster" ile yüklenir (mobilde tek
// seferde uzun liste yok).
// Düzeltme geçmişi: servis ekranı revizyon ayrıntısını görür (RevisionHistory);
// araç sahibi yalnız "Bu kayıt sonradan düzeltildi" notunu görür.
import { useEffect, useRef, useState } from "react";
import { colors, radius, cardStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { RevisionHistory } from "@/components/RevisionHistory";
const { TIMELINE_PAGE, normalizeTimelineResponse, mergeTimelinePages, describeEvent, groupByYear } = require("@/lib/timeline");
const { fmtDate } = require("@/lib/vehicleStatus");

// Kapalı tasarım rozetleri: servis doğrulamalı = yeşil çerçeveli, bireysel =
// mavi, sistem = gri. Düzeltilmiş kayıt ayrıca sarı kenarlıklı rozetle.
const SOURCE_STYLE: Record<string, { fg: string; bg: string; border: string; icon: string }> = {
  service: { fg: colors.greenLight, bg: "transparent", border: colors.green, icon: "shield-check" },
  owner: { fg: colors.info, bg: colors.infoSoft, border: "rgba(96,165,250,0.45)", icon: "user" },
  system: { fg: colors.textMuted, bg: colors.neutralSoft, border: "transparent", icon: "car" },
};

export function RevisedBadge() {
  return (
    <span
      data-testid="duzeltildi-rozet"
      style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: colors.warning, border: `1px solid ${colors.warning}`, borderRadius: radius.pill, padding: "2px 9px", whiteSpace: "nowrap" }}
    >
      Düzeltilmiş kayıt
    </span>
  );
}

export function SourceBadge({ source, label }: { source: string; label: string }) {
  const s = SOURCE_STYLE[source] ?? SOURCE_STYLE.system;
  return (
    <span
      data-source={source}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: s.fg, background: s.bg, border: `1px solid ${s.border}`, borderRadius: radius.pill, padding: "2px 9px", whiteSpace: "nowrap" }}
    >
      <Icon name={s.icon} color={s.fg} size={12} />
      {label}
    </span>
  );
}

export function VehicleTimeline({
  supabase,
  vehicleId,
  audience,
  reloadKey = 0,
  preview,
  onShowAll,
  revisions,
  title = "Zaman Çizelgesi",
  alwaysShowAll = false,
}: {
  supabase: any;
  vehicleId: string;
  audience: "servis" | "bireysel";
  reloadKey?: any;
  preview?: number;
  onShowAll?: () => void;
  revisions?: Record<string, any[]>;
  title?: string;
  alwaysShowAll?: boolean;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  async function fetchPage(offset: number) {
    const { data, error: e } = await supabase.rpc("vehicle_timeline", {
      p_vehicle_id: vehicleId,
      p_offset: offset,
      p_limit: preview ?? TIMELINE_PAGE,
    });
    return { page: normalizeTimelineResponse(data), failed: !!e };
  }

  useEffect(() => {
    if (!vehicleId || vehicleId === "yeni") return;
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
    if (loadingMore) return;
    setLoadingMore(true);
    const { page } = await fetchPage(rows.length);
    setRows((prev) => mergeTimelinePages(prev, page.rows));
    setTotal(page.total);
    setHasMore(page.hasMore);
    setLoadingMore(false);
  }

  const groups = groupByYear(rows);

  return (
    <section data-testid="zaman-cizelgesi" aria-label={title} style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0 }}>{title}</h2>
        {!loading && total > 0 && <span style={{ fontSize: 13, color: colors.textFaint }}>{total} olay</span>}
      </div>
      {loading ? (
        <div aria-busy="true" aria-label="Yükleniyor" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="otoiz-skeleton" style={{ height: 46, borderRadius: radius.sm }} />
          ))}
        </div>
      ) : error ? (
        <p role="status" style={{ fontSize: 13, color: colors.danger, margin: 0 }}>Zaman çizelgesi yüklenemedi. Sayfayı yenileyin.</p>
      ) : rows.length === 0 ? (
        <p data-testid="zaman-bos" style={{ fontSize: 14, color: colors.textMuted, margin: 0, padding: "14px 16px", background: colors.surfaceRaised, borderRadius: radius.md, lineHeight: 1.5 }}>Henüz kayıt yok. İlk bakım kaydı burada görünecek.</p>
      ) : (
        <div>
          {groups.map((g: any) => (
            <div key={g.year}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textFaint, margin: "8px 0 8px", letterSpacing: 0.6 }}>{g.year}</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, borderLeft: `2px solid ${colors.border}`, marginLeft: 6 }}>
                {g.items.map((ev: any) => {
                  const d = describeEvent(ev);
                  const s = SOURCE_STYLE[d.source] ?? SOURCE_STYLE.system;
                  return (
                    <li key={`${ev.kind}:${ev.id}`} data-testid="zaman-olay" data-source={d.source} style={{ position: "relative", padding: "2px 0 16px 18px" }}>
                      <span aria-hidden="true" style={{ position: "absolute", left: -7, top: 6, width: 12, height: 12, borderRadius: "50%", background: colors.surface, border: `3px solid ${d.source === "service" ? colors.green : d.source === "owner" ? colors.info : colors.gray}` }} />
                      <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>
                        {fmtDate(ev.event_date)}
                        {ev.km != null && (
                          <>
                            {" · "}
                            <span style={{ color: colors.text, fontWeight: 700 }}>{Number(ev.km).toLocaleString("tr-TR")} km</span>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, margin: "3px 0 6px", lineHeight: 1.35, overflowWrap: "anywhere" }}>{ev.title}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <SourceBadge source={d.source} label={d.sourceLabel} />
                        {d.categoryLabel && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: radius.pill, padding: "2px 9px" }}>
                            {d.categoryLabel}
                          </span>
                        )}
                        {ev.revised && <RevisedBadge />}
                        {d.source === "service" && ev.service_name && audience === "bireysel" && (
                          <span style={{ fontSize: 12.5, color: colors.textFaint }}>{ev.service_name}</span>
                        )}
                      </div>
                      {ev.revised && audience === "bireysel" && (
                        <div data-testid="duzeltildi-notu" style={{ fontSize: 12.5, color: colors.textFaint, marginTop: 6 }}>
                          Bu kayıt sonradan düzeltildi.
                        </div>
                      )}
                      {ev.revised && audience === "servis" && <RevisionHistory revisions={revisions?.[ev.id]} audience="servis" />}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
      {!loading && preview != null && (total > rows.length || (alwaysShowAll && total > 0)) && onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          style={{ marginTop: 4, width: "100%", minHeight: 48, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceRaised, cursor: "pointer", fontWeight: 700, fontSize: 14.5, color: colors.text, fontFamily: "inherit" }}
        >
          Tüm geçmişi gör ({total})
        </button>
      )}
      {!loading && preview == null && hasMore && (
        <button
          type="button"
          data-testid="zaman-daha-fazla"
          onClick={loadMore}
          disabled={loadingMore}
          style={{ marginTop: 4, width: "100%", minHeight: 48, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surfaceRaised, cursor: loadingMore ? "wait" : "pointer", fontWeight: 700, fontSize: 14.5, color: colors.text, fontFamily: "inherit" }}
        >
          {loadingMore ? "Yükleniyor…" : `Daha fazla göster (${rows.length} / ${total})`}
        </button>
      )}
    </section>
  );
}
