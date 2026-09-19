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

const PRESET_KM_OPTIONS = [5000, 10000, 15000, 20000, 30000];

function generateCode(length = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[random[i] % chars.length];
  return out;
}

export default function BireyselVehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "yeni";
  const supabase = createBrowserSupabase();

  const [userId, setUserId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<any>(
    isNew ? { plate: "", brand: "", model: "", year: "", current_km: 0, next_service_km: "", next_service_date: "", notes: "" } : null
  );
  const [records, setRecords] = useState<any[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<any[]>([]);
  const [intervalInputs, setIntervalInputs] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [newRecord, setNewRecord] = useState({ description: "", km_at_service: "", cost: "" });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [savingInterval, setSavingInterval] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      setUserId(session.session.user.id);

      if (isNew) return;

      const { data: v } = await supabase.from("vehicles").select("*").eq("id", params.id).single();
      if (!v || v.owner_user_id !== session.session.user.id) {
        router.push("/bireysel/araclar");
        return;
      }
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

      const initialIntervals: Record<string, string> = {};
      (mi ?? []).forEach((item: any) => {
        if (item.interval_km != null) initialIntervals[item.item_key] = String(item.interval_km);
      });
      setIntervalInputs(initialIntervals);

      let { data: qrKey } = await supabase
        .from("qr_keys")
        .select("code")
        .eq("vehicle_id", params.id)
        .is("revoked_at", null)
        .maybeSingle();

      if (!qrKey) {
        const code = generateCode();
        const { data: created } = await supabase
          .from("qr_keys")
          .insert({ code, vehicle_id: params.id, assigned_at: new Date().toISOString() })
          .select("code")
          .single();
        qrKey = created;
      }

      if (qrKey) {
        const publicUrl = `${window.location.origin}/p/${qrKey.code}`;
        const qr = await QRCode.toDataURL(publicUrl, { width: 220 });
        setQrDataUrl(qr);
      }

      setLoading(false);
    }
    init();
  }, [params.id]);

  async function refreshMaintenanceItems() {
    const { data: mi } = await supabase.from("maintenance_items").select("*").eq("vehicle_id", params.id);
    setMaintenanceItems(mi ?? []);
  }

  async function refreshRecords() {
    const { data: r } = await supabase
      .from("maintenance_records")
      .select("*")
      .eq("vehicle_id", params.id)
      .order("service_date", { ascending: false });
    setRecords(r ?? []);
  }

  async function handleSaveVehicle() {
    setSaving(true);
    if (isNew) {
      const { data: created, error } = await supabase
        .from("vehicles")
        .insert({
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year || null,
          current_km: vehicle.current_km,
          next_service_km: vehicle.next_service_km || null,
          next_service_date: vehicle.next_service_date || null,
          notes: vehicle.notes || null,
          owner_user_id: userId,
          tenant_id: null,
        })
        .select()
        .single();
      setSaving(false);
      if (!error && created) router.push(`/bireysel/araclar/${created.id}`);
      else alert(error?.message || "Kaydedilemedi.");
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
          notes: vehicle.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      setSaving(false);
      alert("Kaydedildi.");
    }
  }

  async function handleQuickMaintenance(itemKey: string, label: string) {
    setSavingItem(itemKey);
    const today = new Date().toISOString().slice(0, 10);
    const existingInterval = intervalInputs[itemKey];
    const intervalKm = existingInterval ? Number(existingInterval) : null;

    await supabase.from("maintenance_items").upsert(
      {
        vehicle_id: params.id,
        item_key: itemKey,
        last_service_date: today,
        last_service_km: vehicle.current_km,
        interval_km: intervalKm,
      },
      { onConflict: "vehicle_id,item_key" }
    );

    await supabase.from("maintenance_records").insert({
      vehicle_id: params.id,
      tenant_id: null,
      description: label,
      km_at_service: vehicle.current_km,
      created_by: userId,
    });

    await refreshMaintenanceItems();
    await refreshRecords();
    setSavingItem(null);
  }

  function handleIntervalInputChange(itemKey: string, value: string) {
    setIntervalInputs((prev) => ({ ...prev, [itemKey]: value }));
  }

  async function saveInterval(itemKey: string, value: string) {
    setSavingInterval(itemKey);
    await supabase.from("maintenance_items").upsert(
      { vehicle_id: params.id, item_key: itemKey, interval_km: value ? Number(value) : null },
      { onConflict: "vehicle_id,item_key" }
    );
    await refreshMaintenanceItems();
    setSavingInterval(null);
  }

  function handleIntervalBlur(itemKey: string) {
    saveInterval(itemKey, intervalInputs[itemKey] ?? "");
  }

  function handlePresetClick(itemKey: string, value: number) {
    setIntervalInputs((prev) => ({ ...prev, [itemKey]: String(value) }));
    saveInterval(itemKey, String(value));
  }

  async function handleAddRecord() {
    if (!newRecord.description) return;
    await supabase.from("maintenance_records").insert({
      vehicle_id: params.id,
      tenant_id: null,
      description: newRecord.description,
      km_at_service: newRecord.km_at_service ? Number(newRecord.km_at_service) : null,
      cost: newRecord.cost ? Number(newRecord.cost) : null,
      created_by: userId,
    });
    await refreshRecords();
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
      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1, color: "#0B1F3A", marginBottom: 8 }}>
        OTO<span style={{ color: "#D4A94A" }}>İZ</span>
      </div>
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

        <label style={{ fontSize: 13 }}>Model Yılı</label>
        <input type="number" style={inputStyle} value={vehicle.year || ""} onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })} />

        <label style={{ fontSize: 13 }}>Güncel Kilometre</label>
        <input type="number" style={inputStyle} value={vehicle.current_km} onChange={(e) => setVehicle({ ...vehicle, current_km: Number(e.target.value) })} />

        <label style={{ fontSize: 13 }}>Sonraki Bakım (km)</label>
        <input type="number" style={inputStyle} value={vehicle.next_service_km || ""} onChange={(e) => setVehicle({ ...vehicle, next_service_km: Number(e.target.value) })} />

        <label style={{ fontSize: 13 }}>Sonraki Bakım (tarih)</label>
        <input type="date" style={inputStyle} value={vehicle.next_service_date || ""} onChange={(e) => setVehicle({ ...vehicle, next_service_date: e.target.value })} />

        <label style={{ fontSize: 13 }}>Notlar</label>
        <input style={inputStyle} value={vehicle.notes || ""} onChange={(e) => setVehicle({ ...vehicle, notes: e.target.value })} placeholder="Örn: muayene tarihi, sigorta notu vb." />

        <button onClick={handleSaveVehicle} disabled={saving} style={{ padding: "10px 16px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </section>

      {!isNew && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, color: "#888", marginBottom: 10 }}>Hızlı Bakım Ekle</h2>
          <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
            Kendin yaptıysan ya da başka bir yerde yaptırdıysan butona bas — otomatik bugünün tarihi ve güncel km ile kaydedilir.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MAINTENANCE_ITEMS.map((item) => {
              const status = getItemStatus(item.key);
              const isSaving = savingItem === item.key;
              const isSavingInterval = savingInterval === item.key;
              const currentValue = intervalInputs[item.key] ?? "";
              return (
                <div
                  key={item.key}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: status?.isToday ? "2px solid #2e7d32" : "1px solid #ccc",
                    background: status?.isToday ? "#e8f5e9" : "#fff",
                  }}
                >
                  <button
                    onClick={() => handleQuickMaintenance(item.key, item.label)}
                    disabled={isSaving}
                    style={{
                      width: "100%", textAlign: "left", background: "none", border: "none",
                      cursor: isSaving ? "wait" : "pointer",
                      color: status?.isToday ? "#2e7d32" : "#1E3A5F", fontWeight: 600, fontSize: 13, padding: 0, marginBottom: 8,
                    }}
                  >
                    <div>{isSaving ? "Kaydediliyor…" : item.label}</div>
                    {status && (
                      <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, color: status.isToday ? "#2e7d32" : "#999" }}>
                        {status.isToday ? "✓ Bugün yapıldı" : `Son: ${new Date(status.date).toLocaleDateString("tr-TR")}`}
                      </div>
                    )}
                  </button>

                  <div style={{ fontSize: 10, color: "#999", marginBottom: 4 }}>Periyot (km)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {PRESET_KM_OPTIONS.map((preset) => {
                      const isActive = currentValue === String(preset);
                      return (
                        <button
                          key={preset}
                          onClick={() => handlePresetClick(item.key, preset)}
                          disabled={isSavingInterval}
                          style={{
                            padding: "4px 10px", borderRadius: 999,
                            border: isActive ? "1.5px solid #1E3A5F" : "1px solid #ccc",
                            background: isActive ? "#1E3A5F" : "#fff",
                            color: isActive ? "#fff" : "#555",
                            fontSize: 11, fontWeight: 600, cursor: isSavingInterval ? "wait" : "pointer",
                          }}
                        >
                          {preset.toLocaleString("tr-TR")}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="number"
                    placeholder="veya kendi sayını yaz"
                    value={currentValue}
                    onChange={(e) => handleIntervalInputChange(item.key, e.target.value)}
                    onBlur={() => handleIntervalBlur(item.key)}
                    disabled={isSavingInterval}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 12 }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!isNew && qrDataUrl && (
        <section style={{ marginBottom: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 15, color: "#888" }}>Araç QR Kodu</h2>
          <img src={qrDataUrl} alt="Araç QR kodu" style={{ width: 180, height: 180 }} />
          <p style={{ fontSize: 12, color: "#999" }}>Bu kodu anahtarlığa/NFC etikete işleyebilirsin. Aracını satarsan bu pasaport ve teknik geçmiş araçla kalır.</p>
        </section>
      )}

      {!isNew && (
        <section>
          <h2 style={{ fontSize: 15, color: "#888" }}>Diğer Bakım Kaydı (serbest not)</h2>
          <input
            placeholder="Yapılan işlem (örn. Genel bakım, lastik rotasyonu)"
            style={inputStyle}
            value={newRecord.description}
            onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number" placeholder="Km" style={inputStyle}
              value={newRecord.km_at_service}
              onChange={(e) => setNewRecord({ ...newRecord, km_at_service: e.target.value })}
            />
            <input
              type="number" placeholder="Ücret (₺)" style={inputStyle}
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
                <div>
                  {new Date(r.service_date).toLocaleDateString("tr-TR")} — {r.description} {r.km_at_service ? `(${r.km_at_service} km)` : ""}
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                  background: r.tenant_id ? "#eaf7ef" : "#f0f0f0",
                  color: r.tenant_id ? "#2E6B4F" : "#666",
                }}>
                  {r.tenant_id ? "Servis Doğrulamalı Kayıt" : "Araç Sahibi Kaydı"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
