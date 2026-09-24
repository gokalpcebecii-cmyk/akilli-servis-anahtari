"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const { data: t } = await supabase.from("tenants").select("*").eq("id", staff?.tenant_id).single();
      setTenant(t);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const { data: saved, error } = await supabase
      .from("tenants")
      .update({
        name: tenant.name,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
        phone: tenant.phone,
        address: tenant.address,
        website_url: tenant.website_url,
        reminder_days_before: tenant.reminder_days_before,
        reminder_km_before: tenant.reminder_km_before,
      })
      .eq("id", tenant.id)
      .select("id");
    setSaving(false);
    // RLS reddi hata DEĞİL, 0 satır döner — ikisini de başarısızlık say.
    if (error || !saved || saved.length === 0) {
      alert("Kaydedilemedi. Servis ayarlarını yalnızca işletme sahibi hesabı değiştirebilir.");
      return;
    }
    alert("Kaydedildi. Değişiklikler tüm araç sayfalarına anında yansır.");
  }

  if (loading || !tenant) return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Servis Ayarları</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20 }}>
        Buradaki bilgiler ve renkler, müşterilerinizin QR/NFC okuttuğunda gördüğü araç sayfasında görünür.
      </p>

      <label style={labelStyle}>İşletme Adı</label>
      <input style={{ ...inputStyle, marginBottom: 12 }} value={tenant.name || ""} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />

      <label style={labelStyle}>Logo URL</label>
      <input
        style={{ ...inputStyle, marginBottom: 4 }}
        placeholder="https://..."
        value={tenant.logo_url || ""}
        onChange={(e) => setTenant({ ...tenant, logo_url: e.target.value })}
      />
      <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
        Logo dosyanızı yüklemek için bir görsel barındırma servisi kullanılabilir.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Ana Renk</label>
          <input type="color" style={{ ...inputStyle, padding: 4, height: 40, marginBottom: 12 }} value={tenant.primary_color || colors.surfaceDark} onChange={(e) => setTenant({ ...tenant, primary_color: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>İkincil Renk</label>
          <input type="color" style={{ ...inputStyle, padding: 4, height: 40, marginBottom: 12 }} value={tenant.secondary_color || colors.surfaceSoft} onChange={(e) => setTenant({ ...tenant, secondary_color: e.target.value })} />
        </div>
      </div>

      <label style={labelStyle}>Telefon</label>
      <input style={{ ...inputStyle, marginBottom: 12 }} value={tenant.phone || ""} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })} />

      <label style={labelStyle}>Adres</label>
      <input style={{ ...inputStyle, marginBottom: 12 }} value={tenant.address || ""} onChange={(e) => setTenant({ ...tenant, address: e.target.value })} />

      <label style={labelStyle}>Web Sitesi (opsiyonel)</label>
      <input style={{ ...inputStyle, marginBottom: 12 }} value={tenant.website_url || ""} onChange={(e) => setTenant({ ...tenant, website_url: e.target.value })} />

      <h2 style={{ fontSize: 15, color: colors.textMuted, marginTop: 20 }}>Hatırlatma Eşikleri</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Kaç km kala hatırlat</label>
          <input type="number" style={{ ...inputStyle, marginBottom: 12 }} value={tenant.reminder_km_before ?? 500} onChange={(e) => setTenant({ ...tenant, reminder_km_before: Number(e.target.value) })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Kaç gün kala hatırlat</label>
          <input type="number" style={{ ...inputStyle, marginBottom: 12 }} value={tenant.reminder_days_before ?? 14} onChange={(e) => setTenant({ ...tenant, reminder_days_before: Number(e.target.value) })} />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ ...primaryButtonStyle(saving), marginTop: 8 }}>
        {saving ? "Kaydediliyor…" : "Kaydet"}
      </button>

      <a href="/panel/veri-talepleri" style={{ display: "block", textAlign: "center", marginTop: 20, fontSize: 13, color: colors.textMuted, textDecoration: "underline" }}>
        KVKK Veri Silme Talepleri
      </a>
    </main>
  );
}
