"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function BireyselDevretPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ token: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      const { data: v } = await supabase.from("vehicles").select("id, plate, brand, model, owner_user_id").eq("id", params.id).single();
      if (!v || v.owner_user_id !== session.session.user.id) {
        router.push("/bireysel/araclar");
        return;
      }
      setVehicle(v);
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function handleStart() {
    setStarting(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("initiate_ownership_transfer", { p_vehicle_id: params.id });
    setStarting(false);

    if (rpcError || !data) {
      setError("Devir başlatılamadı. Lütfen tekrar deneyin.");
      return;
    }
    setResult({ token: data.token, expires_at: data.expires_at });
  }

  const shareUrl = result ? `${window.location.origin}/bireysel/devir-kabul/${result.token}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sessizce yoksay
    }
  }

  if (loading || !vehicle) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  if (result) {
    return (
      <main style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Devir Başlatıldı</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
          <strong>{vehicle.plate}</strong> artık hesabınızda görünmüyor ve bu bağlantıyı kabul eden kişiye geçecek.
          Aşağıdaki bağlantıyı yalnızca aracı devrettiğiniz kişiyle paylaşın.
        </p>

        <div style={{ background: "#f5f5f5", borderRadius: 10, padding: 14, marginBottom: 12, wordBreak: "break-all", fontSize: 13, fontFamily: "monospace" }}>
          {shareUrl}
        </div>

        <button
          onClick={handleCopy}
          style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}
        >
          {copied ? "Kopyalandı ✓" : "Bağlantıyı Kopyala"}
        </button>

        <p style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>
          Bağlantı 7 gün geçerlidir. Yeni sahip OTOİZ hesabıyla giriş yapıp bu bağlantıyı açtığında devir tamamlanır.
          Karşı taraf henüz kabul etmediyse araç listenizden "Bekleyen Devirler" bölümünden iptal edebilirsiniz.
        </p>

        <button
          onClick={() => router.push("/bireysel/araclar")}
          style={{ width: "100%", padding: 12, background: "#eee", color: "#333", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
        >
          Araçlarıma Dön
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Aracı Devret / Elden Çıkar</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
        <strong>{vehicle.plate}</strong> — {vehicle.brand} {vehicle.model}
      </p>

      <div style={{ background: "#FFF8E6", border: "1px solid #E8C468", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#7a5c10" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Bu işlem ne yapar?</p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Aracın erişimi hemen hesabınızdan kaldırılır.</li>
          <li>Bakım geçmişi ve QR/NFC kodu aynı araçla kalır, silinmez.</li>
          <li>Aracınız, yeni sahip paylaştığınız bağlantıyı OTOİZ hesabıyla açıp kabul edene kadar "beklemede" kalır.</li>
          <li>Kimse otomatik/rastgele bu aracın yeni sahibi yapılmaz.</li>
          <li>Kabul edilmeden önce istediğiniz zaman iptal edip aracı geri alabilirsiniz.</li>
        </ul>
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#555", marginBottom: 20 }}>
        <input type="checkbox" checked={confirming} onChange={(e) => setConfirming(e.target.checked)} style={{ marginTop: 3 }} />
        Bu aracın erişimini hesabımdan kaldırmak istediğimi onaylıyorum.
      </label>

      {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button
        onClick={handleStart}
        disabled={!confirming || starting}
        style={{
          width: "100%", padding: 14, background: confirming ? "#c0392b" : "#ccc", color: "#fff", border: "none",
          borderRadius: 8, fontWeight: 700, cursor: confirming && !starting ? "pointer" : "not-allowed", fontSize: 15,
        }}
      >
        {starting ? "Başlatılıyor…" : "Devri Başlat"}
      </button>
    </main>
  );
}
