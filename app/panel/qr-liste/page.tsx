"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import QRCode from "qrcode";

export default function QrListePage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [items, setItems] = useState<any[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unassigned" | "assigned">("all");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }

      const { data } = await supabase
        .from("qr_keys")
        .select("*, vehicles(plate, brand, model)")
        .order("created_at", { ascending: false });

      setItems(data ?? []);

      const imgs: Record<string, string> = {};
      for (const item of data ?? []) {
        imgs[item.code] = await QRCode.toDataURL(`${baseUrl}/p/${item.code}`, { width: 300, margin: 1 });
      }
      setImages(imgs);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter((i) => {
    if (filter === "unassigned") return !i.vehicle_id;
    if (filter === "assigned") return !!i.vehicle_id;
    return true;
  });

  function downloadOne(code: string) {
    const link = document.createElement("a");
    link.href = images[code];
    link.download = `qr-${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Tüm QR Kodlarım</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>{items.length} adet QR kodu üretilmiş.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all", "unassigned", "assigned"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, cursor: "pointer",
              background: filter === f ? "#1E3A5F" : "#fff", color: filter === f ? "#fff" : "#333",
            }}
          >
            {f === "all" ? "Tümü" : f === "unassigned" ? "Boş" : "Eşleşmiş"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {filtered.map((item) => (
          <div key={item.code} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, textAlign: "center" }}>
            {images[item.code] && <img src={images[item.code]} alt={item.code} style={{ width: "100%", borderRadius: 6, marginBottom: 6 }} />}
            <p style={{ fontSize: 10, color: "#888", wordBreak: "break-all", marginBottom: 4 }}>{item.code}</p>
            {item.vehicles ? (
              <p style={{ fontSize: 11, color: "#2E6B4F", fontWeight: 600, marginBottom: 6 }}>{item.vehicles.plate}</p>
            ) : (
              <p style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>Boş</p>
            )}
            <button onClick={() => downloadOne(item.code)} style={{ fontSize: 11, padding: "5px 10px", background: "#eee", border: "none", borderRadius: 6, cursor: "pointer" }}>
              İndir
            </button>
          </div>
        ))}
      </div>
    </main>
  );
            }
