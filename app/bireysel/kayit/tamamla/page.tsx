"use client";

// OTOİZ P0 — bireysel kaydı tamamla: şifre belirle.
//
// Kayıt formunda şifre alınmaz; doğrulanmamış hesabın şifresini veritabanı
// rastgele tutar (başkasının e-postasıyla açılan ön kayıt bu yüzden hiçbir
// işe yaramaz). Kullanıcı buraya e-postadaki doğrulama bağlantısıyla gelir;
// /hesap/dogrulandi oturum bilgisini yalnız bu sabit sayfaya aktarır. Şifreyi
// böylece yalnız e-posta kutusunun sahibi belirler.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading } from "@/components/AuthShell";
import { ResendConfirmation } from "@/components/ResendConfirmation";
const { validatePassword } = require("@/lib/passwordPolicy");
const { safeNext, INDIVIDUAL_COMPLETE_PATH } = require("@/lib/emailConfirm");

type Stage = "loading" | "nosession" | "form" | "done";

function Inner() {
  const params = useSearchParams();
  const rawNext = safeNext(params.get("next") || "");
  const next = rawNext && !rawNext.startsWith(INDIVIDUAL_COMPLETE_PATH) ? rawNext : "/bireysel/araclar";
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabase();
      const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const at = p.get("access_token");
      const rt = p.get("refresh_token");
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (at && rt) {
        await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      }
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user || !user.email_confirmed_at) {
        setStage("nosession");
        return;
      }
      setEmail(user.email ?? "");
      setStage("form");
    }
    init();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const pwError = validatePassword(password);
    if (pwError) return setError(pwError);
    if (password !== password2) return setError("Şifreler aynı değil.");
    setBusy(true);
    try {
      const { error: pwErr } = await createBrowserSupabase().auth.updateUser({ password });
      setBusy(false);
      if (pwErr && (pwErr as any).code !== "same_password") {
        setError("Şifre kaydedilemedi. Bağlantının süresi dolmuş olabilir; yeni bağlantı iste.");
        return;
      }
      setStage("done");
      window.location.replace(next);
    } catch {
      setBusy(false);
      setError("Bağlantı hatası. İnternet bağlantını kontrol edip tekrar dene.");
    }
  }

  if (stage === "loading") return <AuthShellLoading />;

  if (stage === "nosession") {
    return (
      <AuthShell role="bireysel" title="Doğrulama bağlantısı gerekli" subtitle="Kaydı tamamlamak için e-postana gelen bağlantıyı kullan.">
        <div data-testid="ind-complete-nosession">
          <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 14px" }}>
            Bağlantının süresi dolmuş olabilir. E-posta adresini yazıp yeni bağlantı iste. Şifreni daha önce belirlediysen giriş yap.
          </p>
          <ResendConfirmation next={next} />
          <a href={`/bireysel/giris?next=${encodeURIComponent(next)}`} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 12 }}>Giriş yap</a>
        </div>
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell role="bireysel" title="Hesabın hazır">
        <p data-testid="ind-complete-done" role="status" style={{ color: colors.textMuted, margin: 0 }}>Yönlendiriliyorsun…</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell role="bireysel" title="Şifreni belirle" subtitle={`${email} doğrulandı. Hesabın için bir şifre belirle.`}>
      <form onSubmit={submit} data-testid="ind-complete-form">
        <label htmlFor="ind-sifre" style={labelStyle}>Şifre *</label>
        <input id="ind-sifre" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} placeholder="En az 8 karakter" />
        <label htmlFor="ind-sifre2" style={labelStyle}>Şifre (tekrar) *</label>
        <input id="ind-sifre2" type="password" autoComplete="new-password" minLength={8} required value={password2} onChange={(e) => setPassword2(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
        {error && <p role="alert" style={{ color: colors.danger, fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
        <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>{busy ? "Kaydediliyor…" : "Şifreyi Kaydet ve Devam Et"}</button>
      </form>
    </AuthShell>
  );
}

export default function BireyselKayitTamamlaPage() {
  return (
    <Suspense fallback={<AuthShellLoading />}>
      <Inner />
    </Suspense>
  );
}
