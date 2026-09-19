"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function DevirKabulPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      setLoggedIn(!!session.session);

      const { data, error: rpcError } = await supabase.rpc("preview_ownership_transfer", { p_token: token });
      if (!rpcError && data) setPreview(data);
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("accept_ownership_transfer", { p_token: token });
    setAccepting(false);

    if (rpcError || !data?.ok) {
      const msg = rpcError?.message || "";
      if (msg.includes("expired")) setError("Bu devir bağlantısının süresi dolmuş.");
      else if (msg.includes("already_accepted")) setError("Bu araç zaten devralınmış.");
      else if (msg.includes("cancelled")) setError("Bu devir iptal edilmiş.");
      else if (msg.includes("cannot_accept_own_transfer")) setError("Kendi başlattığınız bir devri kabul edemezsiniz.");
      else setError("Devir tamamlanamadı. Bağlantı geçersiz olabilir.");
      return;
    }
    setDone(data.vehicle_id);
  }

  const inputStyle = { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, fontSize: 15 };

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  if (done) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: "#2E6B4F" }}>✓ Devir Tamamlandı</h1>
        <p style={{ color: "#666", marginBottom: 24 }}>Araç artık hesabınıza bağlı. Bakım geçmişi aynen korundu.</p>
        <button
          onClick={() => router.push(`/bireysel/araclar/${done}`)}
          style={{ padding: "12px 24px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
        >
          Aracımı Görüntüle
        </button>
      </main>
    );
  }

  if (!preview) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Geçersiz veya Süresi Dolmuş Bağlantı</h1>
        <p style={{ color: "#666" }}>Bu devir bağlantısı artık geçerli değil.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 20, textAlign: "center" }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
      <h1 style={{ fontSize: 20, marginBottom: 8, textAlign: "center" }}>Araç Devrini Kabul Et</h1>

      <div style={{ background: "#F4F1EA", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1E3A5F" }}>{preview.plate}</div>
        <div style={{ fontSize: 13, color: "#666" }}>{preview.brand} {preview.model}</div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>Güncel km: {preview.current_km?.toLocaleString("tr-TR")}</div>
      </div>

      {!loggedIn ? (
        <>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16, textAlign: "center" }}>
            Bu aracı devralmak için önce OTOİZ hesabınızla giriş yapmalı veya hesap oluşturmalısınız.
            Giriş yaptıktan sonra bu sayfaya geri dönün.
          </p>
          <button
            onClick={() => router.push(`/bireysel/giris?next=/bireysel/devir-kabul/${token}`)}
            style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}
          >
            Giriş Yap
          </button>
          <button
            onClick={() => router.push(`/bireysel/kayit?next=/bireysel/devir-kabul/${token}`)}
            style={{ width: "100%", padding: 12, background: "#eee", color: "#333", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            Hesap Oluştur
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16, textAlign: "center" }}>
            Bu aracı kabul ettiğinizde, teknik bakım geçmişi korunarak hesabınıza bağlanır.
          </p>
          {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</p>}
          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{ width: "100%", padding: 14, background: "#2E6B4F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: accepting ? "wait" : "pointer" }}
          >
            {accepting ? "İşleniyor…" : "Devri Kabul Et"}
          </button>
        </>
      )}
    </main>
  );
}
