import { createServerSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getVehicleData(id: string) {
  const supabase = createServerSupabase();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*, tenants(name, logo_url, primary_color, phone, address)")
    .eq("id", id)
    .single();

  if (!vehicle) return null;

  const { data: records } = await supabase
    .from("maintenance_records")
    .select("*")
    .eq("vehicle_id", id)
    .order("service_date", { ascending: false });

  return { vehicle, records: records ?? [] };
}

export default async function VehiclePage({ params }: { params: { id: string } }) {
  const data = await getVehicleData(params.id);
  if (!data) return notFound();

  const { vehicle, records } = data;
  const tenant = vehicle.tenants;
  const accent = tenant?.primary_color || "#1E3A5F";

  const kmRemaining =
    vehicle.next_service_km != null
      ? vehicle.next_service_km - vehicle.current_km
      : null;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 48px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {tenant?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt={tenant.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
        )}
        <div>
          <div style={{ fontSize: 13, color: "#666" }}>Yetkili Servis</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{tenant?.name}</div>
        </div>
      </header>

      <section style={{ border: `1px solid ${accent}22`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{vehicle.plate}</h1>
        <p style={{ margin: 0, color: "#555" }}>
          {vehicle.brand} {vehicle.model} {vehicle.year ? `· ${vehicle.year}` : ""}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Güncel Kilometre</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{vehicle.current_km?.toLocaleString("tr-TR")} km</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Sonraki Bakım</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: accent }}>
              {vehicle.next_service_km ? `${vehicle.next_service_km.toLocaleString("tr-TR")} km` : "—"}
            </div>
            {vehicle.next_service_date && (
              <div style={{ fontSize: 12, color: "#888" }}>
                {new Date(vehicle.next_service_date).toLocaleDateString("tr-TR")}
              </div>
            )}
          </div>
        </div>

        {kmRemaining != null && kmRemaining <= 500 && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: `${accent}15`, borderRadius: 8, fontSize: 13, color: accent }}>
            {kmRemaining <= 0
              ? "Bakım zamanı geldi. Servisinizi arayarak randevu alabilirsiniz."
              : `Bakıma ${kmRemaining.toLocaleString("tr-TR")} km kaldı.`}
          </div>
        )}
      </section>

      {(tenant?.phone || tenant?.address) && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, color: "#888", fontWeight: 600, marginBottom: 8 }}>İletişim ve Randevu</h2>
          {tenant.phone && (
            <a href={`tel:${tenant.phone}`} style={{ display: "block", color: accent, textDecoration: "none", fontWeight: 600, marginBottom: 4 }}>
              📞 {tenant.phone}
            </a>
          )}
          {tenant.address && <p style={{ margin: 0, color: "#555", fontSize: 14 }}>{tenant.address}</p>}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 15, color: "#888", fontWeight: 600, marginBottom: 8 }}>Bakım Geçmişi</h2>
        {records.length === 0 && <p style={{ color: "#999", fontSize: 14 }}>Henüz kayıt bulunmuyor.</p>}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {records.map((r) => (
            <li key={r.id} style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#888" }}>
                {new Date(r.service_date).toLocaleDateString("tr-TR")} {r.km_at_service ? `· ${r.km_at_service.toLocaleString("tr-TR")} km` : ""}
              </div>
              <div style={{ fontSize: 15 }}>{r.description}</div>
              {r.cost != null && <div style={{ fontSize: 13, color: "#888" }}>{r.cost.toLocaleString("tr-TR")} ₺</div>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
          }
