"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

export default function EslestirPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // İkinci düzeltme turu (madde 4): flag kapalıyken araç listesi dahil
    // hiçbir veri çekilmesin — hook'un kendisi (Rules of Hooks gereği)
    // koşulsuz çağrılıyor, yalnızca GÖVDESİ bayrağa göre erken çıkıyor.
    if (!PILOT_FLAGS.qrMatchingSelfService) return;

    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }
      const { data: staff } = await supabase
        .from("staff_users")
        .select("tenant_id")
        .eq("id", session.session.user.id)
        .single();

      const { data: vehicleList } = await supabase
        .from("vehicles")
        .select("id, plate, brand, model")
        .eq("tenant_id", staff?.tenant_id)
        .order("plate");

      // PILOT FIX 03 (bölüm F): geçerli plakası olmayan (boş/eksik araç
      // oluşturma denemesinden kalmış) araçlar eşleştirme listesinde
      // görünmesin.
      setVehicles((vehicleList ?? []).filter((v: any) => v.plate && v.plate.trim()));
    }
    load();
  }, []);

  // İkinci düzeltme turu (madde 4): kamera ile tarama henüz yok; yalnızca
  // manuel URL/kısa-kod eşleştirmeyi açık bırakmak güvenilmez bir yol
  // olduğundan, kamera hazır olana kadar TÜM eşleştirme ekranı kapalı
  // (bkz. lib/pilotFlags.ts, app/api/qr-eslestir/route.ts). Hook'lardan
  // SONRA kontrol edilir (Rules of Hooks).
  if (!PILOT_FLAGS.qrMatchingSelfService) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Bu Özellik Şu An Kullanılamıyor</h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          Anahtarlık/QR eşleştirme, kamera ile güvenli tarama tamamlanana kadar pilot süresince
          kapalı — manuel kod girişi kazara yanlış araca eşleştirme riski taşıyor. Bir eşleştirme
          gerekiyorsa lütfen OTOİZ destek ekibiyle iletişime geçin.
        </p>
        <a href="/panel/dashboard" style={{ color: colors.greenDark, fontWeight: 700, fontSize: 13.5 }}>
          ← Panele dön
        </a>
      </main>
    );
  }

  async function handleEslestir() {
    setError("");
    setMessage("");
    if (!selectedVehicle || !code) {
      setError("Araç ve QR kodu seçin/girin");
      return;
    }
    setLoading(true);

    const { data: session } = await supabase.auth.getSession();
    const res = await fetch("/api/qr-eslestir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token}`,
      },
      body: JSON.stringify({ code: code.trim().toLowerCase(), vehicle_id: selectedVehicle }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Bir hata oluştu");
      return;
    }

    setMessage("Eşleştirme başarılı! QR kod artık bu araca bağlı.");
    setCode("");
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Anahtarlık Eşleştir</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>
        Müşteriye verilecek fiziksel QR anahtarlığı/sticker'ı, sisteme kayıtlı bir araçla eşleştirin.
      </p>

      <label style={labelStyle}>Araç Seç</label>
      <select style={{ ...inputStyle, marginBottom: 14 }} value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)}>
        <option value="">-- Araç seçin --</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.plate} — {v.brand} {v.model}
          </option>
        ))}
      </select>

      <label style={labelStyle}>QR Kodu</label>
      <input
        style={{ ...inputStyle, marginBottom: 6 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Anahtarlık üzerindeki kodu girin"
        autoComplete="off"
      />
      {/* PILOT FIX 03 (bölüm F): "adres çubuğundan URL kopyalama" talimatı
          kaldırıldı — kamera ile tarama bu pilot sürümünde henüz mevcut
          değil (ayrı teknik görev, bkz. final rapor); yanlış yönlendirici
          bir talimat vermek yerine tek, gerçek çalışan yol açıkça anlatılıyor. */}
      <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
        Kodu, QR anahtarlığın/sticker'ın üzerinde basılı kısa koddan (harf ve rakamlardan oluşan kod) okuyup buraya yazın.
      </p>

      {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {message && <p style={{ color: colors.greenDark, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{message}</p>}

      <button onClick={handleEslestir} disabled={loading} style={primaryButtonStyle(loading)}>
        {loading ? "Eşleştiriliyor..." : "Eşleştir"}
      </button>
    </main>
  );
}
