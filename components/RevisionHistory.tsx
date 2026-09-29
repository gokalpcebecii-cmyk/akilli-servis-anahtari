"use client";

// OTOİZ P1 — "Düzeltme geçmişi": servis doğrulamalı kaydın sonradan
// düzeltildiğini gösterir. Salt okuma; silme/değiştirme yok, audit bozulmaz.
// Servis ekranı: revizyon no, değiştiren kişi, tarih/saat, eski → yeni.
// Araç sahibi ekranı: yalnız "servis düzeltti" + eski → yeni (teknik detay yok).
import { useEffect, useState } from "react";
import { colors, radius } from "@/lib/theme";
const { describeChanges, groupByRecord } = require("@/lib/revisionFormat");

export function useRecordRevisions(supabase: any, vehicleId: string | null, reloadKey: any = null) {
  const [map, setMap] = useState<Record<string, any[]>>({});
  useEffect(() => {
    if (!vehicleId || vehicleId === "yeni") return;
    let alive = true;
    supabase.rpc("maintenance_record_history", { p_vehicle_id: vehicleId }).then(({ data }: any) => {
      if (alive) setMap(groupByRecord(data ?? []));
    });
    return () => {
      alive = false;
    };
  }, [vehicleId, reloadKey]);
  return map;
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RevisionHistory({ revisions, audience }: { revisions?: any[]; audience: "servis" | "bireysel" }) {
  if (!revisions || revisions.length === 0) return null;
  return (
    <details data-testid="duzeltme-gecmisi" style={{ marginTop: 6, background: colors.surfaceSoft, borderRadius: radius.sm, padding: "6px 10px" }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: colors.textMuted, minHeight: 32, display: "flex", alignItems: "center" }}>
        {audience === "servis" ? `Düzeltme geçmişi (${revisions.length})` : `Bu kayıt servis tarafından düzeltildi (${revisions.length})`}
      </summary>
      <ol style={{ listStyle: "none", padding: 0, margin: "6px 0 2px", display: "flex", flexDirection: "column", gap: 8 }}>
        {revisions.map((rev) => (
          <li key={`${rev.record_id}-${rev.revision}`} style={{ fontSize: 12.5, color: colors.textDark, borderTop: `1px solid ${colors.border}`, paddingTop: 6 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>
              {audience === "servis" ? `Revizyon ${rev.revision} · ${rev.changed_by} · ` : `${rev.changed_by} · `}
              <span style={{ fontWeight: 600, color: colors.textMuted }}>{fmtDateTime(rev.changed_at)}</span>
            </div>
            {describeChanges(rev).map((c: any) => (
              <div key={c.field}>
                {c.label}: <span style={{ textDecoration: "line-through", color: colors.textMuted }}>{c.from}</span> → <strong>{c.to}</strong>
              </div>
            ))}
          </li>
        ))}
      </ol>
    </details>
  );
}
