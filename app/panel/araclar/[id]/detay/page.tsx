"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle as themeInputStyle, labelStyle as themeLabelStyle, primaryButtonStyle } from "@/lib/theme";

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
  // Diğer araç formlarındaki (bireysel/panel [id]) savingRef deseniyle
  // aynı: çift tıklama/Enter+click, senkron ref sayesinde re-render
  // beklemeden engellenir (yalnızca disabled={saving} state kontrolü
  // hızlı çift tıklamayı yakalayamaz).
  const savingRef = useRef(false);

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
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");

    const payload: any = {};
    for (const key in form) {
      const value = (form as any)[key];
      payload[key] = value === "" ? null : value;
    }

    const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId);
    savingRef.current = false;
    setSaving(false);

    if (error) {
      setMessage("Hata: " + error.message);
    } else {
      setMessage("Kaydedildi.");
    }
  }

  const inputStyle = { ...themeInputStyle, marginBottom: 10 };
  const labelStyle = themeLabelStyle;
  const groupStyle = { marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${colors.border}` };
  const groupTitle = { fontSize: 14, fontWeight: 700, color: colors.textDark, marginBottom: 10 };

  if (loading) return <main style={{ padding: 24, textAlign: "center" as const, color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;

  const items = [
    { key: "motor_yagi", label: "Motor Yağı" },
    { key: "yag_filtresi", label: "Yağ Filtresi" },
    { key: "hava_filtresi", label: "Hava Filtresi" },
    { key: "polen_filtresi", label: "Polen Filtresi" },
    { key: "triger_seti", label: "Triger Seti" },
    { key: "fren_balata", label: "Fren Disk-Balata" },
  ];

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Araç Bakım Bilgileri</h1>
      <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 20 }}>
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

      {message && <p role="alert" style={{ fontSize: 13, color: message.startsWith("Hata") ? colors.danger : colors.greenDark, marginBottom: 12 }}>{message}</p>}

      <button onClick={handleSave} disabled={saving} style={primaryButtonStyle(saving)}>
        {saving ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </main>
  );
}
