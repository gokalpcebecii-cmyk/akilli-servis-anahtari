"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

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

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 14, fontSize: 15 };
  const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Anahtarlık Eşleştir</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Müşteriye verilecek fiziksel QR anahtarlığı/sticker'ı, sisteme kayıtlı bir araçla eşleştirin.
      </p>

      <label style={labelStyle}>Araç Seç</label>
      <select style={inputStyle} value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)}>
        <option value="">-- Araç seçin --</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.plate} — {v.brand} {v.model}
          </option>
        ))}
      </select>

      <label style={labelStyle}>QR Kodu</label>
      <input
        style={inputStyle}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Anahtarlık üzerindeki kodu girin"
      />
      <p style={{ fontSize: 12, color: "#999", marginTop: -10, marginBottom: 14 }}>
        Kodu QR'ın altındaki yazıdan okuyabilir veya kamerayla QR'ı okutup adres çubuğundaki kodu kopyalayabilirsiniz.
      </p>

      {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {message && <p style={{ color: "#2E6B4F", fontSize: 13, marginBottom: 12 }}>{message}</p>}

      <button onClick={handleEslestir} disabled={loading} style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
        {loading ? "Eşleştiriliyor..." : "Eşleştir"}
      </button>
    </main>
  );
}
