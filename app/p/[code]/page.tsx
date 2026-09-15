import { createServerSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PassportByCodePage({ params }: { params: { code: string } }) {
  const supabase = createServerSupabase();

  const { data: qrKey } = await supabase
    .from("qr_keys")
    .select("*, vehicles(*, tenants(*), maintenance_records(*))")
    .eq("code", params.code)
    .maybeSingle();

  if (!qrKey) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Geçersiz Kod</h1>
        <p style={{ color: "#666" }}>Bu QR kod sistemde tanımlı değil.</p>
      </main>
    );
  }

  if (!qrKey.vehicle_id || !qrKey.vehicles) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Henüz Eşleştirilmemiş</h1>
        <p style={{ color: "#666" }}>Bu anahtarlık henüz bir araca bağlanmamış. Servis işletmeniz bu QR kodu araç kaydında eşleştirmelidir.</p>
      </main>
    );
  }

  const vehicle = qrKey.vehicles;
  const tenant = vehicle.tenants;
  const records = (vehicle.maintenance_records || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const navy = "#0B1F3A";
  const gold = "#D4A94A";

  function healthStatus(kmRemaining: number | null, daysRemaining: number | null) {
    if (kmRemaining === null && daysRemaining === null) return { label: "Bilgi Yok", color: "#999", bg: "#f5f5f5" };
    if ((kmRemaining !== null && kmRemaining <= 0) || (daysRemaining !== null && daysRemaining <= 0))
      return { label: "İşlem Zamanı", color: "#c0392b", bg: "#fdecea" };
    if ((kmRemaining !== null && kmRemaining <= 1000) || (daysRemaining !== null && daysRemaining <= 14))
      return { label: "Yaklaşıyor", color: "#b8860b", bg: "#fff8e6" };
    return { label: "Normal", color: "#2E6B4F", bg: "#eaf7ef" };
  }

  const today = new Date();
  function daysUntil(dateStr: string | null) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }
  function kmUntil(targetKm: number | null) {
    if (targetKm === null || targetKm === undefined) return null;
    return targetKm - (vehicle.current_km || 0);
  }

  const items = [
    { label: "Periyodik Bakım", km: kmUntil(vehicle.next_service_km), date: vehicle.next_service_date },
    { label: "Akü", km: null, date: vehicle.batarya_degisim_tarihi },
    { label: "Silecek", km: null, date: vehicle.silecek_degisim_tarihi },
    { label: "Lastik", km: kmUntil(vehicle.lastik_degisim_km), date: vehicle.lastik_degisim_tarihi },
    { label: "Fren Balata", km: kmUntil(vehicle.fren_balata_km), date: vehicle.fren_balata_tarihi },
    { label: "Muayene", km: null, date: vehicle.muayene_tarihi },
    { label: "Trafik Sigortası", km: null, date: vehicle.trafik_sigortasi_bitis },
    { label: "Kasko", km: null, date: vehicle.kasko_bitis },
  ];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", background: "#FAFAF7", minHeight: "100vh" }}>
      <div style={{ background: navy, color: "#fff", padding: "28px 20px" }}>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Yetkili Servis</p>
        <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{tenant?.name}</p>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{vehicle.plate}</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>{vehicle.brand} {vehicle.model}</div>
          <div style={{ fontSize: 13 }}>
            Güncel Km: <b>{vehicle.current_km?.toLocaleString("tr-TR")}</b>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px" }}>
        <h2 style={{ fontSize: 15, color: navy, marginBottom: 12 }}>Araç Sağlık Özeti</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {items.map((it) => {
            const d = daysUntil(it.date);
            const status = healthStatus(it.km, d);
            return (
              <div key={it.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "10px 14px" }}>
                <span style={{ fontSize: 13.5, color: "#333" }}>{it.label}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: status.color, background: status.bg, padding: "3px 10px", borderRadius: 999 }}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>

        <h2 style={{ fontSize: 15, color: navy, marginBottom: 12 }}>Bakım Geçmişi</h2>
        {records.length === 0 ? (
          <p style={{ color: "#999", fontSize: 13 }}>Henüz kayıt bulunmuyor.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {records.map((r: any) => (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#333" }}>{r.description}</div>
                <div style={{ fontSize: 11.5, color: "#999" }}>
                  {new Date(r.created_at).toLocaleDateString("tr-TR")} · {r.km?.toLocaleString("tr-TR")} km
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 15, color: navy, marginBottom: 12 }}>İletişim</h2>
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "14px" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: navy, margin: "0 0 4px" }}>{tenant?.phone}</p>
          <p style={{ fontSize: 12.5, color: "#666", margin: 0 }}>{tenant?.address}</p>
        </div>
      </div>
    </main>
  );
}
