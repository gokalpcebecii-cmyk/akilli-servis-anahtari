"use client";

// OTOİZ P0 — yönetici iki adımlı doğrulama (TOTP) ekranı.
// mode="gate": şifreyle giriş sonrası. Doğrulanmış cihaz varsa 6 haneli kod
//   ister; yoksa kurulum (QR + gizli anahtar) gösterir.
// mode="add": panel içinden yedek doğrulayıcı cihaz ekleme (kurtarma için).
// Yetki kararı burada değil, sunucuda (lib/adminAuth.ts, aal2) verilir.
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, inputStyle, labelStyle, primaryButtonStyle, radius } from "@/lib/theme";
const { isSixDigitCode } = require("@/lib/adminMfa");

type Enrollment = { factorId: string; qr: string; secret: string };

export function AdminMfa({ mode, onVerified, onCancel }: { mode: "gate" | "add"; onVerified: () => void; onCancel?: () => void }) {
  const [phase, setPhase] = useState<"loading" | "challenge" | "enroll" | "error">("loading");
  const [factorId, setFactorId] = useState<string>("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function startEnroll() {
    const supabase = createBrowserSupabase();
    // Yarım kalmış (doğrulanmamış) kurulumlar temizlenir.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `OTOİZ Yönetim ${stamp}` });
    if (error || !data) {
      setMsg("Doğrulayıcı kurulumu başlatılamadı. Sayfayı yenileyip tekrar deneyin.");
      setPhase("error");
      return;
    }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setFactorId(data.id);
    setPhase("enroll");
  }

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabase();
      if (mode === "add") return startEnroll();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setMsg("Doğrulama bilgisi alınamadı. Sayfayı yenileyin.");
        setPhase("error");
        return;
      }
      const verified = (data?.totp ?? []).filter((f) => f.status === "verified");
      if (verified.length > 0) {
        setFactorId(verified[0].id);
        setPhase("challenge");
      } else {
        await startEnroll();
      }
    }
    init();
  }, [mode]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = code.replace(/\s+/g, "");
    if (!isSixDigitCode(clean)) {
      setMsg("Uygulamadaki 6 haneli kodu girin.");
      return;
    }
    setBusy(true);
    setMsg("");
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    setBusy(false);
    if (error) {
      setCode("");
      setMsg((error as any).status === 429 ? "Çok fazla deneme. Biraz bekleyip tekrar deneyin." : "Kod hatalı veya süresi geçti. Uygulamadaki güncel kodu girin.");
      return;
    }
    onVerified();
  }

  const codeInput = (
    <form onSubmit={verify}>
      <label htmlFor="mfa-code" style={labelStyle}>6 haneli doğrulama kodu</label>
      <input id="mfa-code" data-testid="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} style={{ ...inputStyle, marginBottom: 12, fontSize: 22, letterSpacing: 6, textAlign: "center" }} />
      {msg && <p role="alert" style={{ color: colors.danger, fontSize: 14, margin: "0 0 12px" }}>{msg}</p>}
      <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>{busy ? "Doğrulanıyor…" : "Doğrula"}</button>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: colors.textMuted, marginTop: 12, cursor: "pointer", width: "100%", minHeight: 44 }}>Vazgeç</button>
      )}
    </form>
  );

  if (phase === "loading") return <p role="status" style={{ color: colors.textMuted }}>Hazırlanıyor…</p>;
  if (phase === "error") return <p role="alert" style={{ color: colors.danger }}>{msg}</p>;

  if (phase === "challenge") {
    return (
      <div data-testid="mfa-challenge">
        <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 14px" }}>
          Telefonunuzdaki doğrulayıcı uygulamasında (Google Authenticator, Microsoft Authenticator vb.) görünen OTOİZ kodunu girin.
        </p>
        {codeInput}
      </div>
    );
  }

  return (
    <div data-testid="mfa-enroll">
      <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 12px" }}>
        {mode === "add"
          ? "Yedek cihazdaki doğrulayıcı uygulamasıyla bu kodu okutun. Bir cihazı kaybederseniz diğeriyle girebilirsiniz."
          : "Yönetim paneli için iki adımlı doğrulama zorunludur. Telefonunuzdaki doğrulayıcı uygulamasıyla bu kodu okutun, ardından uygulamadaki 6 haneli kodu girin."}
      </p>
      {enrollment && (
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <img src={enrollment.qr} alt="Doğrulayıcı QR kodu" width={200} height={200} style={{ background: "#fff", padding: 8, borderRadius: radius.sm }} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "8px 0 0", wordBreak: "break-all" }}>
            QR okutamıyorsanız anahtar: <code data-testid="mfa-secret">{enrollment.secret}</code>
          </p>
        </div>
      )}
      {codeInput}
    </div>
  );
}
