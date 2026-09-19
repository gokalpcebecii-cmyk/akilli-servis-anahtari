"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";

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

      setVehicles(vehicleList ?? []);
    }
    load();
  }, []);

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
      />
      <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
        Kodu QR'ın altındaki yazıdan okuyabilir veya kamerayla QR'ı okutup adres çubuğundaki kodu kopyalayabilirsiniz.
      </p>

      {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {message && <p style={{ color: colors.greenDark, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{message}</p>}

      <button onClick={handleEslestir} disabled={loading} style={primaryButtonStyle(loading)}>
        {loading ? "Eşleştiriliyor..." : "Eşleştir"}
      </button>
    </main>
  );
}
