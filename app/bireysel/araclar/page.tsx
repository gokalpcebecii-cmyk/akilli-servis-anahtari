"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function BireyselAraclarPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }

      const { data: vehicleList } = await supabase
        .from("vehicles")
        .select("*")
        .eq("owner_user_id", session.session.user.id)
        .order("created_at", { ascending: false });

      setVehicles(vehicleList ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/bireysel/giris");
  }

  const filtered = vehicles.filter((v) =>
    v.plate?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A" }}>
            OTO<span style={{ color: "#D4A94A" }}>İZ</span>
          </div>
          <h1 style={{ fontSize: 20, margin: "4px 0 0" }}>Araçlarım</h1>
        </div>
        <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 13, padding: 0 }}>
          Çıkış yap
        </button>
      </div>

      <input
        placeholder="Plaka ile ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16, fontSize: 15 }}
      />

      
        href="/bireysel/araclar/yeni"
        style={{ display: "block", textAlign: "center", padding: "12px 20px", background: "#1E3A5F", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600, marginBottom: 24 }}
      >
        + Yeni Araç Ekle
      </a>

      {filtered.length === 0 && (
        <p style={{ color: "#999", marginTop: 20, textAlign: "center" }}>
          {vehicles.length === 0 ? "Henüz araç eklemediniz." : "Araç bulunamadı."}
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {filtered.map((v) => (
          <li key={v.id} style={{ borderBottom: "1px solid #eee", padding: "14px 0" }}>
            <a href={`/bireysel/araclar/${v.id}`} style={{ textDecoration: "none", color: "#111" }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{v.plate}</div>
              <div style={{ color: "#666", fontSize: 13 }}>
                {v.brand} {v.model} · {v.current_km?.toLocaleString("tr-TR")} km
              </div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
