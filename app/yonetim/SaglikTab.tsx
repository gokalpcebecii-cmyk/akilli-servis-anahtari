"use client";

// OTOİZ P1 — Yönetim: "Sistem Sağlığı" ve "İşlem Kaydı" sekmeleri.
// Sistem Sağlığı yalnız veritabanında gerçekten ölçülen değerleri gösterir
// (admin_system_health); ölçülemeyenler ayrıca ve açıkça listelenir.
// Proje sahibi teknik log okumak zorunda kalmaz: her satır tek durum + tek cümle.

import { useEffect, useState } from "react";
import { colors, font, radius, inputStyle, cardStyle } from "@/lib/theme";
const { feedbackLabel, FEEDBACK_CATEGORIES, FEEDBACK_SCREENS } = require("@/lib/feedback");
const { ACTION_LABELS, actionLabel } = require("@/lib/auditLabels");

type Api = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; body: any }>;

const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  NORMAL: { bg: colors.greenSoft, fg: colors.greenLight, border: colors.green },
  UYARI: { bg: colors.warningSoft, fg: colors.warning, border: colors.warning },
  KRİTİK: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }: { status: string | null }) {
  const st = status ? STATUS_STYLE[status] : null;
  if (!st) return <span style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted }}>ÖLÇÜLMÜYOR</span>;
  return (
    <span style={{ display: "inline-block", minWidth: 74, textAlign: "center", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, letterSpacing: 0.4, background: st.bg, color: st.fg, border: `1px solid ${st.border}` }}>
      {status}
    </span>
  );
}

function valueText(it: any) {
  if (!it.measured || it.value == null) return it.unit === "time" ? "kayıt yok" : "—";
  if (it.unit === "time") return fmt(it.value);
  if (it.unit === "MB") return `${Number(it.value).toLocaleString("tr-TR")} MB`;
  return Number(it.value).toLocaleString("tr-TR");
}

export function SystemHealthTab({ api }: { api: Api }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const r = await api("/api/admin/saglik");
    setLoading(false);
    if (r.ok) setData(r.body);
    else setError(r.body?.error || "Sistem sağlığı yüklenemedi");
  }

  useEffect(() => {
    load();
  }, []);

  const overall = data?.overall as string | undefined;
  const st = overall ? STATUS_STYLE[overall] : null;

  return (
    <section style={{ ...cardStyle, fontFamily: font }} aria-label="Sistem Sağlığı">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0, marginRight: "auto" }}>Sistem Sağlığı</h2>
        <button onClick={load} disabled={loading} style={{ minHeight: 44, padding: "0 14px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>
          {loading ? "Ölçülüyor…" : "Yenile"}
        </button>
      </div>
      {error && <p role="alert" style={{ color: colors.danger, fontWeight: 700 }}>{error}</p>}
      {data && st && (
        <div data-testid="saglik-genel" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.fg, borderRadius: radius.md, padding: "12px 14px", marginBottom: 14, fontWeight: 800 }}>
          Genel durum: {overall}
          <span style={{ fontWeight: 600, fontSize: 12.5, marginLeft: 8 }}>· ölçüm {fmt(data.measured_at)}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(data?.items ?? []).map((it: any) => (
          <div key={it.key} data-testid={`saglik-${it.key}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "10px 12px" }}>
            <StatusPill status={it.measured ? it.status : null} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{it.label}</div>
              <div style={{ fontSize: 12.5, color: colors.textMuted }}>{it.detail}</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{valueText(it)}</div>
          </div>
        ))}
      </div>
      {(data?.not_measured ?? []).length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: colors.textMuted }}>
          <strong>Bu ekranda ölçülmeyenler:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {data.not_measured.map((t: string) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

export function AuditLogTab({ api }: { api: Api }) {
  const [rows, setRows] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(cursor?: string | null) {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (cursor) params.set("cursor", cursor);
    setLoading(true);
    const r = await api(`/api/admin/islem-kaydi?${params.toString()}`);
    setLoading(false);
    if (!r.ok) return setError(r.body?.error || "İşlem kaydı yüklenemedi");
    setError("");
    setRows((prev) => (cursor ? [...prev, ...(r.body.rows ?? [])] : r.body.rows ?? []));
    setNext(r.body.next_cursor ?? null);
  }

  useEffect(() => {
    load();
  }, [action]);

  return (
    <section style={{ ...cardStyle, fontFamily: font }} aria-label="İşlem Kaydı">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0, marginRight: "auto" }}>İşlem Kaydı</h2>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="İşlem türü" style={{ ...inputStyle, width: "auto", maxWidth: 280 }}>
          <option value="">Tüm işlemler</option>
          {Object.keys(ACTION_LABELS).map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 10px" }}>En yeni önce. Kayıtlar değiştirilemez ve silinemez.</p>
      {error && <p role="alert" style={{ color: colors.danger, fontWeight: 700 }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", alignItems: "baseline", borderBottom: `1px solid ${colors.border}`, padding: "6px 0" }}>
            <span style={{ fontSize: 12, color: colors.textMuted, minWidth: 128 }}>{fmt(r.created_at)}</span>
            <strong style={{ fontSize: 13.5, flex: "1 1 200px" }}>{actionLabel(r.action)}</strong>
            <span style={{ fontSize: 12.5 }}>{r.tenant_name ?? ""}</span>
            <span style={{ fontSize: 12, color: colors.textMuted, wordBreak: "break-all" }}>{r.actor_email ?? ""}</span>
            {r.action === "user_feedback" && r.detail?.message && (
              <div data-testid="gorus-kaydi" style={{ flexBasis: "100%", fontSize: 13.5, color: colors.text, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "10px 12px", marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                <span style={{ display: "block", fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                  {feedbackLabel(r.detail.category, FEEDBACK_CATEGORIES)} · {feedbackLabel(r.detail.screen, FEEDBACK_SCREENS)}
                </span>
                {String(r.detail.message)}
              </div>
            )}
          </div>
        ))}
        {!loading && rows.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Kayıt yok.</p>}
      </div>
      {next && (
        <button onClick={() => load(next)} disabled={loading} style={{ marginTop: 12, width: "100%", minHeight: 44, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>
          {loading ? "Yükleniyor…" : "Daha fazla göster"}
        </button>
      )}
    </section>
  );
}
