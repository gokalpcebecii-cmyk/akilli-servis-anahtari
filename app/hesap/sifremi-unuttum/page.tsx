"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/hesap/sifre-guncelle`,
    });

    setLoading(false);
    // Hesap var mı yok mu bilgisini sızdırmamak için hata durumunda bile
    // aynı "gönderildi" mesajını gösteriyoruz.
    if (error) {
      setError("Bir şeyler ters gitti, lütfen daha sonra tekrar deneyin.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 380, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>E-posta Gönderildi</h1>
          <p style={{ color: colors.textMuted, lineHeight: 1.6 }}>
            <strong>{email}</strong> adresine kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen
            kutunuzu (ve spam klasörünü) kontrol edin.
          </p>
          <a href="/" style={{ fontSize: 13, color: colors.greenDark, fontWeight: 600 }}>← Ana sayfaya dön</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "24px 20px 40px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
          ← Ana sayfaya dön
        </a>
        <div style={{ maxWidth: 360, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={17} />
          <h1 style={{ fontSize: 23, marginTop: 14, marginBottom: 6, color: colors.textLight, fontWeight: 800 }}>Şifremi Unuttum</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            Hesabınıza kayıtlı e-posta adresini girin, size şifre sıfırlama bağlantısı gönderelim. Bu
            akış hem bireysel hem işletme hesapları için geçerlidir.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 360, margin: "-24px auto 0", padding: "0 20px 40px" }}>
        <form onSubmit={handleSubmit} noValidate style={{ background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
          <label htmlFor="reset-email" style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>E-posta</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          {error && (
            <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
            {loading ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
          </button>
        </form>
      </div>
    </main>
  );
}
