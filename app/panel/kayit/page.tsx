"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ business_name: "", email: "", password: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Bir hata oluştu");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/panel/login"), 2000);
  }

  if (success) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 380, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Icon name="check" color={colors.greenDark} size={24} />
          </div>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Hesabınız oluşturuldu</h1>
          <p style={{ color: colors.textMuted }}>Giriş sayfasına yönlendiriliyorsunuz...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="otoiz-auth-shell" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div className="otoiz-auth-hero" style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "24px 20px 40px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
          ← Ana sayfaya dön
        </a>
        <div className="otoiz-auth-hero-inner" style={{ maxWidth: 380, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={190} mark="primary" />
          <h1 style={{ fontSize: 23, marginTop: 14, marginBottom: 6, color: colors.textLight, fontWeight: 800 }}>İşletme Kaydı</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            OTOİZ'e ücretsiz katılın, dijital araç servis pasaportuna hemen başlayın.
          </p>
        </div>
      </div>

      <div className="otoiz-auth-form-wrap" style={{ maxWidth: 380, margin: "-24px auto 0", padding: "0 20px 40px" }}>
        <form onSubmit={handleSubmit} style={{ background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
          <label style={labelStyle}>İşletme Adı *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Örn: Yılmaz Oto Servis" />

          <label style={labelStyle}>E-posta *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

          <label style={labelStyle}>Şifre *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="En az 6 karakter" />

          <label style={labelStyle}>Telefon</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0312 000 00 00" />

          <label style={labelStyle}>Adres</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Şehir, ilçe" />

          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
            {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: colors.textDark }}>
          Zaten hesabınız var mı? <a href="/panel/login" style={{ color: colors.greenDark, fontWeight: 600 }}>Giriş yapın</a>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 12.5 }}>
          <a href="/bireysel/kayit" style={{ color: colors.textMuted }}>Bireysel araç sahibi misiniz?</a>
        </p>
      </div>
    </main>
  );
}
