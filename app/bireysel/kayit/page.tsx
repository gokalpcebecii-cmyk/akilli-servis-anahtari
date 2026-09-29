"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { colors, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading, AuthFooterLink } from "@/components/AuthShell";
import { ResendConfirmation } from "@/components/ResendConfirmation";

function BireyselKayitForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bireysel/araclar";
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    // Faz 3.1: hesap e-posta doğrulanana kadar açılmaz; otomatik giriş yok.
    // P0: şifre burada alınmaz, doğrulama bağlantısından sonra belirlenir.
    const res = await fetch("/api/bireysel-kayit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, next: redirectTo }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Bir hata oluştu.");
      return;
    }
    setSentTo(form.email.trim().toLowerCase());
  }

  const girisHref = `/bireysel/giris${next ? `?next=${encodeURIComponent(redirectTo)}` : ""}`;

  if (sentTo) {
    return (
      <AuthShell role="bireysel" title="E-postanı kontrol et" testId="check-email">
        <p style={{ color: colors.textDark, lineHeight: 1.55, margin: "0 0 8px" }}>
          <strong>{sentTo}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya basınca şifreni belirleyip devam edeceksin.
        </p>
        <p style={{ color: colors.textMuted, fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
          E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bak. Bu adresle zaten hesabın varsa giriş yapabilir ya da şifreni sıfırlayabilirsin.
        </p>
        <ResendConfirmation email={sentTo} next={redirectTo} />
        <a href={girisHref} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 14 }}>
          Zaten hesabım var, giriş yap
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      role="bireysel"
      title="Bireysel Kayıt"
      subtitle="Kendi aracının dijital servis pasaportunu oluştur, bakım geçmişini kendin takip et."
      footer={
        <>
          <p>
            Zaten hesabınız var mı? <AuthFooterLink href={girisHref} strong>Giriş yapın</AuthFooterLink>
          </p>
          <AuthFooterLink href="/panel/kayit">İşletme / Servis misiniz?</AuthFooterLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="kayit-ad" style={labelStyle}>Ad Soyad</label>
        <input id="kayit-ad" autoComplete="name" style={{ ...inputStyle, marginBottom: 14 }} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Adınız Soyadınız" />

        <label htmlFor="kayit-email" style={labelStyle}>E-posta *</label>
        <input autoCorrect="off" spellCheck={false} id="kayit-email" autoComplete="email" inputMode="email" autoCapitalize="none" style={{ ...inputStyle, marginBottom: 14 }} required type="text" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Geçerli bir e-posta adresi girin" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

        <label htmlFor="kayit-tel" style={labelStyle}>Telefon</label>
        <input id="kayit-tel" type="tel" inputMode="tel" autoComplete="tel" style={{ ...inputStyle, marginBottom: 16 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555 000 00 00" />

        {error && <p role="alert" style={{ color: colors.danger, fontSize: 14, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
          {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function BireyselKayitPage() {
  return (
    <Suspense fallback={<AuthShellLoading />}>
      <BireyselKayitForm />
    </Suspense>
  );
}
