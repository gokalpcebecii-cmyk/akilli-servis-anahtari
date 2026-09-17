"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function BireyselGirisPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("E-posta veya şifre hatalı.");
      return;
    }
    router.push("/bireysel/araclar");
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 16 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Bireysel Giriş</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>Araçlarınızın dijital pasaportuna giriş yapın.</p>

      <form onSubmit={handleLogin}>
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>E-posta</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 14, borderRadius: 8, border: "1px solid #ccc" }}
        />

        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 14, borderRadius: 8, border: "1px solid #ccc" }}
        />

        {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#1E3A5F", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
        Hesabınız yok mu? <a href="/bireysel/kayit" style={{ color: "#1E3A5F" }}>Kayıt olun</a>
      </p>
    </main>
  );
}
