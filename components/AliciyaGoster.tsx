"use client";

// OTOİZ — "Alıcıya Göster" aracı. Araç sahibi aracını satarken geçmişini
// güvenli, süreli ve iptal edilebilir şekilde alıcının görebileceği bir
// satış sunumuna dönüştürür. QR paylaşımı, PDF ve e-posta aynı akışta.
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle, inputStyle, labelStyle, helperStyle, errorTextStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import QRCode from "qrcode";

type ShareOption = "24h" | "3d" | "7d";

export function AliciyaGoster({ vehicleId }: { vehicleId: string }) {
  const supabase = createBrowserSupabase();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "share" | "create" | "email" | "pdf">("menu");
  const [shares, setShares] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [duration, setDuration] = useState<ShareOption>("24h");
  const [created, setCreated] = useState<{ url: string; expires_at: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "busy" | "error" | "done">("idle");
  const createRef = useRef(false);

  async function authedFetch(input: string, init: RequestInit) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("no-session");
    return fetch(input, {
      ...init,
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await authedFetch("/api/alici-raporu/share", { method: "POST", body: JSON.stringify({ op: "list", vehicle_id: vehicleId }) });
        const json = await res.json();
        setShares(json.shares ?? []);
      } catch {
        setShares([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicleId]);

  async function createShare() {
    if (createRef.current || creating) return;
    createRef.current = true;
    setCreating(true);
    setCreateError("");
    try {
      const res = await authedFetch("/api/alici-raporu/share", { method: "POST", body: JSON.stringify({ op: "create", vehicle_id: vehicleId, duration }) });
      const json = await res.json();
      if (!res.ok) { createRef.current = false; setCreating(false); setCreateError(json.error || "Paylaşım oluşturulamadı."); return; }
      setCreated({ url: json.url, expires_at: json.share.expires_at });
      setQrDataUrl(await QRCode.toDataURL(`${window.location.origin}${json.url}`, { width: 220 }));
      setShares((prev) => [json.share, ...(prev ?? [])]);
      setCreating(false);
      createRef.current = false;
    } catch {
      createRef.current = false;
      setCreating(false);
      setCreateError("Bağlantı hatası. Tekrar deneyin.");
    }
  }

  async function revokeShare(shareId: string) {
    if (!confirm("Bu paylaşımı kapatmak istiyor musunuz? Alıcı artık bağlantıyı açamaz.")) return;
    try {
      await authedFetch("/api/alici-raporu/share", { method: "POST", body: JSON.stringify({ op: "revoke", vehicle_id: vehicleId, share_id: shareId }) });
      setShares((prev) => (prev ?? []).map((s) => (s.id === shareId ? { ...s, revoked_at: new Date().toISOString() } : s)));
    } catch {
      alert("Paylaşım kapatılamadı. Tekrar deneyin.");
    }
  }

  async function sendEmail() {
    setEmailStatus(null);
    if (emailSending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailStatus({ ok: false, msg: "Geçerli bir e-posta adresi girin." });
      return;
    }
    setEmailSending(true);
    try {
      if (!created) { setEmailStatus({ ok: false, msg: "Önce QR ile paylaşım oluşturun." }); setEmailSending(false); return; }
      const res = await authedFetch("/api/alici-raporu/email", { method: "POST", body: JSON.stringify({ vehicle_id: vehicleId, email: email.trim(), share_url: created.url }) });
      const json = await res.json();
      setEmailSending(false);
      setEmailStatus(res.ok ? { ok: true, msg: "E-posta gönderildi." } : { ok: false, msg: json.error || "E-posta gönderimi şu anda kullanılamıyor. QR veya PDF ile paylaşabilirsiniz." });
    } catch {
      setEmailSending(false);
      setEmailStatus({ ok: false, msg: "Bağlantı hatası. Tekrar deneyin." });
    }
  }

  async function generatePdf() {
    if (pdfState === "busy") return;
    setPdfState("busy");
    try {
      // Alıcı raporunu getir (public raporun oowner-yetkilendirilmiş sürümü):
      // createShare yanıtı varsa token ile çekiyoruz; yoksa aktif share'dan
      // veya public token ile rapor alınmalı. Basit yol: createShare yoksa
      // kullanıcıdan mevcut aktif URL token'ı istenir; burada createState'i
      // zorunlu kılıyoruz.
      if (!created) { setPdfState("error"); alert("Önce QR ile paylaşım oluşturun."); return; }
      const token = created.url.replace("/alici/", "");
      const res = await fetch(`/api/alici-raporu/rapor?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) { setPdfState("error"); return; }
      const { buildBuyerPdf } = require("@/lib/buyerPdf");
      const bytes = await buildBuyerPdf({ report: json, shareUrl: `${window.location.origin}${created.url}` });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `OTOIZ-AliciRaporu-${json.vehicle?.plate || "rapor"}.pdf`;
      a.click();
      setPdfState("done");
    } catch {
      setPdfState("error");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", ...cardStyle, padding: 16, textAlign: "left", cursor: "pointer" }}>
        <div style={{ width: 42, height: 42, borderRadius: radius.md, background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="share" color={colors.greenLight} size={20} />
        </div>
        <span>
          <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: colors.text }}>Alıcıya Göster</span>
          <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>OTOİZ Alıcı Raporu — QR, PDF ve e-posta</span>
        </span>
      </button>
    );
  }

  return (
    <section data-testid="aliciya-goster" style={{ ...cardStyle, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>Alıcıya Göster</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" style={{ background: "transparent", border: "none", color: colors.textMuted, fontSize: 20, cursor: "pointer", minWidth: 44, minHeight: 44 }}>×</button>
      </div>
      <p style={{ color: colors.textMuted, fontSize: 13.5, margin: "0 0 12px", lineHeight: 1.5 }}>Aracınızı satarken &quot;bakımlı&quot; demeyin. Geçmişini gösterin.</p>
      {step === "menu" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={() => setStep("share")} style={{ ...primaryButtonStyle(false) }}>QR ile Paylaş</button>
          <button type="button" onClick={() => setStep("pdf")} style={{ ...secondaryButtonStyle() }}>PDF Oluştur</button>
          <button type="button" onClick={() => setStep("email")} style={{ ...secondaryButtonStyle() }}>E-posta ile Gönder</button>
          <button type="button" onClick={() => setStep("share")} style={{ ...secondaryButtonStyle() }}>Aktif Paylaşımlarım</button>
        </div>
      )}
      {step === "share" && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>Otoiz Alıcı Raporu — paylaşım oluştur</h3>
          <div role="group" aria-label="Paylaşım süresi" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {([["24h", "24 Saat"], ["3d", "3 Gün"], ["7d", "7 Gün"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={duration === k} onClick={() => setDuration(k as ShareOption)} style={{ flex: 1, minHeight: 44, borderRadius: radius.md, border: `1px solid ${duration === k ? colors.green : colors.border}`, background: duration === k ? colors.greenSoft : colors.bgAlt, color: duration === k ? colors.greenLight : colors.text, fontSize: 13.5, fontWeight: 700 }}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={createShare} disabled={creating} style={{ ...primaryButtonStyle(creating), width: "100%" }}>{creating ? "Oluşturuluyor…" : "Paylaşım Oluştur"}</button>
          {createError && <p style={errorTextStyle as any}>{createError}</p>}
          {created && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              {qrDataUrl && <img src={qrDataUrl} alt="Otoiz Alıcı Raporu QR" style={{ width: 180, height: 180, borderRadius: radius.md }} />}
              <p style={{ color: colors.text, fontSize: 12.5, wordBreak: "break-all" }}>{window.location.origin}{created.url}</p>
              <p style={helperStyle as any}>Süre sonu: {new Date(created.expires_at).toLocaleString("tr-TR")}</p>
            </div>
          )}
          {shares && shares.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>Paylaşımlarım</h3>
              {shares.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "10px 12px", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: colors.text }}>{s.duration_hours === 24 ? "24 saat" : s.duration_hours === 72 ? "3 gün" : "7 gün"} · bitiş: {new Date(s.expires_at).toLocaleDateString("tr-TR")} {s.revoked_at ? "(kapalı)" : ""}</span>
                  {!s.revoked_at && new Date(s.expires_at) > new Date() && (
                    <button type="button" onClick={() => revokeShare(s.id)} style={{ background: "transparent", border: "none", color: colors.danger, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Paylaşımı Kapat</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setStep("menu")} style={{ ...secondaryButtonStyle(), marginTop: 12 }}>Geri</button>
        </div>
      )}
      {step === "email" && (
        <div>
          <label htmlFor="alici-email" style={labelStyle as any}>Alıcı e-postası</label>
          <input id="alici-email" type="email" placeholder="alici@ornek.com" style={inputStyle as any} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailStatus && !emailStatus.ok ? true : undefined} />
          <button type="button" onClick={sendEmail} disabled={emailSending} style={{ ...primaryButtonStyle(emailSending), marginTop: 10 }}>{emailSending ? "Gönderiliyor…" : "Gönder"}</button>
          {emailStatus && <p style={{ color: emailStatus.ok ? colors.greenLight : colors.danger, fontSize: 13.5, marginTop: 8 }}>{emailStatus.msg}</p>}
          <button type="button" onClick={() => setStep("menu")} style={{ ...secondaryButtonStyle(), marginTop: 12 }}>Geri</button>
        </div>
      )}
      {step === "pdf" && (
        <div>
          <p style={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.5 }}>Bu araç için allowlist edilmiş buyer-safe bilgilerle premium PDF üretir. QR, güncel paylaşım linkinize yönlenir.</p>
          <button type="button" onClick={generatePdf} disabled={pdfState === "busy"} style={{ ...primaryButtonStyle(pdfState === "busy"), marginTop: 10 }}>{pdfState === "busy" ? "Oluşturuluyor…" : "PDF Oluştur"}</button>
          {pdfState === "error" && <p style={errorTextStyle as any}>PDF oluşturulamadı. Önce paylaşım oluşturduğunuzdan emin olun.</p>}
          <button type="button" onClick={() => setStep("menu")} style={{ ...secondaryButtonStyle(), marginTop: 12 }}>Geri</button>
        </div>
      )}
    </section>
  );
}
