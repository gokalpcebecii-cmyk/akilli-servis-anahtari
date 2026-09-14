"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function LoginPage() {
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
    router.push("/panel/dashboard");
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Servis Paneli</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>Akıllı Servis Anahtarı yönetim paneline giriş yapın.</p>

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
    </main>
  );
      }
