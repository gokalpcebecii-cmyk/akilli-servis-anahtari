"use client";

// OTOİZ Faz 3 — Yönetim › Ürünler: fiziksel ürün partisi üretimi, stok /
// dağıtım durumu, parti çıktıları. Yetki kararı sunucuda (/api/admin/urunler).

import { useEffect, useState } from "react";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle, badgeStyle } from "@/lib/theme";
const { printableQrUrl } = require("@/lib/qrUrl");
const { formatActivationCode } = require("@/lib/activationCode");
const { printCsv, packingCsv, masterCsv } = require("@/lib/productExport");

type Api = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; body: any }>;

const COUNTS = [10, 20, 40, 100, 200];
const CHANNELS: { key: string; label: string }[] = [
  { key: "internet", label: "İnternet" },
  { key: "servis", label: "Servis" },
  { key: "bayi", label: "Bayi / arkadaş" },
  { key: "merkez", label: "Merkez" },
  { key: "bireysel", label: "Bireysel satış" },
];
const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]));
const STATUS: Record<string, { text: string; kind: "success" | "warning" | "danger" | "neutral" }> = {
  created: { text: "Üretildi", kind: "neutral" },
  in_stock: { text: "Stokta", kind: "neutral" },
  distributed: { text: "Dağıtıldı", kind: "warning" },
  activated: { text: "Aktif", kind: "success" },
  revoked: { text: "İptal", kind: "danger" },
  replaced: { text: "Yenilendi", kind: "danger" },
  archived: { text: "Arşiv", kind: "danger" },
};

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function fileSafe(s: string) {
  return s.replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]+/g, "_").slice(0, 60);
}

export default function UrunlerTab({ api, tenants }: { api: Api; tenants: any[] }) {
  const [count, setCount] = useState<number | "">(20);
  const [channel, setChannel] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<{ batch_id: string; label: string; items: any[] } | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [distChannel, setDistChannel] = useState("");
  const [distTenant, setDistTenant] = useState("");
  const [reissued, setReissued] = useState<{ serial_no: string; activation_code: string } | null>(null);

  async function loadBatches() {
    const r = await api("/api/admin/urunler");
    if (r.ok) setBatches(r.body.batches ?? []);
  }
  async function loadProducts(id: string) {
    const r = await api(`/api/admin/urunler?batch_id=${encodeURIComponent(id)}`);
    if (r.ok) setProducts(r.body.products ?? []);
  }
  useEffect(() => {
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload: any) {
    setBusy(true);
    setError("");
    setNotice("");
    const r = await api("/api/admin/urunler", { method: "POST", body: JSON.stringify(payload) });
    setBusy(false);
    if (!r.ok) setError(r.body?.error || "İşlem başarısız");
    return r;
  }

  async function generate() {
    if (typeof count !== "number") return;
    if (!window.confirm(`${count} adet yeni ürün (seri + QR + aktivasyon kodu) üretilsin mi?`)) return;
    const r = await post({ action: "generate", count, channel: channel || null, label });
    if (!r.ok) return;
    setResult({ batch_id: r.body.batch_id, label: r.body.label, items: r.body.items });
    setLabel("");
    loadBatches();
  }

  async function setStatus(batchId: string, status: "in_stock" | "distributed") {
    const r = await post({ action: "set_status", batch_id: batchId, status, channel: distChannel, tenant_id: distTenant || null });
    if (!r.ok) return;
    setNotice(`${r.body.updated} ürün güncellendi`);
    loadBatches();
    if (openBatch === batchId) loadProducts(batchId);
  }

  const approvedTenants = tenants.filter((t) => t.approval_status === "approved");
  const btn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
    padding: "8px 12px", minHeight: 40, borderRadius: radius.sm, border: border ? `1.5px solid ${border}` : "none",
    background: bg, color: fg, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font, textDecoration: "none",
    display: "inline-flex", alignItems: "center",
  });

  return (
    <>
      {notice && <div role="status" style={{ background: colors.greenSoft, color: colors.greenDark, padding: "10px 14px", borderRadius: radius.sm, fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>{notice}</div>}
      {error && <div role="alert" style={{ background: colors.dangerSoft, color: colors.danger, padding: "10px 14px", borderRadius: radius.sm, fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>{error}</div>}

      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Ürün partisi üret</h2>
        <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 12px" }}>
          Her ürün için tek işlemde: seri numarası, kalıcı QR (go adresi) ve tek kullanımlık aktivasyon kodu. Müşteri ürünü kendisi etkinleştirir.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {COUNTS.map((n) => (
            <button key={n} onClick={() => setCount(n)} style={btn(count === n ? colors.green : colors.surfaceLight, colors.textDark, count === n ? undefined : colors.border)}>
              {n} adet
            </button>
          ))}
          <input type="number" inputMode="numeric" min={1} max={500} placeholder="Özel adet" aria-label="Özel adet"
            value={count === "" || COUNTS.includes(count as number) ? "" : count}
            onChange={(e) => setCount(e.target.value ? Math.max(1, Math.min(500, Number(e.target.value))) : "")}
            style={{ ...inputStyle, width: 140 }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={labelStyle} htmlFor="u-channel">Planlanan kanal (isteğe bağlı)</label>
            <select id="u-channel" value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle}>
              <option value="">— Sonra belirlenecek —</option>
              {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <label style={labelStyle} htmlFor="u-label">Parti etiketi (isteğe bağlı)</label>
            <input id="u-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="ör. İlk 20 ürün" style={inputStyle} />
          </div>
        </div>
        <button onClick={generate} disabled={busy || typeof count !== "number"} style={{ ...primaryButtonStyle(busy), width: "auto", padding: "12px 22px" }}>
          {busy ? "Üretiliyor…" : typeof count === "number" ? `${count} ürün üret` : "Adet seçin"}
        </button>
      </section>

      {result && (
        <section data-testid="batch-result" style={{ ...cardStyle, marginBottom: 16, border: `2px solid ${colors.warning}` }}>
          <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>{result.label} — {result.items.length} ürün hazır</h2>
          <p role="alert" style={{ fontSize: 13, color: colors.warning, fontWeight: 700, margin: "0 0 12px" }}>
            Aktivasyon kodları yalnız şimdi gösterilir. Paketleme listesini şimdi indirin ve güvenli saklayın.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <button onClick={() => download(`${fileSafe(result.label)}_paketleme.csv`, packingCsv(result.items, result.label))} style={btn(colors.green, colors.textDark)}>
              Paketleme listesi (seri + kod)
            </button>
            <button onClick={() => download(`${fileSafe(result.label)}_baski.csv`, printCsv(result.items, printableQrUrl, result.label))} style={btn(colors.surfaceLight, colors.textDark, colors.border)}>
              Baskı listesi (seri + QR)
            </button>
            <button onClick={() => download(`${fileSafe(result.label)}_arsiv_GIZLI.csv`, masterCsv(result.items, printableQrUrl, result.label))} style={btn(colors.surfaceLight, colors.textDark, colors.border)}>
              Tam arşiv (gizli)
            </button>
            <a href={`/yonetim/yazdir?batch_id=${result.batch_id}`} target="_blank" rel="noopener" style={btn(colors.textDark, colors.textLight)}>
              QR baskı sayfası
            </a>
          </div>
          <div style={{ maxHeight: 260, overflow: "auto", fontSize: 13, fontFamily: "monospace" }}>
            {result.items.map((i) => (
              <div key={i.id} style={{ display: "flex", gap: 14, padding: "3px 0", borderBottom: `1px solid ${colors.border}` }}>
                <span>{i.serial_no}</span><strong>{formatActivationCode(i.activation_code)}</strong>
              </div>
            ))}
          </div>
          <button onClick={() => setResult(null)} style={{ ...btn("transparent", colors.textMuted), marginTop: 8 }}>Kapat (kodlar bir daha gösterilmez)</button>
        </section>
      )}

      {reissued && (
        <section role="alert" style={{ ...cardStyle, marginBottom: 16, border: `2px solid ${colors.warning}` }}>
          <strong>{reissued.serial_no}</strong> için yeni aktivasyon kodu: <code style={{ fontWeight: 800, fontSize: 16 }}>{formatActivationCode(reissued.activation_code)}</code>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4 }}>Eski kod artık geçersiz. Bu kod yalnız şimdi gösterilir.</div>
          <button onClick={() => setReissued(null)} style={{ ...btn("transparent", colors.textMuted), marginTop: 6 }}>Kapat</button>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Partiler ({batches.length})</h2>
        {batches.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Henüz ürün partisi yok.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map((b) => (
            <div key={b.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center" }}>
                <strong style={{ marginRight: "auto" }}>{b.label}</strong>
                {Object.entries(b.counts as Record<string, number>).map(([s, n]) => (
                  <span key={s} style={badgeStyle(STATUS[s]?.kind ?? "neutral")}>{STATUS[s]?.text ?? s}: {n}</span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <button onClick={() => { const next = openBatch === b.id ? null : b.id; setOpenBatch(next); if (next) loadProducts(next); }} style={btn(colors.surfaceSoft, colors.textDark, colors.border)}>
                  {openBatch === b.id ? "Gizle" : "Ürünler"}
                </button>
                <a href={`/yonetim/yazdir?batch_id=${b.id}`} target="_blank" rel="noopener" style={btn(colors.green, colors.textDark)}>QR baskı</a>
                <button disabled={busy} onClick={() => setStatus(b.id, "in_stock")} style={btn(colors.surfaceSoft, colors.textDark, colors.border)}>Stoğa al</button>
              </div>
              {openBatch === b.id && (
                <div style={{ marginTop: 10, background: colors.surfaceSoft, borderRadius: radius.sm, padding: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <select value={distChannel} onChange={(e) => setDistChannel(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="Dağıtım kanalı">
                      <option value="">— Dağıtım kanalı —</option>
                      {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    {distChannel === "servis" && (
                      <select value={distTenant} onChange={(e) => setDistTenant(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 260 }} aria-label="Servis">
                        <option value="">— Servis —</option>
                        {approvedTenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                    <button disabled={busy || !distChannel || (distChannel === "servis" && !distTenant)} onClick={() => setStatus(b.id, "distributed")} style={btn(colors.textDark, colors.textLight)}>
                      Partiyi dağıtıldı yap
                    </button>
                    <button onClick={() => download(`${fileSafe(b.label)}_baski.csv`, printCsv(products, printableQrUrl, b.label))} style={btn(colors.surfaceLight, colors.textDark, colors.border)}>
                      Baskı listesi (CSV)
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 8px" }}>
                    Servis yalnız dağıtım kanalıdır: ürünü sahiplenmez ve araca bağlayamaz. Müşteri ürünü kendi hesabıyla etkinleştirir.
                  </p>
                  {products.map((p) => (
                    <div key={p.id} style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
                      <code style={{ fontWeight: 700 }}>{p.serial_no}</code>
                      <span style={badgeStyle(STATUS[p.status]?.kind ?? "neutral")}>{STATUS[p.status]?.text ?? p.status}</span>
                      {p.channel && <span>{CHANNEL_LABEL[p.channel]}{p.distributor ? ` · ${p.distributor}` : ""}</span>}
                      {p.locked && <span style={badgeStyle("danger")}>Kilitli (hatalı deneme)</span>}
                      {["created", "in_stock", "distributed"].includes(p.status) && (
                        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                          <button disabled={busy} onClick={async () => {
                            if (!window.confirm(`${p.serial_no} için yeni aktivasyon kodu verilsin mi? Eski kod geçersiz olur.`)) return;
                            const r = await post({ action: "reissue_code", id: p.id });
                            if (r.ok) setReissued({ serial_no: r.body.serial_no, activation_code: r.body.activation_code });
                          }} style={btn(colors.surfaceLight, colors.textDark, colors.border)}>Yeni kod</button>
                          <button disabled={busy} onClick={async () => {
                            if (!window.confirm(`${p.serial_no} arşivlensin mi? QR bir daha açılmaz, geri alınamaz.`)) return;
                            const r = await post({ action: "archive", id: p.id });
                            if (r.ok) { setNotice(`${p.serial_no} arşivlendi`); loadProducts(b.id); loadBatches(); }
                          }} style={btn(colors.surfaceLight, colors.danger, colors.danger)}>Arşivle</button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
