"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { ResendConfirmation } from "@/components/ResendConfirmation";

function BireyselKayitForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bireysel/araclar";
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    // Faz 3.1: hesap e-posta doğrulanana kadar açılmaz; otomatik giriş yok.
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

  if (sentTo) {
    return (
      <main className="otoiz-auth-shell" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, padding: "40px 20px" }}>
        <div data-testid="check-email" style={{ maxWidth: 380, margin: "0 auto", background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
          <OtoizLogo variant="light" size={140} />
          <h1 style={{ fontSize: 21, margin: "16px 0 8px", color: colors.textDark, fontWeight: 800 }}>E-postanı kontrol et</h1>
          <p style={{ color: colors.textDark, lineHeight: 1.55, margin: "0 0 8px" }}>
            <strong>{sentTo}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya bastıktan sonra giriş yapabilirsin.
          </p>
          <p style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 18px" }}>
            E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bak.
          </p>
          <ResendConfirmation email={sentTo} next={redirectTo} />
          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13 }}>
            <a href={`/bireysel/giris${next ? `?next=${encodeURIComponent(redirectTo)}` : ""}`} style={{ color: colors.greenDark, fontWeight: 600 }}>Doğruladım, giriş yap</a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="otoiz-auth-shell" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div className="otoiz-auth-hero" style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "24px 20px 40px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
          ← Ana sayfaya dön
        </a>
        <div className="otoiz-auth-hero-inner" style={{ maxWidth: 380, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={190} mark="primary" />
          <h1 style={{ fontSize: 23, marginTop: 14, marginBottom: 6, color: colors.textLight, fontWeight: 800 }}>Bireysel Kayıt</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            Kendi aracının dijital servis pasaportunu oluştur, bakım geçmişini kendin takip et.
          </p>
        </div>
      </div>

      <div className="otoiz-auth-form-wrap" style={{ maxWidth: 380, margin: "-24px auto 0", padding: "0 20px 40px" }}>
        <form onSubmit={handleSubmit} style={{ background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
          <label style={labelStyle}>Ad Soyad</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Adınız Soyadınız" />

          <label style={labelStyle}>E-posta *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

          <label style={labelStyle}>Şifre *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="En az 8 karakter" />

          <label style={labelStyle}>Telefon</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555 000 00 00" />

          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
            {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: colors.textDark }}>
          Zaten hesabınız var mı? <a href={`/bireysel/giris${next ? `?next=${encodeURIComponent(redirectTo)}` : ""}`} style={{ color: colors.greenDark, fontWeight: 600 }}>Giriş yapın</a>
        </p>
        <p style={{ textAlign: "center", marginTop: 8, fontSize: 13 }}>
          <a href="/panel/kayit" style={{ color: colors.textMuted }}>İşletme / Servis misiniz?</a>
        </p>
      </div>
    </main>
  );
}

export default function BireyselKayitPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Yükleniyor…</main>}>
      <BireyselKayitForm />
    </Suspense>
  );
}
