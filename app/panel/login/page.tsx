"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { reportClientEvent } from "@/lib/clientEvent";
import { colors, inputStyle, labelStyle, primaryButtonStyle, alertBoxStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading, AuthFooterLink } from "@/components/AuthShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
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
      if (new URLSearchParams(window.location.search).get("oturum") === "bitti") {
        setError("Oturumunuz sona erdi. Devam etmek için lütfen tekrar giriş yapın.");
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
    setError(null);

    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = "E-posta zorunlu.";
    else if (!EMAIL_RE.test(trimmedEmail)) errors.email = "Geçerli bir e-posta adresi girin.";
    if (!password) errors.password = "Şifre zorunlu.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      document.getElementById(errors.email ? "panel-email" : "panel-password")?.focus();
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const supabase = createBrowserSupabase();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      setLoading(false);
      if (error) {
        reportClientEvent("login_failed", "servis", (error as any).code);
        if (typeof error.status === "number" && error.status >= 500) {
          setError("Sunucuda geçici bir sorun oluştu. Lütfen birazdan tekrar deneyin.");
        } else {
          setError("E-posta veya şifre hatalı. Bilgilerinizi kontrol edip tekrar deneyin.");
        }
        return;
      }
    } catch {
      setLoading(false);
      setError("Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      return;
    }
    router.push("/panel/dashboard");
  }

  if (checkingSession) {
    return <AuthShellLoading />;
  }

  return (
    <AuthShell
      role="servis"
      title="Servis / İşletme Girişi"
      subtitle="İşletmenizin OTOİZ paneline giriş yapın; müşteri araçlarını ve servis kayıtlarını buradan yönetin."
      footer={
        <>
          <p>
            İşletme hesabınız yok mu? <AuthFooterLink href="/panel/kayit" strong>Kayıt olun</AuthFooterLink>
          </p>
          <AuthFooterLink href="/bireysel/giris">Bireysel araç sahibi misiniz?</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={handleLogin} noValidate>
        <label htmlFor="panel-email" style={labelStyle}>E-posta</label>
        <input autoCorrect="off" spellCheck={false}
          id="panel-email"
          type="text" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Geçerli bir e-posta adresi girin"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? "panel-email-err" : undefined}
          style={{ ...inputStyle, marginBottom: fieldErrors.email ? 4 : 14, borderColor: fieldErrors.email ? colors.danger : colors.border }}
        />
        {fieldErrors.email && (
          <p id="panel-email-err" role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 10px" }}>
            {fieldErrors.email}
          </p>
        )}

        <label htmlFor="panel-password" style={labelStyle}>Şifre</label>
        <input
          id="panel-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? "panel-password-err" : undefined}
          style={{ ...inputStyle, marginBottom: fieldErrors.password ? 4 : 2, borderColor: fieldErrors.password ? colors.danger : colors.border }}
        />
        {fieldErrors.password && (
          <p id="panel-password-err" role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 2px" }}>
            {fieldErrors.password}
          </p>
        )}

        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <a href="/hesap/sifremi-unuttum" className="otoiz-auth2-inline-link">Şifremi unuttum</a>
        </div>

        {error && (
          <p role="alert" style={alertBoxStyle}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
    </AuthShell>
  );
}
