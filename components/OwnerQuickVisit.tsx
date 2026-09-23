"use client";

// OTOİZ — 2026-09-23: Bireysel kullanıcı için servis panelindeki "Hızlı
// Bakım Kaydı" ile aynı akış: güncel km + yapılan işlemleri çoklu seç +
// tek KAYDET. Tek ziyaret = tek bakım kaydı (birleşik açıklama); her kalemin
// son bakım km/tarihi ayrı güncellenir; sonraki bakım, seçilen kalemlerin
// en erken vadesine göre otomatik önerilir. Kayıt tenant_id=null ile
// ("Kullanıcı Kaydı") yazılır — servis doğrulamalı kayıt gibi görünmez.
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle } from "@/lib/theme";

const { isValidCurrentKmUpdate, computeAutoNextServicePlan, todayIsoIstanbul } = require("@/lib/logic");

export type QuickItem = { key: string; label: string };

type Props = {
  vehicle: any;
  userId: string | null;
  items: QuickItem[];
  defaultIntervals: Record<string, number>;
  maintenanceItems: any[];
  onSaved: (update: { current_km: number; next_service_km: number; next_service_date: string }) => Promise<void> | void;
};

export default function OwnerQuickVisit({ vehicle, userId, items, defaultIntervals, maintenanceItems, onSaved }: Props) {
  const supabase = createBrowserSupabase();
  const [km, setKm] = useState<string>(vehicle?.current_km != null ? String(vehicle.current_km) : "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedKeys = items.filter((it) => selected[it.key]).map((it) => it.key);

  function intervalFor(key: string): number | null {
    const existing = maintenanceItems.find((m: any) => m.item_key === key);
    if (existing?.interval_km) return Number(existing.interval_km);
    return defaultIntervals[key] ?? null;
  }

  async function save() {
    if (saving) return;
    setError("");
    setSuccess("");
    const kmNum = Number(km);
    if (!km || !Number.isFinite(kmNum) || kmNum <= 0) {
      setError("Lütfen geçerli bir kilometre girin.");
      return;
    }
    if (!isValidCurrentKmUpdate(vehicle.current_km, kmNum)) {
      setError(`Kilometre, kayıtlı son kilometreden (${Number(vehicle.current_km).toLocaleString("tr-TR")} km) düşük olamaz.`);
      return;
    }
    if (selectedKeys.length === 0 && !(otherOn && otherText.trim())) {
      setError("En az bir işlem seçin ya da 'Diğer' ile yazın.");
      return;
    }
    if (!userId) {
      setError("Oturum bilgisi alınamadı. Sayfayı yenileyin.");
      return;
    }

    const today = todayIsoIstanbul();
    const selIntervals: Record<string, string> = {};
    for (const k of selectedKeys) {
      const iv = intervalFor(k);
      if (iv) selIntervals[k] = String(iv);
    }
    const plan = computeAutoNextServicePlan({ currentKm: kmNum, today, selectedItemIntervals: selIntervals });

    setSaving(true);
    try {
      const { data: v, error: vErr } = await supabase
        .from("vehicles")
        .update({
          current_km: kmNum,
          next_service_km: plan.nextServiceKm,
          next_service_date: plan.nextServiceDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vehicle.id)
        .eq("owner_user_id", userId)
        .select("id");
      if (vErr || !v || v.length === 0) {
        setError("Araç güncellenemedi. Sayfayı yenileyip tekrar deneyin.");
        return;
      }

      if (selectedKeys.length > 0) {
        const rows = selectedKeys.map((k) => ({
          vehicle_id: vehicle.id,
          item_key: k,
          last_service_date: today,
          last_service_km: kmNum,
          interval_km: intervalFor(k),
        }));
        const { error: iErr } = await supabase.from("maintenance_items").upsert(rows, { onConflict: "vehicle_id,item_key" });
        if (iErr) {
          setError("Bakım kalemleri kaydedilemedi. Sayfayı yenileyip geçmişi kontrol edin.");
          return;
        }
      }

      const labels = selectedKeys.map((k) => items.find((it) => it.key === k)?.label ?? k);
      if (otherOn && otherText.trim()) labels.push(otherText.trim());
      const { error: rErr } = await supabase.from("maintenance_records").insert({
        vehicle_id: vehicle.id,
        tenant_id: null,
        description: labels.join(", "),
        km_at_service: kmNum,
        created_by: userId,
      });
      if (rErr) {
        setError("Bakım kaydı oluşturulamadı. Sayfayı yenileyip geçmişi kontrol edin.");
        return;
      }

      await onSaved({ current_km: kmNum, next_service_km: plan.nextServiceKm, next_service_date: plan.nextServiceDate });
      setSelected({});
      setOtherOn(false);
      setOtherText("");
      setSuccess("✓ Bakım kaydedildi");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Bağlantı hatası. Sayfayı yenileyip geçmişi kontrol edin.");
    } finally {
      setSaving(false);
    }
  }

  const tile = (on: boolean): React.CSSProperties => ({
    minHeight: 44,
    borderRadius: radius.sm,
    border: `1.5px solid ${on ? colors.green : colors.border}`,
    background: on ? colors.green : "#fff",
    color: on ? colors.textDark : colors.textDark,
    fontWeight: 700,
    fontSize: 13.5,
    fontFamily: font,
    cursor: "pointer",
    padding: "8px 6px",
  });

  return (
    <section id="hizli-bakim" style={cardStyle}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.textDark, margin: "0 0 12px" }}>Hızlı Bakım Kaydı</h2>

      <label style={labelStyle} htmlFor="owner-quick-km">Güncel Kilometre</label>
      <input
        id="owner-quick-km"
        inputMode="numeric"
        value={km ? Number(km).toLocaleString("tr-TR") : ""}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setKm(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        style={{ ...inputStyle, fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 14 }}
      />

      <div style={{ ...labelStyle, marginBottom: 8 }}>Yapılan İşlemler</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            aria-pressed={!!selected[it.key]}
            onClick={() => setSelected((s) => ({ ...s, [it.key]: !s[it.key] }))}
            style={tile(!!selected[it.key])}
          >
            {it.label}
          </button>
        ))}
        <button type="button" aria-pressed={otherOn} onClick={() => setOtherOn((v) => !v)} style={tile(otherOn)}>
          Diğer
        </button>
      </div>
      {otherOn && (
        <input
          placeholder="Ör. Klima gazı dolumu"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
          aria-label="Diğer işlem"
        />
      )}

      {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
      {success && <p role="status" style={{ color: colors.greenDark, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{success}</p>}

      <button type="button" onClick={save} disabled={saving} style={primaryButtonStyle(saving)}>
        {saving ? "Kaydediliyor…" : "KAYDET"}
      </button>
    </section>
  );
}
