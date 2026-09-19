"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        router.replace("/panel/dashboard");
        return;
      }
      setCheckingSession(false);
    }
    checkExistingSession();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("E-posta veya şifre hatalı. Bilgilerinizi kontrol edip tekrar deneyin.");
      return;
    }
    router.push("/panel/dashboard");
  }

  if (checkingSession) {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div
        className="otoiz-hero-pattern"
        style={{ position: "relative", overflow: "hidden", background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "24px 20px 48px" }}
      >
        <div className="otoiz-reflection" aria-hidden="true" />
        <a href="/" style={{ position: "relative", display: "inline-block", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
          ← Ana sayfaya dön
        </a>
        <div style={{ position: "relative", maxWidth: 360, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={190} mark="primary" />
          <div className="otoiz-accent-line" style={{ margin: "12px 0 16px" }} />
          <h1 style={{ fontSize: 23, marginTop: 0, marginBottom: 6, color: colors.textLight, fontWeight: 800 }}>Servis / İşletme Girişi</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            Bu alandan işletmenizin OTOİZ panelinize giriş yapıyorsunuz. Müşteri araçlarını ve servis
            kayıtlarını buradan yönetebilirsiniz.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 360, margin: "-24px auto 0", padding: "0 20px 40px" }}>
        <form
          onSubmit={handleLogin}
          noValidate
          style={{ background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}
        >
          <label htmlFor="panel-email" style={labelStyle}>E-posta</label>
          <input
            id="panel-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label htmlFor="panel-password" style={labelStyle}>Şifre</label>
          <input
            id="panel-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 8 }}
          />

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <a href="/hesap/sifremi-unuttum" style={{ fontSize: 12.5, color: colors.textMuted }}>Şifremi unuttum</a>
          </div>

          {error && (
            <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: colors.textDark }}>
          İşletme hesabınız yok mu? <a href="/panel/kayit" style={{ color: colors.greenDark, fontWeight: 600 }}>Kayıt olun</a>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 12.5 }}>
          <a href="/bireysel/giris" style={{ color: colors.textMuted }}>Bireysel araç sahibi misiniz?</a>
        </p>
      </div>
    </main>
  );
}
