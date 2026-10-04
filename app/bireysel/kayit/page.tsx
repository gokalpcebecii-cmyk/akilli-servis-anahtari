"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { colors, inputStyle, labelStyle, primaryButtonStyle, alertBoxStyle } from "@/lib/theme";
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
  const [kvkkAcknowledged, setKvkkAcknowledged] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!kvkkAcknowledged) {
      setError("KVKK Aydınlatma Metni'ni okuyup bilgi edindiğinizi işaretleyin.");
      return;
    }
    if (!termsAccepted) {
      setError("Kullanım Koşulları'nı kabul etmeden hesap oluşturamazsınız.");
      return;
    }
    setLoading(true);

    // Faz 3.1: hesap e-posta doğrulanana kadar açılmaz; otomatik giriş yok.
    // P0: şifre burada alınmaz, doğrulama bağlantısından sonra belirlenir.
    const res = await fetch("/api/bireysel-kayit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        next: redirectTo,
        kvkk_acknowledged: kvkkAcknowledged,
        terms_accepted: termsAccepted,
        kvkk_version: "2026-10-04",
        terms_version: "2026-10-04",
      }),
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

        <details style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.55, color: colors.textMuted }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, color: colors.textDark }}>KVKK Aydınlatma Metni</summary>
          <div style={{ marginTop: 8 }}>
            <p>OTOİZ hizmetinde hesap, iletişim, araç, bakım, servis ve yüklediğiniz belge bilgileri; hesabın işletilmesi, dijital servis pasaportunun sunulması, güvenlik, destek ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenebilir.</p>
            <p>Veriler yalnız hizmetin sunulması için gerekli altyapı/tedarikçi kategorileri ve kanunen yetkili mercilerle, ilgili hukuki sebepler kapsamında paylaşılabilir. Veriler amaç için gerekli süre ve yasal saklama yükümlülükleri boyunca tutulur.</p>
            <p>KVKK kapsamındaki erişim, düzeltme, silme/yok etme ve diğer başvuru haklarınızı kullanabilirsiniz. Veri sorumlusunun tam ticari unvanı, adresi, vergi bilgileri ve resmi başvuru kanalı yayına alınmadan önce hukuki metinde tamamlanacaktır.</p>
          </div>
        </details>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>
          <input type="checkbox" checked={kvkkAcknowledged} onChange={(e) => setKvkkAcknowledged(e.target.checked)} style={{ marginTop: 3 }} />
          KVKK Aydınlatma Metni'ni okudum ve bilgi edindim.
        </label>

        <details style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.55, color: colors.textMuted }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, color: colors.textDark }}>Kullanım Koşulları</summary>
          <div style={{ marginTop: 8 }}>
            <p>Sisteme eklediğim bilgi ve belgelerin doğruluğundan ve bunları yüklemeye yetkili olduğumdan sorumlu olduğumu kabul ederim.</p>
            <p>OTOİZ, kullanıcılar ve yetkili işletmeler tarafından sisteme girilen araç, kilometre, bakım, servis, belge ve diğer bilgilerin doğruluğunu, eksiksizliğini veya güncelliğini garanti etmez. Bu bilgilerin doğruluğundan ve sisteme yüklenmesine ilişkin yetkiden bilgiyi sisteme giren kullanıcı veya işletme sorumludur. OTOİZ, araç hakkında mekanik ekspertiz, ayıpsızlık, kilometre doğruluğu veya servis garantisi sağlamaz.</p>
            <p>Üçüncü kişilere ait kişisel veri veya belgeler yalnız bunları yüklemeye hukuken yetkiliyseniz sisteme eklenmelidir.</p>
          </div>
        </details>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>
          <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: 3 }} />
          Kullanım Koşulları'nı okudum ve kabul ediyorum.
        </label>

        {error && <p role="alert" style={alertBoxStyle}>{error}</p>}

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
