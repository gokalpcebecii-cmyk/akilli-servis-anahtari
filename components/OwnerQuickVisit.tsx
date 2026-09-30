"use client";

// OTOİZ — 2026-09-23: Bireysel kullanıcı için servis panelindeki "Hızlı
// Bakım Kaydı" ile aynı akış: güncel km + yapılan işlemleri çoklu seç +
// tek KAYDET. Tek ziyaret = tek bakım kaydı (birleşik açıklama); her kalemin
// son bakım km/tarihi ayrı güncellenir; sonraki bakım, seçilen kalemlerin
// en erken vadesine göre otomatik önerilir. Kayıt tenant_id=null ile
// ("Kullanıcı Kaydı") yazılır — servis doğrulamalı kayıt gibi görünmez.
import { useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { CaretSafeInput } from "@/components/CaretSafeInput";
import { colors, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle } from "@/lib/theme";
import { ItemChipGrid, GRID_ITEMS } from "@/components/ItemChipGrid";

const { isValidCurrentKmUpdate, resolveQuickPlan, todayIsoIstanbul } = require("@/lib/logic");
const { ITEM_LABELS, NEXT_PLAN_OPTIONS } = require("@/lib/maintenanceItems");

export type QuickItem = { key: string; label: string };

type Props = {
  vehicle: any;
  userId: string | null;
  items: QuickItem[];
  defaultIntervals: Record<string, number>;
  maintenanceItems: any[];
  onSaved: (update: { current_km: number; next_service_km: number | null; next_service_date: string | null }) => Promise<void> | void;
  // Nihai UX son düzenleme: form Genel Bakış'ta değil, "Hızlı İşlemler >
  // Bakım Kaydı Ekle" penceresinde. bare: kart çerçevesi olmadan çizilir.
  bare?: boolean;
  onDone?: () => void;
};

export default function OwnerQuickVisit({ vehicle, userId, items, defaultIntervals, maintenanceItems, onSaved, bare = false, onDone }: Props) {
  const supabase = createBrowserSupabase();
  const [km, setKm] = useState<string>(vehicle?.current_km != null ? String(vehicle.current_km) : "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [note, setNote] = useState("");
  const [planKey, setPlanKey] = useState<string>("default");
  const [customKm, setCustomKm] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const requestIdRef = useRef<string | null>(null);

  // Nihai UX: servis ekranıyla aynı işlem ızgarası (items yalnız etiket için).
  const selectedKeys = GRID_ITEMS.filter((it) => selected[it.key]).map((it) => it.key);

  function intervalFor(key: string): number | null {
    const existing = maintenanceItems.find((m: any) => m.item_key === key);
    if (existing?.interval_km) return Number(existing.interval_km);
    return defaultIntervals[key] ?? null;
  }

  // Servis hızlı kaydıyla aynı plan kuralı: Otomatik = +10.000 km / 12 ay,
  // seçilen işlemin daha kısa periyodu varsa o kazanır.
  function planFor(kmNum: number) {
    const selIntervals: Record<string, string> = {};
    for (const k of selectedKeys) {
      const iv = intervalFor(k);
      if (iv) selIntervals[k] = String(iv);
    }
    return resolveQuickPlan({ planKey, currentKm: kmNum, today: todayIsoIstanbul(), selectedItemIntervals: selIntervals, customNextKm: customKm, customNextDate: customDate });
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

    const plan = planFor(kmNum);
    if (plan.error) {
      setError(plan.error);
      return;
    }

    setSaving(true);
    try {
      // 2026-09-24: tek transaction (record_service_visit RPC); hata olursa
      // hiçbir şey yazılmaz, aynı istek kimliğiyle tekrar gönderim ikinci
      // kayıt üretmez. Kullanıcı kaydı (tenant_id=null) veritabanında belirlenir.
      if (!requestIdRef.current) {
        requestIdRef.current =
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
      }
      const labels = selectedKeys.map((k) => items.find((it) => it.key === k)?.label ?? ITEM_LABELS[k] ?? k);
      if (otherOn && otherText.trim()) labels.push(otherText.trim());
      const noteText = note.trim().replace(/\s+/g, " ").slice(0, 200);
      const { error: rpcError } = await supabase.rpc("record_service_visit", {
        p_vehicle_id: vehicle.id,
        p_km: kmNum,
        p_items: selectedKeys.map((k) => ({ key: k, interval_km: intervalFor(k) })),
        p_description: labels.join(", ") + (noteText ? ` — Not: ${noteText}` : ""),
        p_next_km: plan.nextServiceKm,
        p_next_date: plan.nextServiceDate,
        p_request_id: requestIdRef.current,
      });
      if (rpcError) {
        const msg = String(rpcError.message || "");
        setError(
          msg.includes("km_lower_than_current")
            ? "Kilometre, kayıtlı son kilometreden düşük olamaz."
            : "Kayıt yapılamadı; hiçbir değişiklik kaydedilmedi. Tekrar deneyin."
        );
        return;
      }
      requestIdRef.current = null;

      await onSaved({ current_km: kmNum, next_service_km: plan.nextServiceKm, next_service_date: plan.nextServiceDate });
      setSelected({});
      setOtherOn(false);
      setOtherText("");
      setNote("");
      setSuccess("✓ Bakım kaydedildi");
      setTimeout(() => setSuccess(""), 4000);
      onDone?.();
    } catch {
      setError("Bağlantı hatası. Sayfayı yenileyip geçmişi kontrol edin.");
    } finally {
      setSaving(false);
    }
  }

  const kmNum = Number(km);
  const preview = km && Number.isFinite(kmNum) && kmNum > 0 ? planFor(kmNum) : null;
  let previewText = "Kilometre girin; sonraki bakım otomatik önerilir.";
  if (preview) {
    if (planKey === "later") previewText = "Sonraki bakım planı sonra belirlenecek.";
    else if (preview.error) previewText = preview.error;
    else
      previewText =
        "Sonraki bakım: " +
        [
          preview.nextServiceKm != null ? `${Number(preview.nextServiceKm).toLocaleString("tr-TR")} km` : null,
          preview.nextServiceDate ? new Date(`${preview.nextServiceDate}T12:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : null,
        ]
          .filter(Boolean)
          .join(" · ");
  }

  const body = (
    <>
      <label style={labelStyle} htmlFor="owner-quick-km">Güncel Kilometre</label>
      <CaretSafeInput
        caretChars="digits"
        id="owner-quick-km"
        inputMode="numeric"
        enterKeyHint="done"
        value={km ? Number(km).toLocaleString("tr-TR") : ""}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setKm(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        style={{ ...inputStyle, fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 16 }}
      />

      <div style={{ ...labelStyle, marginBottom: 8 }}>Yapılan İşlemler</div>
      <ItemChipGrid
        selected={selected}
        onToggle={(k) => setSelected((s) => ({ ...s, [k]: !s[k] }))}
        otherOn={otherOn}
        onToggleOther={() => setOtherOn((v) => !v)}
        otherText={otherText}
        onOtherText={setOtherText}
        otherPlaceholder="Ör. Klima gazı dolumu"
      />

      <label style={{ ...labelStyle, marginTop: 16 }} htmlFor="owner-quick-not">
        Not <span style={{ color: colors.textFaint, fontWeight: 500 }}>(isteğe bağlı)</span>
      </label>
      <input
        id="owner-quick-not"
        maxLength={200}
        placeholder="Örn. yetkili serviste yapıldı"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ ...inputStyle, marginBottom: 16 }}
      />

      <div style={{ ...labelStyle, marginBottom: 8 }}>Sonraki Bakım</div>
      <div role="radiogroup" aria-label="Sonraki bakım" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {NEXT_PLAN_OPTIONS.map((opt: any) => {
          const on = planKey === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlanKey(opt.key)}
              style={{ padding: "8px 14px", borderRadius: radius.pill, border: `1px solid ${on ? colors.green : colors.border}`, background: on ? colors.greenSoft : colors.surfaceRaised, color: on ? colors.greenLight : colors.text, fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 44, fontFamily: "inherit" }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {planKey === "custom" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="owner-quick-next-km" style={{ fontSize: 12, color: colors.textMuted }}>Sonraki bakım (km)</label>
            <CaretSafeInput
              caretChars="digits"
              id="owner-quick-next-km"
              inputMode="numeric"
              value={customKm ? Number(customKm).toLocaleString("tr-TR") : ""}
              onChange={(e) => setCustomKm(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
              placeholder="Örn. 95.000"
              style={{ ...inputStyle, fontWeight: 800 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="owner-quick-next-date" style={{ fontSize: 12, color: colors.textMuted }}>Sonraki bakım (tarih)</label>
            <input id="owner-quick-next-date" type="date" min={todayIsoIstanbul()} value={customDate} onChange={(e) => setCustomDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}
      <p data-testid="bireysel-plan-onizleme" style={{ fontSize: 14.5, fontWeight: 700, color: preview && preview.error && planKey !== "later" ? colors.danger : preview ? colors.text : colors.textMuted, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "12px 14px", margin: "4px 0 16px" }}>
        {previewText}
      </p>

      {error && <p role="alert" style={{ color: colors.danger, fontSize: 13.5, margin: "0 0 10px" }}>{error}</p>}
      {success && <p role="status" style={{ color: colors.greenLight, fontSize: 13.5, fontWeight: 700, margin: "0 0 10px" }}>{success}</p>}

      <button type="button" onClick={save} disabled={saving} style={primaryButtonStyle(saving)}>
        {saving ? "Kaydediliyor…" : "Bakımı Kaydet"}
      </button>
    </>
  );

  if (bare) return <div id="hizli-bakim">{body}</div>;
  return (
    <section id="hizli-bakim" style={cardStyle}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.textDark, margin: "0 0 12px" }}>Hızlı Bakım Kaydı</h2>
      {body}
    </section>
  );
}
