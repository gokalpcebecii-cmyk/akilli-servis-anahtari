"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading } from "@/components/AuthShell";
const { parseRecoveryParams } = require("@/lib/emailConfirm");

export default function SifreGuncellePage() {
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // Yeni bağlantı biçimi (?token_hash=…&type=recovery): tarayıcıya bağlı
    // değil, 5 dakikalık PKCE süresi yok. Token burada tüketilmez; kullanıcı
    // "Devam et"e basınca doğrulanır (e-posta tarayıcılarının bağlantıyı
    // önceden açıp tek kullanımlık token'ı harcamasını önler).
    const recovery = parseRecoveryParams(window.location.search);
    if (recovery) {
      if (recovery.invalid) setInvalidLink(true);
      else setPendingToken(recovery.tokenHash);
      return;
    }

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

  async function verifyRecovery() {
    if (!pendingToken || verifying) return;
    setVerifying(true);
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: pendingToken, type: "recovery" });
    setVerifying(false);
    // Token adres çubuğunda ve geçmişte kalmasın.
    window.history.replaceState(null, "", window.location.pathname);
    setPendingToken("");
    if (error || !data.session) {
      setInvalidLink(true);
      return;
    }
    setReady(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
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
      <AuthShell role="hesap" title="Şifreniz Güncellendi" subtitle="Yeni şifrenizle giriş yapabilirsiniz.">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href="/bireysel/giris" style={{ ...primaryButtonStyle(false), textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Bireysel Giriş
          </a>
          <a href="/panel/login" style={{ ...secondaryButtonStyle(), textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Kurumsal Giriş
          </a>
        </div>
      </AuthShell>
    );
  }

  if (invalidLink) {
    return (
      <AuthShell role="hesap" title="Bağlantı Geçersiz veya Süresi Dolmuş" subtitle="Lütfen yeni bir şifre sıfırlama bağlantısı isteyin.">
        <a href="/hesap/sifremi-unuttum" style={{ ...primaryButtonStyle(false), textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          Tekrar Dene
        </a>
      </AuthShell>
    );
  }

  if (pendingToken) {
    return (
      <AuthShell role="hesap" title="Şifre Sıfırlama" subtitle="Yeni şifreni belirlemek için devam et." backHref={null}>
        <button type="button" data-testid="recovery-continue" onClick={verifyRecovery} disabled={verifying} aria-busy={verifying} style={primaryButtonStyle(verifying)}>
          {verifying ? "Doğrulanıyor…" : "Devam et"}
        </button>
      </AuthShell>
    );
  }

  if (!ready) {
    return <AuthShellLoading text="Doğrulanıyor…" />;
  }

  return (
    <AuthShell role="hesap" title="Yeni Şifre Belirle" subtitle="Hesabınız için yeni bir şifre girin." backHref={null}>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="new-password" style={labelStyle}>Yeni Şifre</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        <label htmlFor="confirm-password" style={labelStyle}>Yeni Şifre (Tekrar)</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        {error && (
          <p role="alert" style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} aria-busy={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
        </button>
      </form>
    </AuthShell>
  );
}
