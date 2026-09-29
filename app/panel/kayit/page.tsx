"use client";

// OTOİZ P0: kayıt talebi → e-posta doğrulama → şifre belirleme + başvuru →
// OTOİZ onayı. Bu formda şifre alınmaz; şifre, e-postadaki bağlantıyla
// gelinen /panel/kayit/tamamla sayfasında belirlenir (bkz. app/api/signup).
import { useState } from "react";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthFooterLink } from "@/components/AuthShell";
import { Icon } from "@/components/Icon";
import { ResendConfirmation } from "@/components/ResendConfirmation";

export default function SignupPage() {
  const [form, setForm] = useState({ business_name: "", email: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    let res: Response;
    let data: any = null;
    try {
      res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      data = await res.json().catch(() => null);
    } catch {
      setLoading(false);
      setError("Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      return;
    }

    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "Bir hata oluştu");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <AuthShell role="servis" title="E-postanızı kontrol edin">
        <div data-testid="service-signup-sent">
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Icon name="check" color={colors.greenDark} size={24} />
          </div>
          <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 16px" }}>
            <strong>{form.email}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayın, şifrenizi
            belirleyin ve başvurunuzu tamamlayın. Başvurunuz OTOİZ onayından sonra aktifleşir.
          </p>
          <p style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
            E-posta gelmediyse gereksiz klasörünü kontrol edin veya yeniden gönderin.
          </p>
          <ResendConfirmation email={form.email} next="/panel/kayit/tamamla" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      role="servis"
      title="İşletme Kaydı"
      subtitle="OTOİZ'e ücretsiz katılın, dijital araç servis pasaportuna hemen başlayın."
      footer={
        <>
          <p>
            Zaten hesabınız var mı? <AuthFooterLink href="/panel/login" strong>Giriş yapın</AuthFooterLink>
          </p>
          <AuthFooterLink href="/bireysel/kayit">Bireysel araç sahibi misiniz?</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="isletme-ad" style={labelStyle}>İşletme Adı *</label>
        <input id="isletme-ad" autoComplete="organization" style={{ ...inputStyle, marginBottom: 14 }} required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Örn: Yılmaz Oto Servis" />

        <label htmlFor="isletme-email" style={labelStyle}>E-posta *</label>
        <input autoCorrect="off" spellCheck={false} id="isletme-email" autoComplete="email" inputMode="email" autoCapitalize="none" style={{ ...inputStyle, marginBottom: 14 }} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

        <label htmlFor="isletme-tel" style={labelStyle}>Telefon</label>
        <input id="isletme-tel" type="tel" inputMode="tel" autoComplete="tel" style={{ ...inputStyle, marginBottom: 14 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0312 000 00 00" />

        <label htmlFor="isletme-adres" style={labelStyle}>Adres</label>
        <input id="isletme-adres" autoComplete="street-address" style={{ ...inputStyle, marginBottom: 16 }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Şehir, ilçe" />

        <p style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>
          E-postanıza gelen bağlantıyla şifrenizi belirleyeceksiniz. İşletmeniz OTOİZ onayından sonra aktifleşir.
        </p>

        {error && <p role="alert" style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
      </form>
    </AuthShell>
  );
}
