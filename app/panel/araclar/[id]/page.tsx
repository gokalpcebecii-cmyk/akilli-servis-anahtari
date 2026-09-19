"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";

const QUICK_ITEMS = [
  { key: "motor_yagi", label: "Motor Yağı" },
  { key: "yag_filtresi", label: "Yağ Filtresi" },
  { key: "hava_filtresi", label: "Hava Filtresi" },
  { key: "polen_filtresi", label: "Polen Filtresi" },
  { key: "fren_on_balata", label: "Ön Fren Balatası" },
  { key: "fren_arka_balata", label: "Arka Fren Balatası" },
  { key: "lastik", label: "Lastik" },
  { key: "aku", label: "Akü" },
];

const PRESET_KM_OPTIONS = [5000, 10000, 15000, 20000, 30000];

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
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Hızlı bakım girişi state'i
  const [quickKm, setQuickKm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [itemIntervals, setItemIntervals] = useState<Record<string, string>>({});
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [nextServiceKm, setNextServiceKm] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", params.id).single();
      setVehicle(v);
      if (v) {
        setQuickKm(String(v.current_km ?? ""));
        setNextServiceKm(v.next_service_km ? String(v.next_service_km) : "");
        setNextServiceDate(v.next_service_date || "");
      }

      const { data: r } = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", params.id)
        .order("service_date", { ascending: false });
      setRecords(r ?? []);

      const { data: mi } = await supabase.from("maintenance_items").select("*").eq("vehicle_id", params.id);
      setMaintenanceItems(mi ?? []);

      const initialIntervals: Record<string, string> = {};
      (mi ?? []).forEach((item: any) => {
        if (item.interval_km != null) initialIntervals[item.item_key] = String(item.interval_km);
      });
      setItemIntervals(initialIntervals);

      await loadQr(params.id as string);
      setLoading(false);
    }
    load();
  }, [params.id]);

  // Bu araç için geçerli, iptal edilmemiş bir QR/NFC kodu var mı diye bakar.
  // Eskiden bu sayfa /v/[id] (vehicle_id'yi doğrudan public URL'de kullanan,
  // hiçbir zaman iptal edilemeyen bir mekanizma) üzerinden QR gösteriyordu —
  // bu, "QR araç kimliği değildir" kuralını ihlal ediyordu. Artık aynı
  // bireysel akışta kullanılan, iptal/yenileme desteği olan qr_keys +
  // /p/[code] sistemini kullanıyor. Not: qr_keys üzerinde servis kullanıcıları
  // için doğrudan INSERT izni RLS'de bilerek yok (havuzdaki kodlar yalnızca
  // /api/qr-eslestir üzerinden atanabilir) — bu yüzden burada kod
  // bulunamazsa staff'ı /panel/eslestir'e yönlendiriyoruz, kendimiz üretmiyoruz.
  async function loadQr(vehicleId: string) {
    const { data: qrKey } = await supabase
      .from("qr_keys")
      .select("code")
      .eq("vehicle_id", vehicleId)
      .is("revoked_at", null)
      .maybeSingle();

    if (qrKey) {
      setQrCode(qrKey.code);
      const publicUrl = `${window.location.origin}/p/${qrKey.code}`;
      const qr = await QRCode.toDataURL(publicUrl, { width: 200 });
      setQrDataUrl(qr);
    } else {
      setQrCode(null);
      setQrDataUrl(null);
    }
  }

  async function handleSaveVehicleInfo() {
    setSavingVehicle(true);
    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase.from("staff_users").select("tenant_id").eq("id", session.session?.user.id).single();

    if (isNew) {
      const { data: created, error } = await supabase
        .from("vehicles")
        .insert({ ...vehicle, tenant_id: staff?.tenant_id, year: vehicle.year || null, next_service_km: vehicle.next_service_km || null, next_service_date: vehicle.next_service_date || null })
        .select()
        .single();
      setSavingVehicle(false);
      if (!error && created) router.push(`/panel/araclar/${created.id}`);
    } else {
      await supabase
        .from("vehicles")
        .update({
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      setSavingVehicle(false);
      setEditingVehicle(false);
    }
  }

  function toggleItem(key: string) {
    setSelectedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const anySelected = Object.values(selectedItems).some(Boolean) || otherSelected;
  const kmValid = quickKm !== "" && !Number.isNaN(Number(quickKm));

  // Tek dokunuşla seçilen tüm işlemleri TEK seferde, tek "Kaydet" ile
  // gönderir: bir staff/tenant sorgusu, bir araç güncellemesi, bir toplu
  // maintenance_items upsert, bir toplu maintenance_records insert.
  // Hedef: 15-20 saniyelik bakım girişi.
  async function handleQuickSave() {
    if (submitting) return;
    setSubmitError("");
    setSuccessMessage("");

    if (!kmValid) {
      setSubmitError("Lütfen geçerli bir kilometre girin.");
      return;
    }
    if (!anySelected) {
      setSubmitError("En az bir işlem seçin ya da 'Diğer' ile yazın.");
      return;
    }
    if (otherSelected && !otherText.trim()) {
      setSubmitError("Diğer işlem için kısa bir açıklama yazın.");
      return;
    }

    setSubmitting(true);

    const km = Number(quickKm);
    const today = new Date().toISOString().slice(0, 10);

    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase.from("staff_users").select("tenant_id").eq("id", session.session?.user.id).single();
    const tenantId = staff?.tenant_id;
    const actorId = session.session?.user.id;

    const selectedKeys = QUICK_ITEMS.filter((it) => selectedItems[it.key]).map((it) => it.key);

    await supabase
      .from("vehicles")
      .update({
        current_km: km,
        next_service_km: nextServiceKm ? Number(nextServiceKm) : null,
        next_service_date: nextServiceDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (selectedKeys.length > 0) {
      const itemsUpsert = selectedKeys.map((key) => ({
        vehicle_id: params.id,
        item_key: key,
        last_service_date: today,
        last_service_km: km,
        interval_km: itemIntervals[key] ? Number(itemIntervals[key]) : null,
      }));
      await supabase.from("maintenance_items").upsert(itemsUpsert, { onConflict: "vehicle_id,item_key" });
    }

    const recordsToInsert = selectedKeys.map((key) => {
      const label = QUICK_ITEMS.find((it) => it.key === key)?.label ?? key;
      return {
        vehicle_id: params.id,
        tenant_id: tenantId,
        description: label,
        km_at_service: km,
        created_by: actorId,
      };
    });
    if (otherSelected && otherText.trim()) {
      recordsToInsert.push({
        vehicle_id: params.id,
        tenant_id: tenantId,
        description: otherText.trim(),
        km_at_service: km,
        created_by: actorId,
      });
    }
    if (recordsToInsert.length > 0) {
      await supabase.from("maintenance_records").insert(recordsToInsert);
    }

    const { data: mi } = await supabase.from("maintenance_items").select("*").eq("vehicle_id", params.id);
    setMaintenanceItems(mi ?? []);
    const { data: r } = await supabase
      .from("maintenance_records")
      .select("*")
      .eq("vehicle_id", params.id)
      .order("service_date", { ascending: false });
    setRecords(r ?? []);
    setVehicle((prev: any) => ({ ...prev, current_km: km, next_service_km: nextServiceKm ? Number(nextServiceKm) : null, next_service_date: nextServiceDate || null }));

    setSelectedItems({});
    setOtherSelected(false);
    setOtherText("");
    setSubmitting(false);
    setSuccessMessage("✓ Kayıt tamamlandı");
    setTimeout(() => setSuccessMessage(""), 4000);
  }

  if (loading || !vehicle) return <main style={{ padding: 24 }}>Yükleniyor…</main>;

  const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, fontSize: 16 };
  const chipBase = {
    padding: "14px 10px",
    borderRadius: 12,
    textAlign: "center" as const,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    userSelect: "none" as const,
    border: "2px solid #ddd",
    background: "#fff",
    color: "#333",
  };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{isNew ? "Yeni Araç" : vehicle.plate}</h1>
        {!isNew && (
          <button
            onClick={() => setEditingVehicle((v) => !v)}
            style={{ background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
          >
            {editingVehicle ? "Kapat" : "Araç bilgilerini düzenle"}
          </button>
        )}
      </div>

      {(isNew || editingVehicle) && (
        <section style={{ marginBottom: 24, background: "#fafafa", borderRadius: 12, padding: 14 }}>
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
          <button
            onClick={handleSaveVehicleInfo}
            disabled={savingVehicle}
            style={{ padding: "10px 16px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            {savingVehicle ? "Kaydediliyor…" : isNew ? "Aracı Oluştur" : "Bilgileri Kaydet"}
          </button>
        </section>
      )}

      {!isNew && (
        <section style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>Güncel Kilometre</label>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            style={{ ...inputStyle, fontSize: 22, fontWeight: 800, padding: 14, textAlign: "center" }}
            value={quickKm}
            onChange={(e) => setQuickKm(e.target.value)}
            placeholder="Km"
          />

          <label style={{ fontSize: 13, color: "#555", fontWeight: 600, marginBottom: 8, display: "block" }}>Yapılan İşlemler</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 10 }}>
            {QUICK_ITEMS.map((item) => {
              const active = !!selectedItems[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => toggleItem(item.key)}
                  style={{
                    ...chipBase,
                    border: active ? "2px solid #1E3A5F" : chipBase.border,
                    background: active ? "#1E3A5F" : "#fff",
                    color: active ? "#fff" : "#333",
                  }}
                >
                  {item.label}
                  {active && (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginBottom: 4 }}>
                        {PRESET_KM_OPTIONS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setItemIntervals((prev) => ({ ...prev, [item.key]: String(p) }))}
                            style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 999,
                              border: itemIntervals[item.key] === String(p) ? "1.5px solid #D4A94A" : "1px solid rgba(255,255,255,0.5)",
                              background: itemIntervals[item.key] === String(p) ? "#D4A94A" : "transparent",
                              color: "#fff", cursor: "pointer",
                            }}
                          >
                            {p / 1000}bin
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div
              onClick={() => setOtherSelected((v) => !v)}
              style={{
                ...chipBase,
                gridColumn: "span 2",
                border: otherSelected ? "2px solid #1E3A5F" : chipBase.border,
                background: otherSelected ? "#1E3A5F" : "#fff",
                color: otherSelected ? "#fff" : "#333",
              }}
            >
              Diğer
            </div>
          </div>

          {otherSelected && (
            <input
              placeholder="Yapılan işlemi kısaca yazın"
              style={inputStyle}
              value={otherText}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setOtherText(e.target.value)}
            />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#888" }}>Sonraki Bakım (km)</label>
              <input type="number" inputMode="numeric" style={inputStyle} value={nextServiceKm} onChange={(e) => setNextServiceKm(e.target.value)} placeholder="Opsiyonel" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#888" }}>Sonraki Bakım (tarih)</label>
              <input type="date" style={inputStyle} value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} />
            </div>
          </div>

          {submitError && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{submitError}</p>}
          {successMessage && (
            <div style={{ background: "#eaf7ef", color: "#2E6B4F", padding: "10px 14px", borderRadius: 8, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>
              {successMessage}
            </div>
          )}

          <button
            onClick={handleQuickSave}
            disabled={submitting}
            style={{
              width: "100%", padding: 16, background: submitting ? "#8fa3b8" : "#1E3A5F", color: "#fff", border: "none",
              borderRadius: 10, fontWeight: 800, fontSize: 16, cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Kaydediliyor…" : "KAYDET"}
          </button>
        </section>
      )}

      {!isNew && (
        <section style={{ marginBottom: 20, textAlign: "center" }}>
          <h2 style={{ fontSize: 14, color: "#888" }}>Araç QR Kodu</h2>
          {qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="Araç QR kodu" style={{ width: 150, height: 150 }} />
              {qrCode && <p style={{ fontSize: 11, color: "#bbb", fontFamily: "monospace" }}>{qrCode}</p>}
              <p style={{ fontSize: 12, color: "#999" }}>Bu kodu anahtarlığa/NFC etikete işleyin. Araç el değiştirse bile bu kod ve geçmişi aynı kalır.</p>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#999" }}>
              Bu araca henüz bir QR anahtarlık atanmamış.{" "}
              <a href="/panel/eslestir" style={{ color: "#1E3A5F", fontWeight: 600 }}>Anahtarlık Eşleştir</a> sayfasından atayabilirsiniz.
            </p>
          )}
        </section>
      )}

      {!isNew && (
        <section style={{ marginBottom: 24, textAlign: "center" }}>
          <a href={`/panel/araclar/${params.id}/devret`} style={{ fontSize: 13, color: "#888", textDecoration: "underline" }}>
            Bu aracın sahipliğini devret
          </a>
        </section>
      )}

      {!isNew && (
        <section>
          <h2 style={{ fontSize: 15, color: "#888" }}>Geçmiş</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {records.map((r) => (
              <li key={r.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", fontSize: 14 }}>
                {new Date(r.service_date).toLocaleDateString("tr-TR")} — {r.description} {r.km_at_service ? `(${r.km_at_service.toLocaleString("tr-TR")} km)` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
