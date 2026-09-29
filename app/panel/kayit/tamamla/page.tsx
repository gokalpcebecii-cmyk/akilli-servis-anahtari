"use client";

// OTOİZ P0 — servis kaydını tamamla: şifre belirle + işletme başvurusu.
//
// Kullanıcı buraya e-postadaki doğrulama bağlantısıyla gelir (Auth hesabı
// doğrular, /hesap/dogrulandi oturum bilgisini yalnız bu sayfaya aktarır).
// Şifreyi yalnız e-posta kutusunun sahibi belirleyebilir; başvuru sunucuda
// submit_service_application() ile, doğrulanmış e-posta şartıyla açılır.
// İşletme OTOİZ onayına kadar araç/kayıt işlemi yapamaz.
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading } from "@/components/AuthShell";
import { ResendConfirmation } from "@/components/ResendConfirmation";
const { validatePassword } = require("@/lib/passwordPolicy");
const { SERVICE_COMPLETE_PATH } = require("@/lib/serviceSignup");

type Stage = "loading" | "nosession" | "form" | "done";

export default function ServisKayitTamamlaPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ business_name: "", phone: "", address: "" });
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneMsg, setDoneMsg] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabase();
      const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const at = p.get("access_token");
      const rt = p.get("refresh_token");
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
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
      const { data: staff } = await supabase.from("staff_users").select("tenant_id").eq("id", user.id).maybeSingle();
      if (staff?.tenant_id) {
        setDoneMsg("Bu hesabın işletme başvurusu zaten var.");
        setStage("done");
        return;
      }
      const m: any = user.user_metadata || {};
      setForm({
        business_name: typeof m.business_name === "string" ? m.business_name : "",
        phone: typeof m.phone === "string" ? m.phone : "",
        address: typeof m.address === "string" ? m.address : "",
      });
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
    if (form.business_name.trim().length < 2) return setError("İşletme adı zorunlu.");
    setBusy(true);
    const supabase = createBrowserSupabase();
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr && (pwErr as any).code !== "same_password") {
        setBusy(false);
        setError("Şifre kaydedilemedi. Bağlantının süresi dolmuş olabilir; yeni bağlantı isteyin.");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/servis-basvuru", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => null);
      setBusy(false);
      if (!res.ok) {
        setError(j?.error || "Başvuru kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setDoneMsg(j?.message || "Başvurunuz alındı.");
      setStage("done");
    } catch {
      setBusy(false);
      setError("Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    }
  }

  if (stage === "loading") return <AuthShellLoading />;

  if (stage === "nosession") {
    return (
      <AuthShell role="servis" title="Doğrulama bağlantısı gerekli" subtitle="Kaydı tamamlamak için e-postanıza gelen bağlantıyı kullanın.">
        <div data-testid="service-complete-nosession">
          <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 14px" }}>
            Bağlantının süresi dolmuş olabilir. E-posta adresinizi yazıp yeni bağlantı isteyin. Şifrenizi daha önce belirlediyseniz giriş yapın.
          </p>
          <ResendConfirmation next={SERVICE_COMPLETE_PATH} />
          <a href="/panel/login" style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 12 }}>Giriş yap</a>
        </div>
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell role="servis" title="Başvurunuz alındı">
        <div data-testid="service-complete-done">
          <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 16px" }}>
            {doneMsg} İşletmeniz OTOİZ tarafından onaylandığında araç ekleyebilir ve bakım kaydı girebilirsiniz.
          </p>
          <a href="/panel/dashboard" style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Panele git</a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell role="servis" title="Kaydı tamamlayın" subtitle={`${email} doğrulandı. Şifrenizi belirleyin ve işletme bilgilerinizi kontrol edin.`}>
      <form onSubmit={submit} data-testid="service-complete-form">
        <label htmlFor="tamamla-sifre" style={labelStyle}>Şifre *</label>
        <input id="tamamla-sifre" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} placeholder="En az 8 karakter" />
        <label htmlFor="tamamla-sifre2" style={labelStyle}>Şifre (tekrar) *</label>
        <input id="tamamla-sifre2" type="password" autoComplete="new-password" minLength={8} required value={password2} onChange={(e) => setPassword2(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
        <label htmlFor="tamamla-ad" style={labelStyle}>İşletme Adı *</label>
        <input id="tamamla-ad" autoComplete="organization" required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} style={{ ...inputStyle, marginBottom: 14 }} />
        <label htmlFor="tamamla-tel" style={labelStyle}>Telefon</label>
        <input id="tamamla-tel" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ ...inputStyle, marginBottom: 14 }} />
        <label htmlFor="tamamla-adres" style={labelStyle}>Adres</label>
        <input id="tamamla-adres" autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ ...inputStyle, marginBottom: 16 }} />
        {error && <p role="alert" style={{ color: colors.danger, fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
        <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>{busy ? "Kaydediliyor…" : "Başvuruyu Gönder"}</button>
      </form>
    </AuthShell>
  );
}
