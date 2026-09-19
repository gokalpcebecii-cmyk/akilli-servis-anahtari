"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle } from "@/lib/theme";

export default function QrUretimPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [count, setCount] = useState(50);
  const [batchLabel, setBatchLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState<{ code: string }[]>([]);
  const [error, setError] = useState("");
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    async function checkSession() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
      }
    }
    checkSession();
  }, []);

  async function handleGenerate() {
    setError("");
    setLoading(true);
    setCodes([]);
    setQrImages({});

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setError("Oturumunuz sona ermiş, lütfen tekrar giriş yapın.");
      setLoading(false);
      router.push("/panel/login");
      return;
    }

    const res = await fetch("/api/qr-uretim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session.access_token}`,
      },
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

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>QR Anahtarlık Üretimi</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>
        Boş, hiçbir araca bağlı olmayan benzersiz QR kodları üretir. Bu QR'lar matbaaya verilip anahtarlık/sticker üzerine basılır. Araca bağlama işlemi daha sonra araç kaydında yapılır.
      </p>

      <label style={labelStyle}>Adet</label>
      <input type="number" style={{ ...inputStyle, marginBottom: 14 }} value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={500} />

      <label style={labelStyle}>Parti Etiketi (opsiyonel)</label>
      <input style={{ ...inputStyle, marginBottom: 14 }} value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Örn: Eylül 2026 - 1. Parti" />

      {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button onClick={handleGenerate} disabled={loading} style={{ ...primaryButtonStyle(loading), width: "auto", padding: "12px 20px", marginBottom: 24 }}>
        {loading ? "Üretiliyor..." : "QR Kodları Üret"}
      </button>

      {codes.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: colors.textDark, margin: 0 }}>{codes.length} adet QR üretildi.</p>
            <button onClick={downloadAll} style={{ padding: "8px 16px", background: colors.greenDark, color: colors.textLight, border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", minHeight: 36 }}>
              Tümünü İndir
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
            {codes.map((c) => (
              <div key={c.code} style={{ ...cardStyle, padding: 10, textAlign: "center" }}>
                {qrImages[c.code] && <img src={qrImages[c.code]} alt={c.code} style={{ width: "100%", borderRadius: 6 }} />}
                <p style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, wordBreak: "break-all" }}>{c.code}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
