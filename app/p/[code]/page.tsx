"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";

const MAINTENANCE_ITEMS = [
  { key: "motor_yagi", label: "Motor Yağı" },
  { key: "yag_filtresi", label: "Yağ Filtresi" },
  { key: "hava_filtresi", label: "Hava Filtresi" },
  { key: "polen_filtresi", label: "Polen Filtresi" },
  { key: "fren_disk_balata", label: "Fren Disk-Balata" },
  { key: "triger_seti", label: "Triger Seti" },
  { key: "aku", label: "Akü" },
  { key: "lastik", label: "Lastik" },
];

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "yeni";
  const supabase = createBrowserSupabase();

  const [vehicle, setVehicle] = useState<any>(
    isNew ? { plate: "", brand: "", model: "", year: "", current_km: 0, next_service_km: "", next_service_date: "" } : null
  );
  const [records, setRecords] = useState<any[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [newRecord, setNewRecord] = useState({ description: "", km_at_service: "", cost: "" });
  const [loading, setLoading] = useState(!isNew);
  const [savingItem, setSavingItem] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", params.id).single();
      setVehicle(v);
      const { data: r } = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", params.id)
        .order("service_date", { ascending: false });
      setRecords(r ?? []);

      const { data: mi } = await supabase
        .from("maintenance_items")
        .select("*")
        .eq("vehicle_id", params.id);
      setMaintenanceItems(mi ?? []);

      const publicUrl = `${window.location.origin}/v/${params.id}`;
      const qr = await QRCode.toDataURL(publicUrl, { width: 220 });
      setQrDataUrl(qr);

      setLoading(false);
    }
    load();
  }, [params.id]);

  async function handleSaveVehicle() {
    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", session.session?.user.id)
      .single();

    if (isNew) {
      const { data: created, error } = await supabase
        .from("vehicles")
        .insert({ ...vehicle, tenant_id: staff?.tenant_id, year: vehicle.year || null, next_service_km: vehicle.next_service_km || null, next_service_date: vehicle.next_service_date || null })
        .select()
        .single();
      if (!error && created) router.push(`/panel/araclar/${created.id}`);
    } else {
      await supabase
        .from("vehicles")
        .update({
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year || null,
          current_km: vehicle.current_km,
          next_service_km: vehicle.next_service_km || null,
          next_service_date: vehicle.next_service_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      alert("Kaydedildi.");
    }
  }

  async function handleQuickMaintenance(itemKey: string, label: string) {
    setSavingItem(itemKey);
    const today = new Date().toISOString().slice(0, 10);

    await supabase.from("maintenance_items").upsert(
      {
        vehicle_id: params.id,
        item_key: itemKey,
        last_service_date: today,
        last_service_km: vehicle.current_km,
      },
      { onConflict: "vehicle_id,item_key" }
    );

    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", session.session?.user.id)
      .single();

    await supabase.from("maintenance_records").insert({
      vehicle_id: params.id,
      tenant_id: staff?.tenant_id,
      description: label,
      km_at_service: vehicle.current_km,
      created_by: session.session?.user.id,
    });

    const { data: mi } = await supabase
      .from("maintenance_items")
      .select("*")
      .eq("vehicle_id", params.id);
    setMaintenanceItems(mi ?? []);

    const { data: r } = await supabase
      .from("maintenance_records")
      .select("*")
      .eq("vehicle_id", params.id)
      .order("service_date", { ascending: false });
    setRecords(r ?? []);

    setSavingItem(null);
  }

  async function handleAddRecord() {
    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", session.session?.user.id)
      .single();

    await supabase.from("maintenance_records").insert({
      vehicle_id: params.id,
      tenant_id: staff?.tenant_id,
      description: newRecord.description,
      km_at_service: newRecord.km_at_service ? Number(newRecord.km_at_service) : null,
      cost: newRecord.cost ? Number(newRecord.cost) : null,
      created_by: session.session?.user.id,
    });

    const { data: r } = await supabase
      .from("maintenance_records")
      .select("*")
      .eq("vehicle_id", params.id)
      .order("service_date", { ascending: false });
    setRecords(r ?? []);
    setNewRecord({ description: "", km_at_service: "", cost: "" });
  }

  if (loading || !vehicle) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  const inputStyle = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 10 };

  function getItemStatus(itemKey: string) {
    const item = maintenanceItems.find((m) => m.item_key === itemKey);
    if (!item || !item.last_service_date) return null;
    const isToday = item.last_service_date === new Date().toISOString().slice(0, 10);
    return { date: item.last_service_date, isToday };
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>{isNew ? "Yeni Araç" : vehicle.plate}</h1>

      <section style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13 }}>Plaka</label>
        <input style={inputStyle} value={vehicle.plate} onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value })} />

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Marka</label>
            <input style={inputStyle} value={vehicle.brand || ""} onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Model</label>
            <input style={inputStyle} value={vehicle.model || ""} onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })} />
          </div>
        </div>

        <label style={{ fontSize: 13 }}>Güncel Kilometre</label>
        <input type="number" style={inputStyle} value={vehicle.current_km} onChange={(e) => setVehicle({ ...vehicle, current_km: Number(e.target.value) })} />

        <label style={{ fontSize: 13 }}>Sonraki Bakım (km)</label>
        <input type="number" style={inputStyle} value={vehicle.next_service_km || ""} onChange={(e) => setVehicle({ ...vehicle, next_service_km: Number(e.target.value) })} />

        <label style={{ fontSize: 13 }}>Sonraki Bakım (tarih)</label>
        <input type="date" style={inputStyle} value={vehicle.next_service_date || ""} onChange={(e) => setVehicle({ ...vehicle, next_service_date: e.target.value })} />

        <button onClick={handleSaveVehicle} style={{ padding: "10px 16px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Kaydet
        </button>
      </section>

      {!isNew && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, color: "#888", marginBottom: 10 }}>Hızlı Bakım Ekle</h2>
          <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>Yapılan bakımı seç, otomatik bugünün tarihi ve güncel km ile kaydedilir.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {MAINTENANCE_ITEMS.map((item) => {
              const status = getItemStatus(item.key);
              const isSaving = savingItem === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleQuickMaintenance(item.key, item.label)}
                  disabled={isSaving}
                  style={{
                    padding: "14px 10px",
                    borderRadius: 10,
                    border: status?.isToday ? "2px solid #2e7d32" : "1px solid #ccc",
                    background: status?.isToday ? "#e8f5e9" : "#fff",
                    color: status?.isToday ? "#2e7d32" : "#1E3A5F",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: isSaving ? "wait" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>{isSaving ? "Kaydediliyor…" : item.label}</div>
                  {status && (
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, color: status.isToday ? "#2e7d32" : "#999" }}>
                      {status.isToday ? "✓ Bugün yapıldı" : `Son: ${new Date(status.date).toLocaleDateString("tr-TR")}`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!isNew && qrDataUrl && (
        <section style={{ marginBottom: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 15, color: "#888" }}>Araç QR Kodu</h2>
          <img src={qrDataUrl} alt="Araç QR kodu" style={{ width: 180, height: 180 }} />
          <p style={{ fontSize: 12, color: "#999" }}>Bu kodu anahtarlığa/NFC etikete işleyin. Bu kod ve araç geçmişi, araç el değiştirse bile aynı kalır.</p>
        </section>
      )}

      {!isNew && (
        <section style={{ marginBottom: 24, textAlign: "center" }}>
          <a
            href={`/panel/araclar/${params.id}/devret`}
            style={{ fontSize: 13, color: "#888", textDecoration: "underline" }}
          >
            Bu aracın sahipliğini devret
          </a>
        </section>
      )}

      {!isNew && (
        <section>
          <h2 style={{ fontSize: 15, color: "#888" }}>Diğer Bakım Kaydı (serbest metin)</h2>
          <input
            placeholder="Yapılan işlem (örn. Yağ değişimi)"
            style={inputStyle}
            value={newRecord.description}
            onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              placeholder="Km"
              style={inputStyle}
              value={newRecord.km_at_service}
              onChange={(e) => setNewRecord({ ...newRecord, km_at_service: e.target.value })}
            />
            <input
              type="number"
              placeholder="Ücret (₺)"
              style={inputStyle}
              value={newRecord.cost}
              onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })}
            />
          </div>
          <button onClick={handleAddRecord} style={{ padding: "10px 16px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginBottom: 20 }}>
            Kaydı Ekle
          </button>

          <h2 style={{ fontSize: 15, color: "#888" }}>Geçmiş</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {records.map((r) => (
              <li key={r.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", fontSize: 14 }}>
                {new Date(r.service_date).toLocaleDateString("tr-TR")} — {r.description} {r.km_at_service ? `(${r.km_at_service} km)` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
