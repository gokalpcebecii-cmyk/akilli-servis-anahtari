"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ business_name: "", email: "", password: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Bir hata oluştu");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/panel/login"), 2000);
  }

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 14, fontSize: 15 };
  const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };

  if (success) {
    return (
      <main style={{ maxWidth: 420, margin: "60px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", textAlign: "center" as const }}>
        <h1 style={{ fontSize: 20 }}>Hesabınız oluşturuldu</h1>
        <p style={{ color: "#666" }}>Giriş sayfasına yönlendiriliyorsunuz...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 16 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>İşletme Kaydı</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
        OTOİZ'e ücretsiz katılın, dijital araç servis pasaportuna hemen başlayın.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>İşletme Adı *</label>
        <input style={inputStyle} required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Örn: Yılmaz Oto Servis" />

        <label style={labelStyle}>E-posta *</label>
        <input style={inputStyle} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />

        <label style={labelStyle}>Şifre *</label>
        <input style={inputStyle} required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="En az 6 karakter" />

        <label style={labelStyle}>Telefon</label>
        <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0312 000 00 00" />

        <label style={labelStyle}>Adres</label>
        <input style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Şehir, ilçe" />

        {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
        Zaten hesabınız var mı? <a href="/panel/login" style={{ color: "#1E3A5F" }}>Giriş yapın</a>
      </p>
    </main>
  );
}
