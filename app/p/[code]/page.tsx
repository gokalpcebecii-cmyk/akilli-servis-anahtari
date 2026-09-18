import { createServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const ITEM_DISPLAY: Record<string, { label: string; icon: string }> = {
  motor_yagi: { label: "Motor Yağı", icon: "🛢️" },
  yag_filtresi: { label: "Yağ Filtresi", icon: "🧰" },
  hava_filtresi: { label: "Hava Filtresi", icon: "💨" },
  polen_filtresi: { label: "Polen Filtresi", icon: "🌼" },
  fren_disk_balata: { label: "Fren Disk-Balata", icon: "🛑" },
  triger_seti: { label: "Triger Seti", icon: "⚙️" },
  aku: { label: "Akü", icon: "🔋" },
  lastik: { label: "Lastik", icon: "🛞" },
};

const ITEM_ORDER = [
  "motor_yagi",
  "yag_filtresi",
  "hava_filtresi",
  "polen_filtresi",
  "fren_disk_balata",
  "triger_seti",
  "aku",
  "lastik",
];

export default async function PassportByCodePage({ params }: { params: { code: string } }) {
  const supabase = createServerSupabase();

  // Tüm qr_keys/vehicles/tenants tablolarını doğrudan okumak yerine, yalnızca
  // verilen kod geçerliyse (ve iptal edilmemişse) minimum pasaport verisini
  // döndüren güvenli bir DB fonksiyonu çağrılıyor. Bu sayede bu sayfa,
  // araçların/kodların toplu listelenmesine hiçbir şekilde aracılık etmiyor.
  const { data: passport } = await supabase.rpc("get_public_vehicle_passport", {
    p_code: params.code,
  });

  if (!passport) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Geçersiz Kod</h1>
        <p style={{ color: "#666" }}>Bu QR kod sistemde tanımlı değil.</p>
      </main>
    );
  }

  if (passport.status === "unassigned") {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Henüz Eşleştirilmemiş</h1>
        <p style={{ color: "#666" }}>Bu anahtarlık henüz bir araca bağlanmamış.</p>
      </main>
    );
  }

  const vehicle = passport.vehicle;
  const tenant = passport.tenant;
  const records: any[] = passport.maintenance_records ?? [];
  const maintenanceItems: any[] = passport.maintenance_items ?? [];

  const navy = "#0B1F3A";

  function getItemStatus(itemKey: string) {
    const item = maintenanceItems.find((m: any) => m.item_key === itemKey);
    if (!item || !item.last_service_date) {
      return { label: "Bilgi Yok", color: "#999", bg: "#f5f5f5" };
    }

    let overdue = false;
    let upcoming = false;
    let hasInterval = false;

    if (item.interval_km && item.last_service_km != null) {
      hasInterval = true;
      const kmSince = (vehicle.current_km || 0) - item.last_service_km;
      const kmRemaining = item.interval_km - kmSince;
      if (kmRemaining <= 0) overdue = true;
      else if (kmRemaining <= 1000) upcoming = true;
    }

    if (item.interval_months) {
      hasInterval = true;
      const dueDate = new Date(item.last_service_date);
      dueDate.setMonth(dueDate.getMonth() + item.interval_months);
      const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 0) overdue = true;
      else if (daysRemaining <= 30) upcoming = true;
    }

    if (!hasInterval) {
      return { label: "Yapıldı", color: "#2E6B4F", bg: "#eaf7ef" };
    }
    if (overdue) return { label: "İşlem Zamanı", color: "#c0392b", bg: "#fdecea" };
    if (upcoming) return { label: "Yaklaşıyor", color: "#b8860b", bg: "#fff8e6" };
    return { label: "Normal", color: "#2E6B4F", bg: "#eaf7ef" };
  }

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
          {ITEM_ORDER.map((key) => {
            const display = ITEM_DISPLAY[key];
            const status = getItemStatus(key);
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "10px 14px" }}>
                <span style={{ fontSize: 13.5, color: "#333" }}>
                  <span style={{ marginRight: 8 }}>{display.icon}</span>
                  {display.label}
                </span>
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
                  {new Date(r.created_at).toLocaleDateString("tr-TR")}
                  {r.km_at_service != null ? ` · ${r.km_at_service.toLocaleString("tr-TR")} km` : ""}
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
