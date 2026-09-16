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
    motor_yagi_km: "",
    motor_yagi_tarihi: "",
    yag_filtresi_km: "",
    yag_filtresi_tarihi: "",
    hava_filtresi_km: "",
    hava_filtresi_tarihi: "",
    polen_filtresi_km: "",
    polen_filtresi_tarihi: "",
    triger_seti_km: "",
    triger_seti_tarihi: "",
    fren_balata_km: "",
    fren_balata_tarihi: "",
    batarya_degisim_tarihi: "",
    silecek_degisim_tarihi: "",
    lastik_degisim_km: "",
    lastik_degisim_tarihi: "",
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
        const next: any = {};
        for (const key in form) {
          next[key] = data[key] ?? "";
        }
        setForm(next);
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

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, fontSize: 15 };
  const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };
  const groupStyle = { marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #eee" };
  const groupTitle = { fontSize: 14, fontWeight: 700, color: "#1E3A5F", marginBottom: 10 };

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  const items = [
    { key: "motor_yagi", label: "Motor Yağı" },
    { key: "yag_filtresi", label: "Yağ Filtresi" },
    { key: "hava_filtresi", label: "Hava Filtresi" },
    { key: "polen_filtresi", label: "Polen Filtresi" },
    { key: "triger_seti", label: "Triger Seti" },
    { key: "fren_balata", label: "Fren Disk-Balata" },
  ];

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Araç Bakım Bilgileri</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Bu bilgiler müşteri araç sağlık özeti sayfasında görünür.
      </p>

      {items.map((it) => (
        <div key={it.key} style={groupStyle}>
          <div style={groupTitle}>{it.label}</div>
          <label style={labelStyle}>Sonraki Değişim Km</label>
          <input
            type="number"
            style={inputStyle}
            value={(form as any)[`${it.key}_km`]}
            onChange={(e) => setForm({ ...form, [`${it.key}_km`]: e.target.value })}
          />
          <label style={labelStyle}>Sonraki Değişim Tarihi</label>
          <input
            type="date"
            style={inputStyle}
            value={(form as any)[`${it.key}_tarihi`]}
            onChange={(e) => setForm({ ...form, [`${it.key}_tarihi`]: e.target.value })}
          />
        </div>
      ))}

      <div style={groupStyle}>
        <div style={groupTitle}>Akü</div>
        <label style={labelStyle}>Değişim Tarihi</label>
        <input type="date" style={inputStyle} value={form.batarya_degisim_tarihi} onChange={(e) => setForm({ ...form, batarya_degisim_tarihi: e.target.value })} />
      </div>

      <div style={groupStyle}>
        <div style={groupTitle}>Silecek</div>
        <label style={labelStyle}>Değişim Tarihi</label>
        <input type="date" style={inputStyle} value={form.silecek_degisim_tarihi} onChange={(e) => setForm({ ...form, silecek_degisim_tarihi: e.target.value })} />
      </div>

      <div style={groupStyle}>
        <div style={groupTitle}>Lastik</div>
        <label style={labelStyle}>Sonraki Değişim Km</label>
        <input type="number" style={inputStyle} value={form.lastik_degisim_km} onChange={(e) => setForm({ ...form, lastik_degisim_km: e.target.value })} />
        <label style={labelStyle}>Sonraki Değişim Tarihi</label>
        <input type="date" style={inputStyle} value={form.lastik_degisim_tarihi} onChange={(e) => setForm({ ...form, lastik_degisim_tarihi: e.target.value })} />
      </div>

      <div style={groupStyle}>
        <div style={groupTitle}>Diğer</div>
        <label style={labelStyle}>Muayene Tarihi</label>
        <input type="date" style={inputStyle} value={form.muayene_tarihi} onChange={(e) => setForm({ ...form, muayene_tarihi: e.target.value })} />
        <label style={labelStyle}>Trafik Sigortası Bitiş</label>
        <input type="date" style={inputStyle} value={form.trafik_sigortasi_bitis} onChange={(e) => setForm({ ...form, trafik_sigortasi_bitis: e.target.value })} />
        <label style={labelStyle}>Kasko Bitiş</label>
        <input type="date" style={inputStyle} value={form.kasko_bitis} onChange={(e) => setForm({ ...form, kasko_bitis: e.target.value })} />
      </div>

      {message && <p style={{ fontSize: 13, color: message.startsWith("Hata") ? "#c0392b" : "#2E6B4F", marginBottom: 12 }}>{message}</p>}

      <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
        {saving ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </main>
  );
                                                                                                           }
