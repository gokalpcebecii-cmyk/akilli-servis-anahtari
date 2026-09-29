"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { reportClientEvent } from "@/lib/clientEvent";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthFooterLink } from "@/components/AuthShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    // PILOT FIX 03 (madde A6): boş/biçimsiz e-posta sunucuya hiç
    // gitmeden alan altında yakalanır — "Bir şeyler ters gitti" artık
    // yalnızca gerçek sunucu hatasında görünür.
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldError("E-posta zorunlu.");
      document.getElementById("reset-email")?.focus();
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setFieldError("Geçerli bir e-posta adresi girin.");
      document.getElementById("reset-email")?.focus();
      return;
    }
    setFieldError("");
    setLoading(true);

    const supabase = createBrowserSupabase();
    // Hesap var mı yok mu bilgisini sızdırmamak için Supabase hata
    // döndürse bile aynı "gönderildi" mesajını gösteriyoruz — yalnızca
    // gerçek bağlantı hatasında ayrı bir mesaj veriyoruz.
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/hesap/sifre-guncelle`,
      });
      // Yanıt yine aynı (hesap varlığı sızdırılmaz); hata yalnız Sistem Sağlığı'na sayılır.
      if (resetError) reportClientEvent("auth_error", "sifre", (resetError as any).code);
      setLoading(false);
      setSent(true);
    } catch {
      setLoading(false);
      setError("Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    }
  }

  if (sent) {
    return (
      <AuthShell role="hesap" title="E-posta Gönderildi">
        <p style={{ color: colors.textMuted, lineHeight: 1.6, margin: "0 0 18px" }}>
          <strong style={{ color: colors.textDark }}>{email}</strong> adresine kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen
          kutunuzu (ve spam klasörünü) kontrol edin.
        </p>
        <a href="/" style={{ ...primaryButtonStyle(false), textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          Ana sayfaya dön
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      role="hesap"
      title="Şifremi Unuttum"
      subtitle="Hesabınıza kayıtlı e-posta adresini girin, size şifre sıfırlama bağlantısı gönderelim. Bireysel ve işletme hesapları için geçerlidir."
      footer={
        <p>
          Şifrenizi hatırladınız mı? <AuthFooterLink href="/bireysel/giris" strong>Giriş yapın</AuthFooterLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="reset-email" style={labelStyle}>E-posta</label>
        <input autoCorrect="off" spellCheck={false}
          id="reset-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "reset-email-err" : undefined}
          style={{ ...inputStyle, marginBottom: fieldError ? 4 : 16, borderColor: fieldError ? colors.danger : colors.border }}
        />
        {fieldError && (
          <p id="reset-email-err" role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 12px" }}>
            {fieldError}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
        </button>
      </form>
    </AuthShell>
  );
}
