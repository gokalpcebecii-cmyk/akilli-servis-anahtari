"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { reportClientEvent } from "@/lib/clientEvent";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading, AuthFooterLink } from "@/components/AuthShell";
import { InstallCta } from "@/components/InstallCta";
import { ResendConfirmation } from "@/components/ResendConfirmation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function BireyselGirisForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bireysel/araclar";

  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        router.replace(redirectTo);
        return;
      }
      if (searchParams.get("oturum") === "bitti") {
        setError("Oturumunuz sona erdi. Devam etmek için lütfen tekrar giriş yapın.");
      }
      setCheckingSession(false);
    }
    checkExistingSession();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setUnconfirmed(false);

    // PILOT FIX 03 (madde A6): boş/biçimsiz e-posta ve boş şifre sunucuya
    // gitmeden, alan altında Türkçe hatayla yakalanır — "boş form" ile
    // "yanlış kimlik bilgisi" artık aynı genel mesajı paylaşmıyor.
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = "E-posta zorunlu.";
    else if (!EMAIL_RE.test(trimmedEmail)) errors.email = "Geçerli bir e-posta adresi girin.";
    if (!password) errors.password = "Şifre zorunlu.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      document.getElementById(errors.email ? "bireysel-email" : "bireysel-password")?.focus();
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const supabase = createBrowserSupabase();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      setLoading(false);
      if (error) {
        reportClientEvent("login_failed", "bireysel", (error as any).code);
        // Sunucudan gelen ham teknik metin asla doğrudan gösterilmez;
        // yalnızca durum koduna göre iki genel, anlaşılır mesajdan biri.
        if ((error as any).code === "email_not_confirmed") {
          // Faz 3.1: e-posta doğrulanmadan giriş yapılamaz (Supabase Auth).
          setUnconfirmed(true);
          setError("E-posta adresin henüz doğrulanmadı. Gelen kutundaki doğrulama bağlantısına bas, sonra tekrar giriş yap.");
        } else if (typeof error.status === "number" && error.status >= 500) {
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
    router.push(redirectTo);
  }

  if (checkingSession) {
    return <AuthShellLoading />;
  }

  const kayitHref = `/bireysel/kayit${next ? `?next=${encodeURIComponent(redirectTo)}` : ""}`;

  return (
    <AuthShell
      role="bireysel"
      title="Bireysel Giriş"
      subtitle="Araçlarınızın bakım geçmişine ve dijital pasaportuna buradan ulaşın."
      footer={
        <>
          <p>
            Hesabınız yok mu? <AuthFooterLink href={kayitHref} strong>Kayıt olun</AuthFooterLink>
          </p>
          <AuthFooterLink href="/panel/login">Servis / İşletme hesabınız mı var?</AuthFooterLink>
        </>
      }
      after={<InstallCta tone="dark" />}
    >
      <form onSubmit={handleLogin} noValidate>
        <label htmlFor="bireysel-email" style={labelStyle}>E-posta</label>
        <input autoCorrect="off" spellCheck={false}
          id="bireysel-email"
          type="text" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Geçerli bir e-posta adresi girin"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? "bireysel-email-err" : undefined}
          style={{ ...inputStyle, marginBottom: fieldErrors.email ? 4 : 14, borderColor: fieldErrors.email ? colors.danger : colors.border }}
        />
        {fieldErrors.email && (
          <p id="bireysel-email-err" role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 10px" }}>
            {fieldErrors.email}
          </p>
        )}

        <label htmlFor="bireysel-password" style={labelStyle}>Şifre</label>
        <input
          id="bireysel-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? "bireysel-password-err" : undefined}
          style={{ ...inputStyle, marginBottom: fieldErrors.password ? 4 : 2, borderColor: fieldErrors.password ? colors.danger : colors.border }}
        />
        {fieldErrors.password && (
          <p id="bireysel-password-err" role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 2px" }}>
            {fieldErrors.password}
          </p>
        )}

        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <a href="/hesap/sifremi-unuttum" className="otoiz-auth2-inline-link">Şifremi unuttum</a>
        </div>

        {error && (
          <p role="alert" style={{ color: colors.danger, fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
      {unconfirmed && (
        <div style={{ marginTop: 14 }}>
          <ResendConfirmation email={email.trim().toLowerCase()} next={redirectTo} />
        </div>
      )}
    </AuthShell>
  );
}

export default function BireyselGirisPage() {
  return (
    <Suspense fallback={<AuthShellLoading />}>
      <BireyselGirisForm />
    </Suspense>
  );
}
