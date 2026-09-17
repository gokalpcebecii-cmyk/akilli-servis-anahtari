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
      <div style={{ fontSize: 18,
