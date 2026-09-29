"use client";

// OTOİZ Faz 3.1 — doğrulama e-postasını yeniden gönder düğmesi.
import { useState } from "react";
import { colors, font, inputStyle, radius } from "@/lib/theme";

export function ResendConfirmation({ email: initialEmail, next }: { email?: string; next?: string | null }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function resend() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bireysel-kayit/yeniden-gonder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: next ?? undefined }),
      });
      const j = await res.json().catch(() => null);
      setMsg({ ok: res.ok, text: j?.message || j?.error || (res.ok ? "Gönderildi." : "Gönderilemedi.") });
    } catch {
      setMsg({ ok: false, text: "Bağlantı hatası. Tekrar deneyin." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="resend-confirmation">
      {!initialEmail && (
        <input autoCorrect="off" spellCheck={false} autoCapitalize="none" type="email" aria-label="E-posta" placeholder="ornek@mail.com" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }} />
      )}
      <button type="button" onClick={resend} disabled={busy || !email.includes("@")}
        style={{ width: "100%", minHeight: 44, borderRadius: radius.sm, border: `1.5px solid ${colors.border}`, background: colors.surfaceLight,
          color: colors.textDark, fontWeight: 700, fontSize: 14, fontFamily: font, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Gönderiliyor…" : "Doğrulama e-postasını yeniden gönder"}
      </button>
      {msg && <p role="status" style={{ fontSize: 13, color: msg.ok ? colors.greenDark : colors.danger, margin: "8px 0 0", lineHeight: 1.5 }}>{msg.text}</p>}
    </div>
  );
}
