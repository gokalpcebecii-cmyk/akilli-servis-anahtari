"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

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
      <main style={{ maxWidth: 380, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>E-posta Gönderildi</h1>
        <p style={{ color: "#666", lineHeight: 1.6 }}>
          <strong>{email}</strong> adresine kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen
          kutunuzu (ve spam klasörünü) kontrol edin.
        </p>
        <a href="/" style={{ fontSize: 13, color: "#1E3A5F" }}>← Ana sayfaya dön</a>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 20, fontSize: 13, color: "#888", textDecoration: "none" }}>
        ← Ana sayfaya dön
      </a>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 16 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Şifremi Unuttum</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
        Hesabınıza kayıtlı e-posta adresini girin, size şifre sıfırlama bağlantısı gönderelim. Bu
        akış hem bireysel hem işletme hesapları için geçerlidir.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="reset-email" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>E-posta</label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 14, borderRadius: 8, border: "1px solid #ccc", fontSize: 16 }}
        />

        {error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          style={{
            width: "100%", padding: 12, borderRadius: 8, border: "none",
            background: loading ? "#5c7186" : "#1E3A5F", color: "#fff", fontWeight: 600,
            cursor: loading ? "wait" : "pointer", fontSize: 15,
          }}
        >
          {loading ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
        </button>
      </form>
    </main>
  );
}
