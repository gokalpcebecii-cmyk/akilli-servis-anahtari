"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";

function BireyselKayitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bireysel/araclar";
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/bireysel-kayit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Bir hata oluştu.");
      return;
    }

    const supabase = createBrowserSupabase();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setLoading(false);

    if (loginError) {
      router.push("/bireysel/giris");
      return;
    }

    router.push(redirectTo);
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "24px 20px 40px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
          ← Ana sayfaya dön
        </a>
        <div style={{ maxWidth: 380, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={190} mark="primary" />
          <h1 style={{ fontSize: 23, marginTop: 14, marginBottom: 6, color: colors.textLight, fontWeight: 800 }}>Bireysel Kayıt</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            Kendi aracının dijital servis pasaportunu oluştur, bakım geçmişini kendin takip et.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 380, margin: "-24px auto 0", padding: "0 20px 40px" }}>
        <form onSubmit={handleSubmit} style={{ background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
          <label style={labelStyle}>Ad Soyad</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Adınız Soyadınız" />

          <label style={labelStyle}>E-posta *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

          <label style={labelStyle}>Şifre *</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="En az 6 karakter" />

          <label style={labelStyle}>Telefon</label>
          <input style={{ ...inputStyle, marginBottom: 14 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555 000 00 00" />

          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
            {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: colors.textDark }}>
          Zaten hesabınız var mı? <a href="/bireysel/giris" style={{ color: colors.greenDark, fontWeight: 600 }}>Giriş yapın</a>
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
