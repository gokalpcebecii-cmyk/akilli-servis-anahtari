"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

export default function SifreGuncellePage() {
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    // Supabase, sıfırlama bağlantısındaki token'ı otomatik işleyip bir
    // PASSWORD_RECOVERY oturumu açar. Bu event gelmeden şifre güncelleme
    // formunu göstermiyoruz.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      } else {
        setInvalidLink(true);
      }
    }, 1500);

    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir, tekrar deneyin.");
      return;
    }
    setDone(true);
  }

  const inputStyle = { width: "100%", padding: 10, marginBottom: 14, borderRadius: 8, border: "1px solid #ccc", fontSize: 16 };

  if (done) {
    return (
      <main style={{ maxWidth: 380, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: "#2E6B4F" }}>✓ Şifreniz Güncellendi</h1>
        <p style={{ color: "#666", marginBottom: 20 }}>Yeni şifrenizle giriş yapabilirsiniz.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 240, margin: "0 auto" }}>
          <a href="/bireysel/giris" style={{ padding: "10px 16px", background: "#1E3A5F", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            Bireysel Giriş
          </a>
          <a href="/panel/login" style={{ padding: "10px 16px", border: "1px solid #ccc", color: "#333", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            Kurumsal Giriş
          </a>
        </div>
      </main>
    );
  }

  if (invalidLink) {
    return (
      <main style={{ maxWidth: 380, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Bağlantı Geçersiz veya Süresi Dolmuş</h1>
        <p style={{ color: "#666", marginBottom: 20 }}>Lütfen yeni bir şifre sıfırlama bağlantısı isteyin.</p>
        <a href="/hesap/sifremi-unuttum" style={{ color: "#1E3A5F", fontWeight: 600 }}>Tekrar Dene</a>
      </main>
    );
  }

  if (!ready) {
    return <main style={{ padding: 24, textAlign: "center", color: "#999" }}>Doğrulanıyor…</main>;
  }

  return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 16 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Yeni Şifre Belirle</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>Hesabınız için yeni bir şifre girin.</p>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="new-password" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Yeni Şifre</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        <label htmlFor="confirm-password" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Yeni Şifre (Tekrar)</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={inputStyle}
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
          {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
        </button>
      </form>
    </main>
  );
}
