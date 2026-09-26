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
  const [items, setItems] = useState<{ code: string; img: string }[]>([]);
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
      const res = await fetch(`/api/admin/qr?filter=all&batch=${encodeURIComponent(batch)}`, {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error === "forbidden" ? "Bu sayfa yalnız yönetici içindir." : body?.error || "Yüklenemedi");
        setLoading(false);
        return;
      }
      const codes: any[] = (body?.codes ?? []).filter((c: any) => c.status !== "revoked");
      const out: { code: string; img: string }[] = [];
      for (const c of codes) {
        const url = printableQrUrl(c.code);
        if (!url) continue;
        const img = await QRCode.toDataURL(url, { margin: 1, width: 300, errorCorrectionLevel: "M" });
        out.push({ code: c.code, img });
      }
      setItems(out);
      setLoading(false);
    }
    load();
  }, [batch]);

  return (
    <main style={{ fontFamily: font, color: colors.textDark, padding: 16, background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        .qr-cell { border: 1px dashed #c9d2da; border-radius: 10px; padding: 10px; text-align: center; break-inside: avoid; }
      `}</style>
      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <a href="/yonetim" style={{ color: colors.greenDark, fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>← Yönetim</a>
        <h1 style={{ fontSize: 18, margin: 0 }}>{batch || "QR partisi"} — {items.length} kod</h1>
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
            <img src={i.img} alt={`QR ${i.code}`} style={{ width: "100%", maxWidth: 160, height: "auto" }} />
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 }}>{i.code}</div>
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
