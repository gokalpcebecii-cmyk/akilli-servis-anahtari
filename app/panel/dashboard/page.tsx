"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

type Vehicle = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  current_km: number;
  next_service_km: number | null;
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createBrowserSupabase();

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }
      const { data } = await supabase
        .from("vehicles")
        .select("id, plate, brand, model, current_km, next_service_km")
        .order("created_at", { ascending: false });
      setVehicles(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = vehicles.filter((v) =>
    v.plate.toLowerCase().replace(/\s/g, "").includes(search.toLowerCase().replace(/\s/g, ""))
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/panel/login");
  }

  if (loading) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Araçlarım</h1>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/panel/ayarlar" style={{ color: "#888", fontSize: 13, textDecoration: "none" }}>
            Ayarlar
          </Link>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer" }}>
            Çıkış yap
          </button>
        </div>
      </header>

      <input
        placeholder="Plaka ile ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16 }}
      />

      <Link
        href="/panel/araclar/yeni"
        style={{ display: "inline-block", marginBottom: 20, padding: "10px 16px", background: "#1E3A5F", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}
      >
        + Yeni Araç Ekle
      </Link>

      {filtered.length === 0 && <p style={{ color: "#999" }}>Araç bulunamadı.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map((v) => (
          <li key={v.id} style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
            <Link href={`/panel/araclar/${v.id}`} style={{ textDecoration: "none", color: "#111" }}>
              <div style={{ fontWeight: 700 }}>{v.plate}</div>
              <div style={{ fontSize: 13, color: "#666" }}>
                {v.brand} {v.model} · {v.current_km?.toLocaleString("tr-TR")} km
                {v.next_service_km ? ` · Sonraki bakım: ${v.next_service_km.toLocaleString("tr-TR")} km` : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
    }
