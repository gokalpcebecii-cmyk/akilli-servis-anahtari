"use client";

// Yönetici — bir QR partisini anahtarlık/etiket baskısı için yazdırma sayfası.
// Veri /api/admin/qr üzerinden gelir (yönetici yetkisi sunucuda doğrulanır).

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font } from "@/lib/theme";
const { printableQrUrl, qrIssuanceLocked, QR_LOCK_MESSAGE } = require("@/lib/qrUrl");

function YazdirInner() {
  const supabase = createBrowserSupabase();
  const params = useSearchParams();
  const batch = params.get("batch") || "";
  // Faz 3: ürün partisi (batch_id) → QR altında seri no yazılır, token değil.
  const batchId = params.get("batch_id") || "";
  const [title, setTitle] = useState(batch);
  const [items, setItems] = useState<{ code: string; label: string; img: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) {
        setError("Önce yönetim paneline giriş yapın.");
        setLoading(false);
        return;
      }
      const path = batchId
        ? `/api/admin/urunler?batch_id=${encodeURIComponent(batchId)}`
        : `/api/admin/qr?filter=all&batch=${encodeURIComponent(batch)}`;
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error === "forbidden" ? "Bu sayfa yalnız yönetici içindir." : body?.error || "Yüklenemedi");
        setLoading(false);
        return;
      }
      const codes: { code: string; label: string }[] = batchId
        ? (body?.products ?? [])
            .filter((p: any) => ["created", "in_stock", "distributed"].includes(p.status))
            .map((p: any) => ({ code: p.token, label: p.serial_no }))
        : (body?.codes ?? []).filter((c: any) => c.status !== "revoked").map((c: any) => ({ code: c.code, label: c.code }));
      if (batchId && body?.batch?.label) setTitle(body.batch.label);
      const out: { code: string; label: string; img: string }[] = [];
      for (const c of codes) {
        const url = printableQrUrl(c.code);
        if (!url) continue;
        const img = await QRCode.toDataURL(url, { margin: 1, width: 300, errorCorrectionLevel: "M" });
        out.push({ code: c.code, label: c.label, img });
      }
      setItems(out);
      setLoading(false);
    }
    load();
  }, [batch, batchId]);

  return (
    <main style={{ fontFamily: font, color: colors.textDark, padding: 16, background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        .qr-cell { border: 1px dashed #c9d2da; border-radius: 10px; padding: 10px; text-align: center; break-inside: avoid; }
      `}</style>
      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <a href="/yonetim" style={{ color: colors.greenDark, fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>← Yönetim</a>
        <h1 style={{ fontSize: 18, margin: 0 }}>{title || "QR partisi"} — {items.length} kod</h1>
        <button
          onClick={() => window.print()}
          disabled={items.length === 0}
          style={{ marginLeft: "auto", padding: "10px 18px", minHeight: 44, borderRadius: 8, border: "none", background: colors.green, fontWeight: 800, cursor: "pointer" }}
        >
          Yazdır
        </button>
      </div>
      {qrIssuanceLocked() && (
        <p role="alert" data-testid="qr-print-locked" style={{ border: `2px solid ${colors.danger}`, color: colors.danger, borderRadius: 8, padding: "10px 12px", fontWeight: 700, margin: "0 0 12px" }}>
          {QR_LOCK_MESSAGE}
        </p>
      )}
      {loading && <p>Hazırlanıyor…</p>}
      {error && <p role="alert" style={{ color: colors.danger }}>{error}</p>}
      <div className="qr-grid">
        {items.map((i) => (
          <div key={i.code} className="qr-cell">
            <img src={i.img} alt={`QR ${i.label}`} style={{ width: "100%", maxWidth: 160, height: "auto" }} />
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 }}>{i.label}</div>
            <div style={{ fontSize: 10, color: colors.textMuted }}>OTOİZ</div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function YazdirPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Yükleniyor…</main>}>
      <YazdirInner />
    </Suspense>
  );
}
