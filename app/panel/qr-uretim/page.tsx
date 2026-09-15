"use client";

import { useState } from "react";
import QRCode from "qrcode";

export default function QrUretimPage() {
  const [count, setCount] = useState(50);
  const [batchLabel, setBatchLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState<{ code: string }[]>([]);
  const [error, setError] = useState("");
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function handleGenerate() {
    setError("");
    setLoading(true);
    setCodes([]);
    setQrImages({});

    const res = await fetch("/api/qr-uretim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, batch_label: batchLabel || undefined }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Bir hata oluştu");
      setLoading(false);
      return;
    }

    setCodes(data.codes);

    const images: Record<string, string> = {};
    for (const item of data.codes) {
      const url = `${baseUrl}/p/${item.code}`;
      images[item.code] = await QRCode.toDataURL(url, { width: 300, margin: 1 });
    }
    setQrImages(images);
    setLoading(false);
  }

  function downloadAll() {
    codes.forEach((c) => {
      const link = document.createElement("a");
      link.href = qrImages[c.code];
      link.download = `qr-${c.code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 14, fontSize: 15 };
  const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>QR Anahtarlık Üretimi</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Boş, hiçbir araca bağlı olmayan benzersiz QR kodları üretir. Bu QR'lar matbaaya verilip anahtarlık/sticker üzerine basılır. Araca bağlama işlemi daha sonra araç kaydında yapılır.
      </p>

      <label style={labelStyle}>Adet</label>
      <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={500} />

      <label style={labelStyle}>Parti Etiketi (opsiyonel)</label>
      <input style={inputStyle} value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Örn: Eylül 2026 - 1. Parti" />

      {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button onClick={handleGenerate} disabled={loading} style={{ padding: "12px 20px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginBottom: 24 }}>
        {loading ? "Üretiliyor..." : "QR Kodları Üret"}
      </button>

      {codes.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: "#333", margin: 0 }}>{codes.length} adet QR üretildi.</p>
            <button onClick={downloadAll} style={{ padding: "8px 16px", background: "#2E6B4F", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
              Tümünü İndir
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
            {codes.map((c) => (
              <div key={c.code} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, textAlign: "center" }}>
                {qrImages[c.code] && <img src={qrImages[c.code]} alt={c.code} style={{ width: "100%", borderRadius: 6 }} />}
                <p style={{ fontSize: 10, color: "#888", marginTop: 6, wordBreak: "break-all" }}>{c.code}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
