"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

function BireyselKayitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bireysel/araclar";
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 14, fontSize: 15 };
  const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <main style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 16 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Bireysel Kayıt</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        Kendi aracının dijital servis pasaportunu oluştur, bakım geçmişini kendin takip et.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Ad Soyad</label>
        <input style={inputStyle} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Adınız Soyadınız" />

        <label style={labelStyle}>E-posta *</label>
        <input style={inputStyle} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

        <label style={labelStyle}>Şifre *</label>
        <input style={inputStyle} required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="En az 6 karakter" />

        <label style={labelStyle}>Telefon</label>
        <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555 000 00 00" />

        {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
        Zaten hesabınız var mı? <a href="/bireysel/giris" style={{ color: "#1E3A5F" }}>Giriş yapın</a>
      </p>
      <p style={{ textAlign: "center", marginTop: 8, fontSize: 13 }}>
        <a href="/panel/kayit" style={{ color: "#888" }}>İşletme / Servis misiniz?</a>
      </p>
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
