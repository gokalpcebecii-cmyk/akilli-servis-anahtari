"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthFooterLink } from "@/components/AuthShell";
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
    setTimeout(() => router.push("/panel/login"), 4000);
  }

  if (success) {
    return (
      <AuthShell role="servis" title="Hesabınız oluşturuldu">
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Icon name="check" color={colors.greenDark} size={24} />
        </div>
        <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: 0 }}>
          İşletme başvurunuz OTOİZ onayına gönderildi. Onaylandıktan sonra araç ve bakım kaydı yapabilirsiniz.
          Giriş sayfasına yönlendiriliyorsunuz...
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      role="servis"
      title="İşletme Kaydı"
      subtitle="OTOİZ'e ücretsiz katılın, dijital araç servis pasaportuna hemen başlayın."
      footer={
        <>
          <p>
            Zaten hesabınız var mı? <AuthFooterLink href="/panel/login" strong>Giriş yapın</AuthFooterLink>
          </p>
          <AuthFooterLink href="/bireysel/kayit">Bireysel araç sahibi misiniz?</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="isletme-ad" style={labelStyle}>İşletme Adı *</label>
        <input id="isletme-ad" autoComplete="organization" style={{ ...inputStyle, marginBottom: 14 }} required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Örn: Yılmaz Oto Servis" />

        <label htmlFor="isletme-email" style={labelStyle}>E-posta *</label>
        <input id="isletme-email" autoComplete="email" inputMode="email" autoCapitalize="none" style={{ ...inputStyle, marginBottom: 14 }} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

        <label htmlFor="isletme-sifre" style={labelStyle}>Şifre *</label>
        <input id="isletme-sifre" autoComplete="new-password" style={{ ...inputStyle, marginBottom: 14 }} required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="En az 8 karakter" />

        <label htmlFor="isletme-tel" style={labelStyle}>Telefon</label>
        <input id="isletme-tel" type="tel" inputMode="tel" autoComplete="tel" style={{ ...inputStyle, marginBottom: 14 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0312 000 00 00" />

        <label htmlFor="isletme-adres" style={labelStyle}>Adres</label>
        <input id="isletme-adres" autoComplete="street-address" style={{ ...inputStyle, marginBottom: 16 }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Şehir, ilçe" />

        {error && <p role="alert" style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
      </form>
    </AuthShell>
  );
}
