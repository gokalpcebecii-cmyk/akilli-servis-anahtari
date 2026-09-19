"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { BottomNav } from "@/components/BottomNav";

// Bu ekran yeni bir bildirim altyapısı kurmuyor — mevcut gerçek verileri
// (bekleyen devirler + araç bazlı yaklaşan/gecikmiş bakım durumu) tek bir
// listede topluyor. Hiçbir sabit/örnek veri gösterilmez.
export default function BildirimlerPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<{ plate: string; vehicleId: string; label: string; status: "overdue" | "upcoming" }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }

      const { data: pending } = await supabase.rpc("list_my_pending_outgoing_transfers");
      setTransfers(pending ?? []);

      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id, plate, current_km")
        .eq("owner_user_id", session.session.user.id);

      const alerts: { plate: string; vehicleId: string; label: string; status: "overdue" | "upcoming" }[] = [];
      for (const v of vehicles ?? []) {
        const { data: items } = await supabase.from("maintenance_items").select("*").eq("vehicle_id", v.id);
        for (const item of items ?? []) {
          if (!item.interval_km || item.last_service_km == null) continue;
          const kmSince = (v.current_km || 0) - item.last_service_km;
          const kmRemaining = item.interval_km - kmSince;
          if (kmRemaining <= 0) alerts.push({ plate: v.plate, vehicleId: v.id, label: item.item_key, status: "overdue" });
          else if (kmRemaining <= 1000) alerts.push({ plate: v.plate, vehicleId: v.id, label: item.item_key, status: "upcoming" });
        }
      }
      setMaintenanceAlerts(alerts);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;
  }

  const isEmpty = transfers.length === 0 && maintenanceAlerts.length === 0;

  return (
    <main className="otoiz-has-bottom-nav" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: colors.textDark, margin: "0 0 18px" }}>Bildirimler</h1>

        {isEmpty && (
          <div style={{ background: colors.surfaceLight, borderRadius: radius.lg, padding: "40px 20px", textAlign: "center", border: `1px solid ${colors.border}` }}>
            <Icon name="bell" color={colors.textMuted} size={26} />
            <p style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Bildirim yok.</p>
          </div>
        )}

        {maintenanceAlerts.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
              Yaklaşan Bakımlar
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {maintenanceAlerts.map((a, i) => (
                <li
                  key={i}
                  onClick={() => router.push(`/bireysel/araclar/${a.vehicleId}#parca`)}
                  style={{ cursor: "pointer", background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 14, display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: a.status === "overdue" ? colors.dangerSoft : colors.warningSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="wrench" color={a.status === "overdue" ? colors.danger : colors.warning} size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textDark }}>{a.plate}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {a.status === "overdue" ? "Bakım zamanı geldi" : "Bakım yaklaşıyor"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {transfers.length > 0 && (
          <section>
            <h2 style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
              Bekleyen Devirler
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {transfers.map((t) => (
                <li
                  key={t.transfer_token}
                  onClick={() => router.push("/bireysel/araclar")}
                  style={{ cursor: "pointer", background: colors.surfaceLight, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 14 }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textDark }}>{t.plate}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>{t.brand} {t.model} — yeni sahibin kabul etmesi bekleniyor</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <BottomNav active="notifications" />
    </main>
  );
}
