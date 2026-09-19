"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

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
    return <main style={{ padding: 24, textAlign: "center", color: "#999" }}>Yükleniyor…</main>;
  }

  return (
    <main style={{ maxWidth: 360, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 20, fontSize: 13, color: "#888", textDecoration: "none" }}>
        ← Ana sayfaya dön
      </a>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 16 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Servis / İşletme Girişi</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
        Bu alandan işletmenizin OTOİZ panelinize giriş yapıyorsunuz. Müşteri araçlarını ve servis
        kayıtlarını buradan yönetebilirsiniz.
      </p>

      <form onSubmit={handleLogin} noValidate>
        <label htmlFor="panel-email" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>E-posta</label>
        <input
          id="panel-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 14, borderRadius: 8, border: "1px solid #ccc", fontSize: 16 }}
        />

        <label htmlFor="panel-password" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Şifre</label>
        <input
          id="panel-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 16 }}
        />

        <div style={{ textAlign: "right", marginBottom: 14 }}>
          <a href="/hesap/sifremi-unuttum" style={{ fontSize: 12.5, color: "#888" }}>Şifremi unuttum</a>
        </div>

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
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
        İşletme hesabınız yok mu? <a href="/panel/kayit" style={{ color: "#1E3A5F" }}>Kayıt olun</a>
      </p>
      <p style={{ textAlign: "center", marginTop: 8, fontSize: 12.5 }}>
        <a href="/bireysel/giris" style={{ color: "#999" }}>Bireysel araç sahibi misiniz?</a>
      </p>
    </main>
  );
}
