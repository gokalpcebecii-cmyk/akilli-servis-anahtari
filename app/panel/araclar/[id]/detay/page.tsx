"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function AracDetayPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createBrowserSupabase();
  const vehicleId = params.id as string;

  const [form, setForm] = useState({
    batarya_degisim_tarihi: "",
    silecek_degisim_tarihi: "",
    lastik_degisim_km: "",
    lastik_degisim_tarihi: "",
    fren_balata_km: "",
    fren_balata_tarihi: "",
    muayene_tarihi: "",
    trafik_sigortasi_bitis: "",
    kasko_bitis: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }
      const { data } = await supabase.from("vehicles").select("*").eq("id", vehicleId).single();
      if (data) {
        setForm({
          batarya_degisim_tarihi: data.batarya_degisim_tarihi || "",
          silecek_degisim_tarihi: data.silecek_degisim_tarihi || "",
          lastik_degisim_km: data.lastik_degisim_km || "",
          lastik_degisim_tarihi: data.lastik_degisim_tarihi || "",
          fren_balata_km: data.fren_balata_km || "",
          fren_balata_tarihi: data.fren_balata_tarihi || "",
          muayene_tarihi: data.muayene_tarihi || "",
          trafik_sigortasi_bitis: data.trafik_sigortasi_bitis || "",
          kasko_bitis: data.kasko_bitis || "",
        });
      }
      setLoading(false);
    }
    load();
  }, [vehicleId]);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const payload: any = {};
    for (const key in form) {
      const value = (form as any)[key];
      payload[key] = value === "" ? null : value;
    }

    const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId);
    setSaving(false);

    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setMessage("Kaydedildi.");
    }
  }

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 14, fontSize: 15 };
  const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Araç Ek Bilgileri</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
        Bu bilgiler müşteri araç sağlık özeti sayfasında görünür.
      </p>

      <label style={labelStyle}>Akü Değişim Tarihi</label>
      <input type="date" style={inputStyle} value={form.batarya_degisim_tarihi} onChange={(e) => setForm({ ...form, batarya_degisim_tarihi: e.target.value })} />

      <label style={labelStyle}>Silecek Değişim Tarihi</label>
      <input type="date" style={inputStyle} value={form.silecek_degisim_tarihi} onChange={(e) => setForm({ ...form, silecek_degisim_tarihi: e.target.value })} />

      <label style={labelStyle}>Lastik Değişim Km (sonraki)</label>
      <input type="number" style={inputStyle} value={form.lastik_degisim_km} onChange={(e) => setForm({ ...form, lastik_degisim_km: e.target.value })} />

      <label style={labelStyle}>Lastik Değişim Tarihi</label>
      <input type="date" style={inputStyle} value={form.lastik_degisim_tarihi} onChange={(e) => setForm({ ...form, lastik_degisim_tarihi: e.target.value })} />

      <label style={labelStyle}>Fren Balata Km (sonraki)</label>
      <input type="number" style={inputStyle} value={form.fren_balata_km} onChange={(e) => setForm({ ...form, fren_balata_km: e.target.value })} />

      <label style={labelStyle}>Fren Balata Tarihi</label>
      <input type="date" style={inputStyle} value={form.fren_balata_tarihi} onChange={(e) => setForm({ ...form, fren_balata_tarihi: e.target.value })} />

      <label style={labelStyle}>Muayene Tarihi</label>
      <input type="date" style={inputStyle} value={form.muayene_tarihi} onChange={(e) => setForm({ ...form, muayene_tarihi: e.target.value })} />

      <label style={labelStyle}>Trafik Sigortası Bitiş</label>
      <input type="date" style={inputStyle} value={form.trafik_sigortasi_bitis} onChange={(e) => setForm({ ...form, trafik_sigortasi_bitis: e.target.value })} />

      <label style={labelStyle}>Kasko Bitiş</label>
      <input type="date" style={inputStyle} value={form.kasko_bitis} onChange={(e) => setForm({ ...form, kasko_bitis: e.target.value })} />

      {message && <p style={{ fontSize: 13, color: message.startsWith("Hata") ? "#c0392b" : "#2E6B4F", marginBottom: 12 }}>{message}</p>}

      <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
        {saving ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </main>
  );
      }
