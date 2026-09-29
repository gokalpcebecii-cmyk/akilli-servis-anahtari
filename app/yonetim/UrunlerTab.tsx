"use client";

// OTOİZ Faz 3 / Aşama B — Yönetim › Ürünler / Baskı Merkezi: fiziksel ürün
// partisi üretimi, otomatik parti doğrulaması, 7 baskı/paketleme dosyasının
// panelden indirilmesi, stok / dağıtım durumu. Yetki kararı sunucuda
// (/api/admin/urunler). Dosyalar tarayıcıda üretilir; aktivasyon kodları
// sunucuya geri gönderilmez.

import { useEffect, useState } from "react";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle, badgeStyle } from "@/lib/theme";
import { VerificationPanel, runClientChecks, downloadFile, downloadZip, FILE_LABELS, type FileKey, type Item } from "./BaskiMerkezi";
const { formatActivationCode } = require("@/lib/activationCode");

const PRINT_KEYS: FileKey[] = ["qr_pdf", "print_csv", "serial_txt", "svg_zip"];
const SECRET_KEYS: FileKey[] = ["packing_pdf", "packing_csv", "secret_csv"];
const PRE_ACTIVATION = ["created", "in_stock", "distributed"];

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

export default function UrunlerTab({ api, tenants }: { api: Api; tenants: any[] }) {
  const [count, setCount] = useState<number | "">(20);
  const [channel, setChannel] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<{ batch_id: string; label: string; items: Item[]; verification: any; reissued?: boolean } | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [batchView, setBatchView] = useState<{ id: string; label: string; items: Item[]; verification: any } | null>(null);
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [distChannel, setDistChannel] = useState("");
  const [distTenant, setDistTenant] = useState("");
  const [reissued, setReissued] = useState<{ serial_no: string; activation_code: string } | null>(null);

  const [batchesNext, setBatchesNext] = useState<string | null>(null);
  // P1: partiler 50'lik sayfalar hâlinde gelir; "Daha fazla parti" sonrakini ekler.
  async function loadBatches(cursor?: string | null) {
    const r = await api(`/api/admin/urunler${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!r.ok) return;
    setBatches((prev) => (cursor ? [...prev, ...(r.body.batches ?? [])] : r.body.batches ?? []));
    setBatchesNext(r.body.next_cursor ?? null);
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

  // Tarayıcı kontrollerini çalıştırıp sonucu sunucuya kaydeder; sunucu
  // veritabanı kontrollerini de yeniden yapar ve birleşik sonucu döner.
  async function verifyBatch(batchId: string, label: string, items: Item[], expected: number, scope: "generation" | "reverify") {
    setVerifying(batchId);
    try {
      const client = await runClientChecks(label, items, expected, scope);
      const r = await api("/api/admin/urunler", { method: "POST", body: JSON.stringify({ action: "verify", batch_id: batchId, client }) });
      if (!r.ok) {
        setError(r.body?.error || "Doğrulama kaydedilemedi");
        return null;
      }
      return r.body.verification;
    } catch (e: any) {
      setError(`Doğrulama çalışmadı: ${e?.message || e}`);
      return null;
    } finally {
      setVerifying(null);
    }
  }

  async function generate() {
    if (typeof count !== "number") return;
    if (!window.confirm(`${count} adet yeni ürün (seri + QR + aktivasyon kodu) üretilsin mi?`)) return;
    const r = await post({ action: "generate", count, channel: channel || null, label });
    if (!r.ok) return;
    const items: Item[] = r.body.items;
    setResult({ batch_id: r.body.batch_id, label: r.body.label, items, verification: r.body.verification });
    setLabel("");
    loadBatches();
    const v = await verifyBatch(r.body.batch_id, r.body.label, items, count, "generation");
    if (v) setResult((cur) => (cur && cur.batch_id === r.body.batch_id ? { ...cur, verification: v } : cur));
    loadBatches();
  }

  async function reissueBatch(b: any) {
    if (!window.confirm(`${b.label}: partideki tüm ürünlere YENİ aktivasyon kodu verilsin mi?\n\nEski kodlar ve eski paketleme kartları geçersiz olur. Yalnız kartlar henüz basılmadıysa kullanın.`)) return;
    const r = await post({ action: "reissue_batch_codes", batch_id: b.id });
    if (!r.ok) return;
    const items: Item[] = r.body.items;
    setResult({ batch_id: b.id, label: b.label, items, verification: r.body.verification, reissued: true });
    const v = await verifyBatch(b.id, b.label, items, items.length, "generation");
    if (v) setResult((cur) => (cur && cur.batch_id === b.id ? { ...cur, verification: v } : cur));
    loadBatches();
  }

  async function openFiles(b: any) {
    if (batchView?.id === b.id) { setBatchView(null); return; }
    const r = await api(`/api/admin/urunler?batch_id=${encodeURIComponent(b.id)}`);
    if (!r.ok) { setError(r.body?.error || "Parti yüklenemedi"); return; }
    const printable: Item[] = (r.body.products ?? [])
      .filter((p: any) => PRE_ACTIVATION.includes(p.status))
      .map((p: any) => ({ id: p.id, serial_no: p.serial_no, token: p.token }));
    setBatchView({ id: b.id, label: b.label, items: printable, verification: r.body.batch?.verification ?? null });
  }

  async function reverify() {
    if (!batchView) return;
    const v = await verifyBatch(batchView.id, batchView.label, batchView.items, batchView.items.length, "reverify");
    if (v) setBatchView({ ...batchView, verification: v });
    loadBatches();
  }

  async function fileAction(key: string, fn: () => Promise<void>, verification: any) {
    if (verification && !verification.ready && !window.confirm("Bu parti için sonuç: BASKIYA HAZIR DEĞİL.\n\nDosya yine de indirilsin mi? Bu dosyayı matbaaya göndermeyin.")) return;
    if (!verification && !window.confirm("Bu parti henüz doğrulanmadı. Dosya yine de indirilsin mi?")) return;
    setFileBusy(key);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(`Dosya üretilemedi: ${e?.message || e}`);
    } finally {
      setFileBusy(null);
    }
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
          <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>
            {result.label} — {result.items.length} ürün {result.reissued ? "için yeni kodlar" : "hazır"}
          </h2>
          <p role="alert" style={{ fontSize: 13, color: colors.warning, fontWeight: 700, margin: "0 0 12px" }}>
            Aktivasyon kodları yalnız şimdi indirilebilir. Paketleme dosyalarını şimdi indirin ve güvenli saklayın.
          </p>
          <VerificationPanel v={result.verification} label={result.label} busy={verifying === result.batch_id} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "14px 0 8px" }}>
            <button
              data-testid="download-all"
              disabled={!!fileBusy || verifying === result.batch_id}
              onClick={() => fileAction("all", () => downloadZip("all", result.label, result.items), result.verification)}
              style={{ ...btn(colors.green, colors.textDark), minHeight: 48, fontSize: 14.5 }}
            >
              {fileBusy === "all" ? "Hazırlanıyor…" : "Tüm dosyalar (ZIP)"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(Object.keys(FILE_LABELS) as FileKey[]).map((k) => (
              <button key={k} disabled={!!fileBusy || verifying === result.batch_id}
                onClick={() => fileAction(k, () => downloadFile(k, result.label, result.items), result.verification)}
                style={btn(colors.surfaceLight, SECRET_KEYS.includes(k) ? colors.danger : colors.textDark, colors.border)}>
                {fileBusy === k ? "Hazırlanıyor…" : FILE_LABELS[k]}
              </button>
            ))}
          </div>
          <details style={{ fontSize: 13 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, minHeight: 32 }}>Kodları ekranda göster</summary>
            <div style={{ maxHeight: 260, overflow: "auto", fontFamily: "monospace", marginTop: 6 }}>
              {result.items.map((i) => (
                <div key={i.serial_no} style={{ display: "flex", gap: 14, padding: "3px 0", borderBottom: `1px solid ${colors.border}` }}>
                  <span>{i.serial_no}</span><strong>{formatActivationCode(i.activation_code)}</strong>
                </div>
              ))}
            </div>
          </details>
          <button onClick={() => { if (window.confirm("Kapatırsanız aktivasyon kodları bir daha gösterilmez. Paketleme dosyalarını indirdiniz mi?")) setResult(null); }} style={{ ...btn("transparent", colors.textMuted), marginTop: 8 }}>
            Kapat (kodlar bir daha gösterilmez)
          </button>
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
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Baskı Merkezi · Partiler ({batches.length}{batchesNext ? "+" : ""})</h2>
        {batches.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Henüz ürün partisi yok.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map((b) => (
            <div key={b.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center" }}>
                <strong style={{ marginRight: "auto" }}>{b.label}</strong>
                <span data-testid="batch-ready-badge" style={badgeStyle(!b.verification ? "neutral" : b.verification.ready ? "success" : "danger")}>
                  {!b.verification ? "Doğrulanmadı" : b.verification.ready ? "BASKIYA HAZIR" : "BASKIYA HAZIR DEĞİL"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12.5, color: colors.textMuted, marginTop: 4 }}>
                <span>Seri: <strong style={{ color: colors.textDark, fontFamily: "monospace" }}>{b.serial_first ? `${b.serial_first} – ${b.serial_last}` : "—"}</strong></span>
                <span>Adet: <strong style={{ color: colors.textDark }}>{b.quantity}</strong></span>
                <span>Kanal: <strong style={{ color: colors.textDark }}>{(b.channels?.length ? b.channels : b.default_channel ? [b.default_channel] : []).map((c: string) => CHANNEL_LABEL[c] ?? c).join(", ") || "—"}</strong></span>
                <span>{new Date(b.created_at).toLocaleDateString("tr-TR")}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {Object.entries(b.counts as Record<string, number>).map(([s, n]) => (
                  <span key={s} style={badgeStyle(STATUS[s]?.kind ?? "neutral")}>{STATUS[s]?.text ?? s}: {n}</span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <button onClick={() => openFiles(b)} style={btn(batchView?.id === b.id ? colors.textDark : colors.green, batchView?.id === b.id ? colors.textLight : colors.textDark)}>
                  {batchView?.id === b.id ? "Dosyaları gizle" : "Baskı dosyaları"}
                </button>
                <button onClick={() => { const next = openBatch === b.id ? null : b.id; setOpenBatch(next); if (next) loadProducts(next); }} style={btn(colors.surfaceSoft, colors.textDark, colors.border)}>
                  {openBatch === b.id ? "Gizle" : "Ürünler"}
                </button>
                <button disabled={busy} onClick={() => setStatus(b.id, "in_stock")} style={btn(colors.surfaceSoft, colors.textDark, colors.border)}>Stoğa al</button>
              </div>
              {batchView?.id === b.id && (
                <div data-testid="batch-files" style={{ marginTop: 10, background: colors.surfaceSoft, borderRadius: radius.sm, padding: 10 }}>
                  <VerificationPanel v={batchView.verification} label={b.label} busy={verifying === b.id} />
                  <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "10px 0 8px" }}>
                    Basılabilir ürün: <strong>{batchView.items.length}</strong> (etkinleştirilmiş, iptal ya da arşiv ürünler baskı dosyasına girmez).
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button disabled={!!verifying} onClick={reverify} style={btn(colors.textDark, colors.textLight)}>
                      {verifying === b.id ? "Doğrulanıyor…" : "Yeniden doğrula"}
                    </button>
                    <button disabled={!!fileBusy || !!verifying || batchView.items.length === 0}
                      onClick={() => fileAction("print-zip", () => downloadZip("print", b.label, batchView.items), batchView.verification)}
                      style={btn(colors.green, colors.textDark)}>
                      {fileBusy === "print-zip" ? "Hazırlanıyor…" : "Baskı paketi (ZIP)"}
                    </button>
                    {PRINT_KEYS.map((k) => (
                      <button key={k} disabled={!!fileBusy || !!verifying || batchView.items.length === 0}
                        onClick={() => fileAction(k, () => downloadFile(k, b.label, batchView.items), batchView.verification)}
                        style={btn(colors.surfaceLight, colors.textDark, colors.border)}>
                        {fileBusy === k ? "Hazırlanıyor…" : FILE_LABELS[k]}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: colors.textMuted, margin: "10px 0 6px" }}>
                    Paketleme kartları, paketleme CSV'si ve gizli arşiv aktivasyon kodu içerir; yalnız üretim anında indirilebilir.
                    Dosyayı kaybettiyseniz ve kartlar henüz basılmadıysa partiye yeni kodlar verebilirsiniz.
                  </p>
                  {Object.keys(b.counts || {}).every((s) => s === "created") && (
                    <button disabled={busy} onClick={() => reissueBatch(b)} style={btn(colors.surfaceLight, colors.danger, colors.danger)}>
                      Yeni kodlarla paketleme dosyası oluştur
                    </button>
                  )}
                </div>
              )}
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
        {batchesNext && (
          <button onClick={() => loadBatches(batchesNext)} style={{ marginTop: 12, width: "100%", minHeight: 44, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>
            Daha fazla parti göster
          </button>
        )}
      </section>
    </>
  );
}
