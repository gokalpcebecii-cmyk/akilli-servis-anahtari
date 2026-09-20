"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle } from "@/lib/theme";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const QUICK_COUNTS = [1, 10, 20, 50];

export default function QrUretimPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  // PILOT FIX 03 (madde F): sayfa artık 0/boş açılıyor — kullanıcı bir
  // adet seçmeden "QR Kodları Üret" pasif kalır.
  const [count, setCount] = useState<number | "">("");
  const [batchLabel, setBatchLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState<{ code: string }[]>([]);
  const [error, setError] = useState("");
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const generatingRef = useRef(false);

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

  const validCount = typeof count === "number" && count >= 1 && count <= 500;

  async function handleGenerate() {
    // Çift tıklama fazladan kod üretmesin (madde F).
    if (generatingRef.current) return;
    if (!validCount) return;
    generatingRef.current = true;
    setConfirming(false);
    setError("");
    setLoading(true);
    setCodes([]);
    setQrImages({});

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setError("Oturumunuz sona ermiş, lütfen tekrar giriş yapın.");
      setLoading(false);
      generatingRef.current = false;
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
      generatingRef.current = false;
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
    generatingRef.current = false;
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

  // PILOT FIX 03 (bölüm F): kabul testleri geçene kadar bu ekran servis
  // hesabında feature flag ile gizli — kazara toplu üretim riski nedeniyle
  // (bkz. lib/pilotFlags.ts). QR token/güvenlik modeli değişmedi.
  if (!PILOT_FLAGS.bulkQrGeneration) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Bu Özellik Şu An Kullanılamıyor</h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          Toplu QR anahtarlık üretimi, pilot süresi boyunca geçici olarak kapalı. Tek araç için QR/NFC
          eşleştirmesi araç detay sayfasından yapılabilir.
        </p>
        <a href="/panel/dashboard" style={{ color: colors.greenDark, fontWeight: 700, fontSize: 13.5 }}>
          ← Panele dön
        </a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>QR Anahtarlık Üretimi</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>
        Boş, hiçbir araca bağlı olmayan benzersiz QR kodları üretir. Bu QR'lar matbaaya verilip anahtarlık/sticker üzerine basılır. Araca bağlama işlemi daha sonra araç kaydında yapılır.
      </p>

      <label style={labelStyle}>Adet</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {QUICK_COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={count === n}
            onClick={() => {
              setCount(n);
              setConfirming(false);
            }}
            style={{
              padding: "9px 16px",
              borderRadius: radius.pill,
              border: count === n ? `1.5px solid ${colors.greenDark}` : `1px solid ${colors.border}`,
              background: count === n ? colors.greenSoft : colors.surfaceLight,
              color: count === n ? colors.greenDark : colors.textDark,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
              fontFamily: "inherit",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <input
        type="number"
        style={{ ...inputStyle, marginBottom: 14, maxWidth: 160 }}
        value={count}
        onChange={(e) => {
          const v = e.target.value;
          setCount(v === "" ? "" : Number(v));
          setConfirming(false);
        }}
        min={1}
        max={500}
        placeholder="Özel adet"
      />

      <label style={labelStyle}>Parti Etiketi (opsiyonel)</label>
      <input style={{ ...inputStyle, marginBottom: 14 }} value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Örn: Eylül 2026 - 1. Parti" />

      {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {!confirming ? (
        <button
          onClick={() => validCount && setConfirming(true)}
          disabled={!validCount || loading}
          style={{ ...primaryButtonStyle(!validCount || loading), width: "auto", padding: "12px 20px", marginBottom: 24 }}
        >
          QR Kodları Üret
        </button>
      ) : (
        <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: 14, marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.textDark, margin: "0 0 10px" }}>
            {count} benzersiz QR üretilecek. Onaylıyor musunuz?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleGenerate} disabled={loading} style={{ ...primaryButtonStyle(loading), width: "auto", padding: "10px 18px" }}>
              {loading ? "Üretiliyor…" : "Onayla, Üret"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${colors.border}`, borderRadius: radius.sm, color: colors.textMuted, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

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
