"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff_users")
        .select("tenant_id")
        .eq("id", session.session.user.id)
        .single();

      if (staffError || !staff?.tenant_id) {
        setLoading(false);
        return;
      }

      const { data: vehicleList } = await supabase
        .from("vehicles")
        .select("*")
        .eq("tenant_id", staff.tenant_id)
        .order("created_at", { ascending: false });

      setVehicles(vehicleList ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/panel/login");
  }

  const filtered = vehicles.filter((v) =>
    v.plate?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Araçlarım</h1>
        <div style={{ fontSize: 13 }}>
          <a href="/panel/ayarlar" style={{ color: "#666", marginRight: 12, textDecoration: "none" }}>Ayarlar</a>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 13, padding: 0 }}>Çıkış yap</button>
        </div>
      </div>

      <input
        placeholder="Plaka ile ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16, fontSize: 15 }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <a href="/panel/araclar/yeni" style={{ display: "inline-block", padding: "12px 20px", background: "#1E3A5F", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          + Yeni Araç Ekle
        </a>
        <a href="/panel/eslestir" style={{ display: "inline-block", padding: "12px 20px", background: "#fff", color: "#1E3A5F", border: "2px solid #1E3A5F", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          Anahtarlık Eşleştir
        </a>
        <a href="/panel/qr-uretim" style={{ display: "inline-block", padding: "12px 20px", background: "#fff", color: "#666", border: "1px solid #ccc", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          QR Üret
        </a>
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "#999", marginTop: 20 }}>Araç bulunamadı.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {filtered.map((v) => (
          <li key={v.id} style={{ borderBottom: "1px solid #eee", padding: "14px 0" }}>
            <a href={`/panel/araclar/${v.id}`} style={{ textDecoration: "none", color: "#111" }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{v.plate}</div>
              <div style={{ color: "#666", fontSize: 13 }}>
                {v.brand} {v.model} · {v.current_km?.toLocaleString("tr-TR")} km · Sonraki bakım: {v.next_service_km?.toLocaleString("tr-TR")} km
              </div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
