"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

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

  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 380, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Icon name="check" color={colors.greenDark} size={24} />
          </div>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Şifreniz Güncellendi</h1>
          <p style={{ color: colors.textMuted, marginBottom: 20 }}>Yeni şifrenizle giriş yapabilirsiniz.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 240, margin: "0 auto" }}>
            <a href="/bireysel/giris" style={{ ...primaryButtonStyle(false), textDecoration: "none", display: "block", textAlign: "center" }}>
              Bireysel Giriş
            </a>
            <a href="/panel/login" style={{ ...secondaryButtonStyle(), textDecoration: "none", display: "block", textAlign: "center" }}>
              Kurumsal Giriş
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (invalidLink) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 380, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Bağlantı Geçersiz veya Süresi Dolmuş</h1>
          <p style={{ color: colors.textMuted, marginBottom: 20 }}>Lütfen yeni bir şifre sıfırlama bağlantısı isteyin.</p>
          <a href="/hesap/sifremi-unuttum" style={{ color: colors.greenDark, fontWeight: 700 }}>Tekrar Dene</a>
        </div>
      </main>
    );
  }

  if (!ready) {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Doğrulanıyor…</main>;
  }

  return (
    <main className="otoiz-auth-shell" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div className="otoiz-auth-hero" style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "24px 20px 40px" }}>
        <div className="otoiz-auth-hero-inner" style={{ maxWidth: 360, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={190} mark="primary" />
          <h1 style={{ fontSize: 23, marginTop: 14, marginBottom: 6, color: colors.textLight, fontWeight: 800 }}>Yeni Şifre Belirle</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, margin: 0 }}>Hesabınız için yeni bir şifre girin.</p>
        </div>
      </div>

      <div className="otoiz-auth-form-wrap" style={{ maxWidth: 360, margin: "-24px auto 0", padding: "0 20px 40px" }}>
        <form onSubmit={handleSubmit} noValidate style={{ background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
          <label htmlFor="new-password" style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>Yeni Şifre</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label htmlFor="confirm-password" style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>Yeni Şifre (Tekrar)</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          {error && (
            <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
            {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
          </button>
        </form>
      </div>
    </main>
  );
}
