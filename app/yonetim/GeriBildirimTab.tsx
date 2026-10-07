"use client";
// OTOİZ — Yönetim: "Geri Bildirimler" sekmesi. Liste · detay · screenshot ·
// durum değiştirme. Yalnız MFA'lı yönetici görebilir.
import { useEffect, useState } from "react";
import { colors, font, radius, cardStyle, inputStyle } from "@/lib/theme";
const { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, FEEDBACK_STATUS_LABELS, feedbackLabel } = require("@/lib/feedback");

type Api = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; body: any }>;

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function GeriBildirimTab({ api }: { api: Api }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (categoryFilter) qs.set("category", categoryFilter);
    const r = await api(`/api/admin/geri-bildirim${qs.toString() ? "?" + qs : ""}`);
    setLoading(false);
    if (r.ok) setData(r.body);
    else setError(r.body?.error || "Geri bildirimler yüklenemedi");
  }

  useEffect(() => { load(); }, [statusFilter, categoryFilter]);

  async function openDetail(row: any) {
    setSelected(row);
    setScreenshotUrl("");
    if (row.screenshot_path) {
      const r = await api(`/api/admin/geri-bildirim/gorsel?path=${encodeURIComponent(row.screenshot_path)}`);
      if (r.ok) setScreenshotUrl(r.body.url);
    }
  }

  async function changeStatus(status: string) {
    if (!selected || saving) return;
    setSaving(true);
    const r = await api("/api/admin/geri-bildirim", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status }) });
    setSaving(false);
    if (r.ok) { setSelected({ ...selected, status }); load(); }
    else setError(r.body?.error || "Durum güncellenemedi");
  }

  return (
    <section style={{ ...cardStyle, fontFamily: font, color: colors.text }} aria-label="Geri Bildirimler">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, margin: 0, marginRight: "auto" }}>Geri Bildirimler</h2>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minHeight: 40 }} aria-label="Durum filtresi">
          <option value="">Tüm durumlar</option>
          {FEEDBACK_STATUSES.map((s: string) => <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minHeight: 40 }} aria-label="Kategori filtresi">
          <option value="">Tüm konular</option>
          {FEEDBACK_CATEGORIES.map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={load} disabled={loading} style={{ minHeight: 40, padding: "0 14px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>Yenile</button>
      </div>
      {error && <p role="alert" style={{ color: colors.danger, fontWeight: 700 }}>{error}</p>}
      {data && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {(["yeni", "inceleniyor", "cozuldu"] as const).map((s) => (
            <span key={s} style={{ background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>
              {FEEDBACK_STATUS_LABELS[s]}: {data.counts?.[s] ?? 0}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 14 }}>
        <div>
          {(data?.rows ?? []).map((r: any) => (
            <button key={r.id} onClick={() => openDetail(r)} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px", marginBottom: 8, borderRadius: radius.md, border: `1px solid ${selected?.id === r.id ? colors.green : colors.border}`, background: colors.surfaceRaised, cursor: "pointer" }} data-testid="feedback-satir">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{feedbackLabel(r.category, FEEDBACK_CATEGORIES)}</span>
                <span style={{ fontSize: 12, color: r.status === "cozuldu" ? colors.greenLight : r.status === "inceleniyor" ? colors.warning : colors.danger, fontWeight: 700 }}>{FEEDBACK_STATUS_LABELS[r.status]}</span>
              </div>
              <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{r.message.slice(0, 80)}{r.message.length > 80 ? "…" : ""}</div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{fmt(r.created_at)}{r.screenshot_path ? " · görsel var" : ""}</div>
            </button>
          ))}
          {data && (data.rows ?? []).length === 0 && <p style={{ color: colors.textMuted }}>Kayıt yok.</p>}
        </div>
        {selected && (
          <div style={{ borderLeft: `1px solid ${colors.border}`, paddingLeft: 14 }} data-testid="feedback-detay">
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{feedbackLabel(selected.category, FEEDBACK_CATEGORIES)}</h3>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{selected.message}</p>
            <p style={{ fontSize: 12.5, color: colors.textMuted }}>Ekran: {selected.screen} · {fmt(selected.created_at)}</p>
            {screenshotUrl && <img src={screenshotUrl} alt="Geri bildirim ekran görüntüsü" style={{ maxWidth: "100%", borderRadius: radius.md, marginTop: 8 }} />}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {FEEDBACK_STATUSES.map((s: string) => (
                <button key={s} disabled={saving || selected.status === s} onClick={() => changeStatus(s)} style={{ minHeight: 40, padding: "0 14px", borderRadius: radius.sm, border: `1px solid ${selected.status === s ? colors.green : colors.border}`, background: selected.status === s ? colors.greenSoft : colors.surfaceLight, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  {FEEDBACK_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <button onClick={() => setSelected(null)} style={{ marginTop: 10, background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: 13 }}>Kapat</button>
          </div>
        )}
      </div>
    </section>
  );
}
