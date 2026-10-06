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
  if (!st) return <span style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>ÖLÇÜLMÜYOR</span>;
  return (
    <span style={{ display: "inline-block", minWidth: 74, textAlign: "center", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, background: st.bg, color: st.fg, border: `1px solid ${st.border}` }}>
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
        <div data-testid="saglik-genel" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.fg, borderRadius: radius.md, padding: "12px 14px", marginBottom: 14, fontWeight: 700 }}>
          Genel durum: {overall}
          <span style={{ fontWeight: 600, fontSize: 12.5, marginLeft: 8 }}>· ölçüm {fmt(data.measured_at)}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(data?.items ?? []).map((it: any) => (
          <div key={it.key} data-testid={`saglik-${it.key}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "10px 12px" }}>
            <StatusPill status={it.measured ? it.status : null} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{it.label}</div>
              <div style={{ fontSize: 12.5, color: colors.textMuted }}>{it.detail}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{valueText(it)}</div>
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
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
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

  const isFeedback = action === "user_feedback";
  const needle = q.trim().toLocaleLowerCase("tr-TR");
  const shown = !isFeedback
    ? rows
    : rows.filter((r) => {
        if (cat && r.detail?.category !== cat) return false;
        if (!needle) return true;
        const hay = [r.detail?.message, r.actor_email, feedbackLabel(r.detail?.screen, FEEDBACK_SCREENS), feedbackLabel(r.detail?.category, FEEDBACK_CATEGORIES)]
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        return hay.includes(needle);
      });

  return (
    <section style={{ ...cardStyle, fontFamily: font }} aria-label="İşlem Kaydı">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0, marginRight: "auto" }}>İşlem Kaydı</h2>
        <button
          type="button"
          onClick={() => setAction(isFeedback ? "" : "user_feedback")}
          aria-pressed={isFeedback}
          style={{ minHeight: 44, padding: "0 14px", borderRadius: radius.md, cursor: "pointer", fontFamily: font, fontWeight: 700, fontSize: 13.5, border: `1px solid ${isFeedback ? colors.green : colors.border}`, background: isFeedback ? colors.greenSoft : colors.surfaceRaised, color: isFeedback ? colors.greenLight : colors.text }}
        >
          Görüşler
        </button>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="İşlem türü" style={{ ...inputStyle, width: "auto", maxWidth: 280 }}>
          <option value="">Tüm işlemler</option>
          {Object.keys(ACTION_LABELS).map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
        </select>
      </div>
      {isFeedback && (
        <div data-testid="gorus-filtre" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Görüşlerde ara: metin, e-posta, ekran"
            aria-label="Görüşlerde ara"
            style={{ ...inputStyle, flex: "1 1 240px", width: "auto" }}
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Konu" style={{ ...inputStyle, width: "auto", maxWidth: 220 }}>
            <option value="">Tüm konular</option>
            {FEEDBACK_CATEGORIES.map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      )}
      <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 10px" }}>
        En yeni önce. Kayıtlar değiştirilemez ve silinemez.
        {isFeedback && ` ${shown.length} görüş gösteriliyor; arama yüklenen kayıtlarda yapılır, eskiler için "Daha fazla göster".`}
      </p>
      {error && <p role="alert" style={{ color: colors.danger, fontWeight: 700 }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((r) => (
          <div key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", alignItems: "baseline", borderBottom: `1px solid ${colors.border}`, padding: "6px 0" }}>
            <span style={{ fontSize: 12, color: colors.textMuted, minWidth: 128 }}>{fmt(r.created_at)}</span>
            <strong style={{ fontSize: 13.5, flex: "1 1 200px" }}>{actionLabel(r.action)}</strong>
            <span style={{ fontSize: 12.5 }}>{r.tenant_name ?? ""}</span>
            <span style={{ fontSize: 12, color: colors.textMuted, wordBreak: "break-all" }}>{r.actor_email ?? ""}</span>
            {r.action === "user_feedback" && r.detail?.message && (
              <div data-testid="gorus-kaydi" style={{ flexBasis: "100%", fontSize: 13.5, color: colors.text, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "10px 12px", marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                  <span data-testid="gorus-konu" style={{ fontWeight: 700, color: colors.info, background: colors.infoSoft, borderRadius: 999, padding: "2px 10px" }}>
                    {feedbackLabel(r.detail.category, FEEDBACK_CATEGORIES) || "Konu yok"}
                  </span>
                  <span data-testid="gorus-ekran">Ekran: {feedbackLabel(r.detail.screen, FEEDBACK_SCREENS) || "—"}</span>
                </span>
                {String(r.detail.message)}
              </div>
            )}
          </div>
        ))}
        {!loading && shown.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>{isFeedback && rows.length > 0 ? "Aramaya uyan görüş yok." : "Kayıt yok."}</p>}
      </div>
      {next && (
        <button onClick={() => load(next)} disabled={loading} style={{ marginTop: 12, width: "100%", minHeight: 44, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>
          {loading ? "Yükleniyor…" : "Daha fazla göster"}
        </button>
      )}
    </section>
  );
}
