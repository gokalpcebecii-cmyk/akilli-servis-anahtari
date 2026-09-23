"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, dangerOutlineButtonStyle, badgeStyle, cardStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
import OwnerQuickVisit from "@/components/OwnerQuickVisit";
import OwnerKeychainCard from "@/components/OwnerKeychainCard";

const { validateVehicleInput, computeMaintenancePlan, isValidNextServiceKm, isValidNextServiceDate, describeMaintenancePlan, todayIsoIstanbul } = require("@/lib/logic");

// Yeni araç akışındaki otomatik bakım planı seçenekleri (PILOT FIX 03 madde B).
const PLAN_OPTIONS: { key: string; label: string }[] = [
  { key: "default", label: "+10.000 km / 12 ay" },
  { key: "extended_km", label: "+15.000 km / 12 ay" },
  { key: "extended_months", label: "+10.000 km / 6 ay" },
  { key: "custom", label: "Özel" },
  { key: "later", label: "Bakım planını sonra belirle" },
];

const MAINTENANCE_ITEMS = [
  { key: "motor_yagi", label: "Motor Yağı" },
  { key: "yag_filtresi", label: "Yağ Filtresi" },
  { key: "hava_filtresi", label: "Hava Filtresi" },
  { key: "polen_filtresi", label: "Polen Filtresi" },
  { key: "fren_on_balata", label: "Ön Fren Balatası" },
  { key: "fren_arka_balata", label: "Arka Fren Balatası" },
  { key: "triger_seti", label: "Triger Seti" },
  { key: "aku", label: "Akü" },
  { key: "lastik", label: "Lastik" },
  { key: "fren_diski", label: "Fren Diski" },
  { key: "buji", label: "Buji" },
  { key: "silecek", label: "Silecek" },
];
// Eski/tek parça fren kaydı: geriye dönük uyumluluk için yalnızca gerçekten
// kayıtlı olduğu araçlarda gösterilir, yeni kayıtlar için sunulmaz.
const LEGACY_ITEM = { key: "fren_disk_balata", label: "Fren Disk-Balata" };

const PRESET_KM_OPTIONS = [5000, 10000, 15000, 20000, 30000];

// PILOT FIX 03 (bölüm D): "en sık" 6 işlem — varsayılan kompakt görünümde
// tek dokunuşla eklenebilir. Kalan 3 madde + periyot ayarları "Tüm işlemler"
// açılımında.
const TOP_QUICK_ITEMS = MAINTENANCE_ITEMS.slice(0, 6);

// Bir işlem daha önce hiç periyot almadıysa tek dokunuşla eklemede
// kullanılacak makul varsayılan (madde D: "varsayılan periyotla tek
// dokunuşla ekleme").
const DEFAULT_ITEM_INTERVALS: Record<string, number> = {
  motor_yagi: 10000,
  yag_filtresi: 10000,
  hava_filtresi: 15000,
  polen_filtresi: 15000,
  fren_on_balata: 20000,
  fren_arka_balata: 20000,
  triger_seti: 60000,
  aku: 30000,
  lastik: 40000,
  fren_diski: 60000,
  buji: 30000,
  silecek: 20000,
};

// Kilometre input'ları için: yalnızca rakam, baştaki gereksiz sıfırlar
// temizlenir (örn. "052430" yazılamaz). Negatif değer zaten mümkün değil
// çünkü "-" karakteri rakam olmadığı için süzülüyor.
// 2026-09-23: km alanları yazarken binlik ayraçla gösterilir (120.500);
// state'te yalnız rakamlar tutulur (sanitizeKmInput).
function formatKmInput(v: any) {
  const d = String(v ?? "").replace(/\D/g, "");
  return d ? Number(d).toLocaleString("tr-TR") : "";
}

function sanitizeKmInput(raw: string) {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  return digitsOnly.replace(/^0+(?=\d)/, "");
}

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
    isNew ? { plate: "", brand: "", model: "", year: "", current_km: "", next_service_km: "", next_service_date: "", notes: "" } : null
  );
  const [records, setRecords] = useState<any[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<any[]>([]);
  const [intervalInputs, setIntervalInputs] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrRevokedAt, setQrRevokedAt] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  // PILOT FIX 03 (bölüm F): büyük taranabilir QR artık varsayılan açık
  // görünmüyor — "QR'ı Göster" açık eylemiyle ortaya çıkıyor.
  const [qrRevealed, setQrRevealed] = useState(false);
  const [newRecord, setNewRecord] = useState({ description: "", km_at_service: "", cost: "" });
  const [recordError, setRecordError] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  // PILOT FIX 03 (madde A5): hızlı bireysel parça kaydından sonra 5-10 sn
  // "Geri al" penceresi — yanlışlıkla eklenen kaydı geri almak için.
  const [quickUndo, setQuickUndo] = useState<{ recordId: string; itemKey: string; label: string; previousItem: any | null } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const [savingInterval, setSavingInterval] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState(isNew);
  // PILOT FIX 03: alan bazlı form hataları + çift-submit koruması.
  // fieldErrors state React re-render'ı bekler; savingRef senkron olduğu
  // için hızlı çift tıklama/Enter+click ile bile ikinci çağrı ilk render
  // tamamlanmadan da engellenir.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const [planType, setPlanType] = useState<"default" | "extended_km" | "extended_months" | "custom" | "later">("default");
  const [activeTab, setActiveTab] = useState<"genel" | "gecmis" | "belgeler">("genel");
  // Genel Bakış'ın kısa/özet kalması için parça hızlı-ekle formu varsayılan
  // olarak kapalı — yalnızca ilgili özet satırına (veya #parca hash'ine)
  // tıklandığında açılır. Business logic/handler'lar değişmedi, yalnızca
  // görünürlük durumu eklendi.
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  // PILOT FIX 03 (bölüm D): varsayılan görünümde arama + en sık 6 işlem
  // kompakt tek-dokunuş düğmesi; tüm liste + periyot ayarları ayrı açılım.
  const [quickSearch, setQuickSearch] = useState("");
  const [showAllQuickItems, setShowAllQuickItems] = useState(false);

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
      setNotesDraft(v.notes || "");
      // Serbest bakım kaydı km alanı, aracın güncel kilometresinden
      // otomatik dolar ve düzenlenebilir kalır (madde D).
      if (v?.current_km != null) setNewRecord((prev) => ({ ...prev, km_at_service: String(v.current_km) }));

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

      // 04A-S takip turu: bayrak kapalıyken loadQr() içine hiç girilmez —
      // fonksiyonun kendisinde de aynı kontrol var (savunma derinliği),
      // ama çağrı noktasında atlamak qr_keys'e giden isteği baştan yok eder.
      if (PILOT_FLAGS.qrSelfIssuance) {
        await loadQr(params.id as string);
      }

      setLoading(false);

      const hash = window.location.hash.slice(1);
      if (hash) {
        if (hash === "servis-gecmisi") setActiveTab("gecmis");
        else if (hash === "muayene" || hash === "qr") setActiveTab("belgeler");
        else setActiveTab("genel");
        if (hash === "parca") setShowQuickEntry(true);
        window.setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    }
    init();
  }, [params.id]);

  async function loadQr(vehicleId: string) {
    // Savunma derinliği: çağrı noktası zaten bayrağı kontrol ediyor, ama
    // bu fonksiyon başka bir yerden (ör. handleRevokeQr/handleIssueNewQr)
    // çağrılırsa da qr_keys'e HİÇBİR istek (SELECT dahil) gitmemeli.
    if (!PILOT_FLAGS.qrSelfIssuance) {
      setQrCode(null);
      setQrRevokedAt(null);
      setQrDataUrl(null);
      return;
    }

    let { data: qrKey } = await supabase
      .from("qr_keys")
      .select("code, revoked_at")
      .eq("vehicle_id", vehicleId)
      .is("revoked_at", null)
      .maybeSingle();

    if (!qrKey) {
      const code = generateCode();
      const { data: created } = await supabase
        .from("qr_keys")
        .insert({ code, vehicle_id: vehicleId, assigned_at: new Date().toISOString() })
        .select("code, revoked_at")
        .single();
      qrKey = created;
    }

    if (qrKey) {
      setQrCode(qrKey.code);
      setQrRevokedAt(qrKey.revoked_at);
      const publicUrl = `${window.location.origin}/p/${qrKey.code}`;
      const qr = await QRCode.toDataURL(publicUrl, { width: 220 });
      setQrDataUrl(qr);
    }
  }

  async function handleRevokeQr() {
    if (!PILOT_FLAGS.qrSelfIssuance) return;
    if (!qrCode) return;
    if (!confirm("Bu QR/NFC kodunu iptal etmek istediğinize emin misiniz? İptal edilen kod bir daha kullanılamaz.")) return;
    setQrBusy(true);
    await supabase.from("qr_keys").update({ revoked_at: new Date().toISOString() }).eq("code", qrCode);
    await loadQr(params.id as string);
    setQrBusy(false);
  }

  async function handleIssueNewQr() {
    if (!PILOT_FLAGS.qrSelfIssuance) return;
    setQrBusy(true);
    await loadQr(params.id as string);
    setQrBusy(false);
  }

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

  function focusFirstError(errors: Record<string, string>) {
    const order = ["plate", "brand", "model", "year", "current_km", "next_service_km", "next_service_date"];
    const firstKey = order.find((k) => errors[k]);
    if (firstKey) {
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.focus();
      }, 0);
    }
  }

  async function handleSaveVehicle() {
    // Çift tıklama / Enter+click / yavaş ağda tek mantıksal kayıt (madde A5).
    // ref senkron olduğu için setSaving(true)'nin re-render'ını beklemeden
    // aynı anda gelen ikinci çağrıyı da engeller.
    if (savingRef.current) return;

    const { valid, errors, normalized } = validateVehicleInput({
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      current_km: vehicle.current_km,
    });

    // Düzenleme akışında (isNew=false) VEYA yeni araçta "Özel" plan
    // seçiliyken manuel next_service_km/next_service_date alanları
    // görünür ve doğrudan doğrulanır — sunucuyla birebir aynı kontrol.
    const manualNextFieldsVisible = !isNew || planType === "custom";
    if (
      manualNextFieldsVisible &&
      vehicle.next_service_km !== "" &&
      vehicle.next_service_km != null &&
      !isValidNextServiceKm(normalized.current_km, Number(vehicle.next_service_km))
    ) {
      errors.next_service_km = "Sonraki bakım kilometresi, güncel kilometreden büyük olmalı.";
    }
    if (manualNextFieldsVisible && vehicle.next_service_date && !isValidNextServiceDate(vehicle.next_service_date)) {
      errors.next_service_date = "Sonraki bakım tarihi geçmişte olamaz.";
    }

    if (!valid || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError(errors);
      return; // Geçersiz istekte hiçbir yan etki (araç/QR/audit) oluşmaz.
    }
    setFieldErrors({});

    // Düzenleme akışında (isNew=false) BAKIM PLANI YENİDEN HESAPLANMAZ —
    // pilot bugfix turu: mevcut next_service_km/next_service_date değerleri
    // kullanıcı açıkça değiştirmedikçe AYNEN korunmalı, "+10.000 km / 12 ay"
    // varsayılan planı düzenlemede sessizce yeniden uygulanmamalı. planType
    // düzenleme ekranında hiç değiştirilmediği (varsayılan "default" kaldığı)
    // için computeMaintenancePlan burada ÇAĞRILMAZ — yalnızca YENİ araç
    // oluştururken kullanılır.
    const plan = isNew
      ? computeMaintenancePlan({
          currentKm: normalized.current_km,
          planType,
          customNextKm: vehicle.next_service_km,
          customNextDate: vehicle.next_service_date,
        })
      : null;

    savingRef.current = true;
    setSaving(true);

    if (isNew) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      let json: any = {};
      try {
        const res = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            current_km: vehicle.current_km,
            next_service_km: plan.nextServiceKm,
            next_service_date: plan.nextServiceDate,
          }),
        });
        json = await res.json();
        if (!res.ok) {
          savingRef.current = false;
          setSaving(false);
          if (res.status === 401) {
            alert("Oturumunuz sona ermiş. Lütfen tekrar giriş yapın; girdiğiniz bilgiler kaydedilmedi.");
            await supabase.auth.signOut({ scope: "local" });
            window.location.replace("/bireysel/giris?oturum=bitti");
            return;
          }
          if (json.errors) {
            setFieldErrors(json.errors);
            focusFirstError(json.errors);
          } else {
            alert(json.error || "Kaydedilemedi.");
          }
          return;
        }
      } catch {
        savingRef.current = false;
        setSaving(false);
        alert("Bağlantı hatası. Lütfen tekrar deneyin.");
        return;
      }
      router.push(`/bireysel/araclar/${json.vehicle.id}`);
    } else {
      // Form alanlarında NE varsa (kullanıcı değiştirmediyse mevcut,
      // değiştirdiyse yeni girilen) BİREBİR O yazılır — plan.nextServiceKm/
      // nextServiceDate DEĞİL (yukarıda zaten hesaplanmadı, isNew=false).
      const nextServiceKmValue = vehicle.next_service_km === "" || vehicle.next_service_km == null ? null : Number(vehicle.next_service_km);
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({
          plate: normalized.plate,
          brand: normalized.brand,
          model: normalized.model,
          year: normalized.year,
          current_km: normalized.current_km,
          next_service_km: nextServiceKmValue,
          next_service_date: vehicle.next_service_date || null,
          notes: vehicle.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      savingRef.current = false;
      setSaving(false);

      if (updateError) {
        // Kayıt hatası: düzenleme ekranı AÇIK kalır, başarı izlenimi
        // VERİLMEZ — kullanıcı ikinci kez göndermeden önce yenileyip
        // kontrol etmeye yönlendirilir.
        alert("Kaydedilemedi. Lütfen sayfayı yenileyip tekrar deneyin; ikinci kez göndermeden önce kayıt bilgilerini kontrol edin.");
        return;
      }

      setEditingVehicle(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await supabase.from("vehicles").update({ notes: notesDraft, updated_at: new Date().toISOString() }).eq("id", params.id);
    setVehicle((prev: any) => ({ ...prev, notes: notesDraft }));
    setSavingNotes(false);
    setNotesSaved(true);
    window.setTimeout(() => setNotesSaved(false), 2500);
  }

  async function handleQuickMaintenance(itemKey: string, label: string) {
    setSavingItem(itemKey);
    const today = todayIsoIstanbul();
    const existingInterval = intervalInputs[itemKey];
    // Kullanıcı hiç periyot seçmediyse makul varsayılan otomatik atanır.
    const intervalKm = existingInterval ? Number(existingInterval) : DEFAULT_ITEM_INTERVALS[itemKey] ?? null;
    const previousItem = maintenanceItems.find((m: any) => m.item_key === itemKey) ?? null;

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

    const { data: insertedRecord } = await supabase
      .from("maintenance_records")
      .insert({
        vehicle_id: params.id,
        tenant_id: null,
        description: label,
        km_at_service: vehicle.current_km,
        created_by: userId,
      })
      .select()
      .single();

    await refreshMaintenanceItems();
    await refreshRecords();
    setSavingItem(null);

    if (insertedRecord) {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      setQuickUndo({ recordId: insertedRecord.id, itemKey, label, previousItem });
      undoTimerRef.current = window.setTimeout(() => setQuickUndo(null), 8000);
    }
  }

  async function handleUndoQuickMaintenance() {
    if (!quickUndo) return;
    const { recordId, itemKey, previousItem } = quickUndo;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setQuickUndo(null);

    await supabase.from("maintenance_records").delete().eq("id", recordId);
    if (previousItem) {
      await supabase.from("maintenance_items").upsert(
        {
          vehicle_id: params.id,
          item_key: itemKey,
          last_service_date: previousItem.last_service_date,
          last_service_km: previousItem.last_service_km,
          interval_km: previousItem.interval_km,
        },
        { onConflict: "vehicle_id,item_key" }
      );
    } else {
      await supabase.from("maintenance_items").delete().eq("vehicle_id", params.id).eq("item_key", itemKey);
    }
    await refreshMaintenanceItems();
    await refreshRecords();
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
    // PILOT FIX 03 (bölüm D): boş formda sessiz başarısızlık yerine
    // alan bazlı hata.
    if (!newRecord.description.trim()) {
      setRecordError("Lütfen ne yapıldığını kısaca yazın.");
      return;
    }
    setRecordError("");

    const enteredKm = newRecord.km_at_service ? Number(newRecord.km_at_service) : null;

    await supabase.from("maintenance_records").insert({
      vehicle_id: params.id,
      tenant_id: null,
      description: newRecord.description.trim(),
      km_at_service: enteredKm,
      cost: newRecord.cost ? Number(newRecord.cost) : null,
      created_by: userId,
    });

    // Daha yüksek km kaydı aracın güncel kilometresini yükseltebilir;
    // geçmişe dönük daha düşük bir kayıt güncel km'yi ASLA düşürmez.
    const raisedKm = enteredKm != null && enteredKm > (vehicle.current_km ?? 0);
    if (raisedKm) {
      await supabase.from("vehicles").update({ current_km: enteredKm, updated_at: new Date().toISOString() }).eq("id", params.id);
      setVehicle((prev: any) => ({ ...prev, current_km: enteredKm }));
    }

    await refreshRecords();
    const nextKm = raisedKm ? enteredKm : vehicle.current_km;
    setNewRecord({ description: "", km_at_service: nextKm != null ? String(nextKm) : "", cost: "" });
  }

  if (loading || !vehicle) return <main style={{ padding: 24, fontFamily: font, color: colors.textMuted }}>Yükleniyor…</main>;

  // "Sonraki bakım" için geçmiş tarih seçilemesin diye native date input'un min'i.
  const todayIso = todayIsoIstanbul();

  function getUpcomingStatus(itemKey: string) {
    const item = maintenanceItems.find((m) => m.item_key === itemKey);
    if (!item || !item.last_service_date) return null;
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
    if (!hasInterval) return null;
    if (overdue) return { label: "İşlem Zamanı", kind: "danger" as const };
    if (upcoming) return { label: "Yaklaşıyor", kind: "warning" as const };
    return { label: "Normal", kind: "success" as const };
  }

  function getItemStatus(itemKey: string) {
    const item = maintenanceItems.find((m) => m.item_key === itemKey);
    if (!item || !item.last_service_date) return null;
    const isToday = item.last_service_date === todayIsoIstanbul();
    return { date: item.last_service_date, isToday };
  }

  // "Kilometre Kayıtları": ayrı bir tablo eklemeden, km bilgisi taşıyan
  // mevcut bakım kayıtlarından türetilen kronolojik bir km listesi.
  const kmTimeline = records.filter((r) => r.km_at_service != null);

  // Genel Bakış özet satırları — hepsi gerçek, zaten yüklenmiş veriden
  // türetilir; yeni bir sorgu veya iş mantığı eklenmez.
  const trackedPartsCount = maintenanceItems.filter((m) => m.last_service_date).length;
  const nextUpcoming = [...MAINTENANCE_ITEMS, LEGACY_ITEM]
    .map((item) => ({ item, status: getUpcomingStatus(item.key) }))
    .find((x) => x.status && (x.status.kind === "danger" || x.status.kind === "warning"));
  const summaryRows: { icon: string; title: string; meta: string; tab: "genel" | "gecmis" | "belgeler"; hash?: string }[] = [
    { icon: "history", title: "Servis Geçmişi", meta: `${records.length} kayıt`, tab: "gecmis" },
    { icon: "wrench", title: "Parça Değişimleri", meta: `${trackedPartsCount} kayıt`, tab: "genel", hash: "parca" },
    {
      icon: "clipboard",
      title: "Muayene Bilgileri",
      meta: vehicle.muayene_tarihi ? `Son: ${new Date(vehicle.muayene_tarihi).toLocaleDateString("tr-TR")}` : "Bilgi yok",
      tab: "belgeler",
    },
    { icon: "qr", title: "QR / NFC", meta: qrRevokedAt ? "İptal Edildi" : qrCode ? "Aktif" : "—", tab: "belgeler" },
    { icon: "user", title: "Sahiplik Bilgileri", meta: "1. sahip (Siz)", tab: "genel", hash: "devir" },
    {
      icon: "bell",
      title: "Yaklaşan Bakım",
      // PILOT FIX 03 (madde A4): parça bazlı acil durum varsa o öncelikli;
      // yoksa aracın KENDİ sonraki bakım planı (next_service_km/_date)
      // burada da dikkate alınır — aksi halde bu satır "Planlı bakım yok"
      // derken hemen altında "Sonraki bakım: 62.430 km" görünebiliyordu
      // (aynı ekranda birbirini yalanlayan iki farklı sinyal, canlı testte
      // bulunan hata). Artık ikisi de describeMaintenancePlan/tek kaynaktan.
      meta: nextUpcoming
        ? nextUpcoming.status!.label
        : describeMaintenancePlan({ nextServiceKm: vehicle.next_service_km, nextServiceDate: vehicle.next_service_date }).label,
      tab: "genel",
      hash: "parca",
    },
  ];

  function goToSummaryRow(row: (typeof summaryRows)[number]) {
    setActiveTab(row.tab);
    if (row.hash === "parca") setShowQuickEntry(true);
    if (row.hash) {
      window.setTimeout(() => document.getElementById(row.hash!)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, paddingBottom: 60 }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, padding: "20px 18px 26px" }}>
        <div className="otoiz-vehicle-shell" style={{ maxWidth: 560, margin: "0 auto" }}>
          <a href="/bireysel/araclar" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44, paddingRight: 12 }}>
            ← Araçlarım
          </a>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
            <div>
              <OtoizLogo variant="dark" size={158} />
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0.8, color: colors.textLight, margin: "8px 0 0" }}>
                {isNew ? "Yeni Araç" : vehicle.plate}
              </h1>
              {!isNew && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                    {vehicle.brand} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
                  </span>
                  {vehicle.current_km != null && vehicle.current_km !== "" && (
                    <span style={{ fontSize: 18, fontWeight: 900, color: colors.green }}>
                      {Number(vehicle.current_km).toLocaleString("tr-TR")} <span style={{ fontSize: 12, fontWeight: 700 }}>km</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            {!isNew && (
              <button
                onClick={() => setEditingVehicle((v) => !v)}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", color: colors.textLight, fontSize: 12.5, cursor: "pointer", padding: "8px 12px", minHeight: 44, borderRadius: radius.sm }}
              >
                {editingVehicle ? "Kapat" : "Düzenle"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="otoiz-vehicle-shell" style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        {(isNew || editingVehicle) && (
          <section style={cardStyle}>
            <label style={labelStyle}>Plaka</label>
            <input
              data-field="plate"
              aria-describedby={fieldErrors.plate ? "err-plate" : undefined}
              aria-invalid={!!fieldErrors.plate}
              style={{ ...inputStyle, marginBottom: fieldErrors.plate ? 4 : 10, borderColor: fieldErrors.plate ? colors.danger : colors.border }}
              value={vehicle.plate}
              onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
            />
            {fieldErrors.plate && (
              <p id="err-plate" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                {fieldErrors.plate}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Marka</label>
                <input
                  data-field="brand"
                  aria-describedby={fieldErrors.brand ? "err-brand" : undefined}
                  aria-invalid={!!fieldErrors.brand}
                  style={{ ...inputStyle, marginBottom: fieldErrors.brand ? 4 : 10, borderColor: fieldErrors.brand ? colors.danger : colors.border }}
                  value={vehicle.brand || ""}
                  onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                />
                {fieldErrors.brand && (
                  <p id="err-brand" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                    {fieldErrors.brand}
                  </p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Model</label>
                <input
                  data-field="model"
                  aria-describedby={fieldErrors.model ? "err-model" : undefined}
                  aria-invalid={!!fieldErrors.model}
                  style={{ ...inputStyle, marginBottom: fieldErrors.model ? 4 : 10, borderColor: fieldErrors.model ? colors.danger : colors.border }}
                  value={vehicle.model || ""}
                  onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                />
                {fieldErrors.model && (
                  <p id="err-model" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                    {fieldErrors.model}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Model Yılı</label>
                <input
                  data-field="year"
                  type="number"
                  aria-describedby={fieldErrors.year ? "err-year" : undefined}
                  aria-invalid={!!fieldErrors.year}
                  style={{ ...inputStyle, marginBottom: fieldErrors.year ? 4 : 10, borderColor: fieldErrors.year ? colors.danger : colors.border }}
                  value={vehicle.year || ""}
                  onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                />
                {fieldErrors.year && (
                  <p id="err-year" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                    {fieldErrors.year}
                  </p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Güncel Kilometre</label>
                <input
                  data-field="current_km"
                  type="text"
                  inputMode="numeric"
                 
                  placeholder="Örn. 52430"
                  aria-describedby={fieldErrors.current_km ? "err-current_km" : undefined}
                  aria-invalid={!!fieldErrors.current_km}
                  style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3, marginBottom: fieldErrors.current_km ? 4 : 10, borderColor: fieldErrors.current_km ? colors.danger : colors.border }}
                  value={formatKmInput(vehicle.current_km)}
                  onChange={(e) => setVehicle({ ...vehicle, current_km: sanitizeKmInput(e.target.value) })}
                />
                {fieldErrors.current_km && (
                  <p id="err-current_km" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                    {fieldErrors.current_km}
                  </p>
                )}
              </div>
            </div>

            {isNew ? (
              // PILOT FIX 03 madde B: yeni araç akışında bakım planı elle
              // km/tarih yazılarak değil, otomatik seçenek çipleriyle
              // belirlenir — normal senaryoda klavye hiç açılmaz.
              <>
                <label style={labelStyle}>Bakım Planı</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {PLAN_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPlanType(opt.key as typeof planType)}
                      aria-pressed={planType === opt.key}
                      style={{
                        padding: "9px 14px",
                        borderRadius: radius.pill,
                        border: planType === opt.key ? `1.5px solid ${colors.greenDark}` : `1px solid ${colors.border}`,
                        background: planType === opt.key ? colors.greenSoft : colors.surfaceLight,
                        color: planType === opt.key ? colors.greenDark : colors.textDark,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        minHeight: 44,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {planType !== "custom" && planType !== "later" && vehicle.current_km !== "" && !Number.isNaN(Number(vehicle.current_km)) && (
                  <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 14px" }}>
                    {Number(vehicle.current_km).toLocaleString("tr-TR")} km → Sonraki bakım{" "}
                    {(() => {
                      const plan = computeMaintenancePlan({ currentKm: Number(vehicle.current_km), planType });
                      return `${plan.nextServiceKm!.toLocaleString("tr-TR")} km • ${new Date(plan.nextServiceDate!).toLocaleDateString("tr-TR")}`;
                    })()}
                  </p>
                )}
                {planType === "later" && <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 14px" }}>Bakım planı sonra belirlenecek.</p>}
                {planType === "custom" && (
                  <>
                    <label style={labelStyle}>Sonraki Bakım (km)</label>
                    <input
                      data-field="next_service_km"
                      type="text"
                      inputMode="numeric"
                     
                      placeholder="Opsiyonel"
                      aria-describedby={fieldErrors.next_service_km ? "err-next-km" : undefined}
                      aria-invalid={!!fieldErrors.next_service_km}
                      style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3, marginBottom: fieldErrors.next_service_km ? 4 : 10, borderColor: fieldErrors.next_service_km ? colors.danger : colors.border }}
                      value={formatKmInput(vehicle.next_service_km || "")}
                      onChange={(e) => setVehicle({ ...vehicle, next_service_km: sanitizeKmInput(e.target.value) })}
                    />
                    {fieldErrors.next_service_km && (
                      <p id="err-next-km" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                        {fieldErrors.next_service_km}
                      </p>
                    )}
                    <label style={labelStyle}>Sonraki Bakım (tarih)</label>
                    <input
                      data-field="next_service_date"
                      type="date"
                      min={todayIso}
                      aria-describedby={fieldErrors.next_service_date ? "err-next-date" : undefined}
                      aria-invalid={!!fieldErrors.next_service_date}
                      style={{ ...inputStyle, marginBottom: fieldErrors.next_service_date ? 4 : 16, borderColor: fieldErrors.next_service_date ? colors.danger : colors.border }}
                      value={vehicle.next_service_date || ""}
                      onChange={(e) => setVehicle({ ...vehicle, next_service_date: e.target.value })}
                    />
                    {fieldErrors.next_service_date && (
                      <p id="err-next-date" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                        {fieldErrors.next_service_date}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <label style={labelStyle}>Sonraki Bakım (km)</label>
                <input
                  data-field="next_service_km"
                  type="text"
                  inputMode="numeric"
                 
                  placeholder="Opsiyonel"
                  aria-describedby={fieldErrors.next_service_km ? "err-next-km" : undefined}
                  aria-invalid={!!fieldErrors.next_service_km}
                  style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3, marginBottom: fieldErrors.next_service_km ? 4 : 10, borderColor: fieldErrors.next_service_km ? colors.danger : colors.border }}
                  value={formatKmInput(vehicle.next_service_km || "")}
                  onChange={(e) => setVehicle({ ...vehicle, next_service_km: sanitizeKmInput(e.target.value) })}
                />
                {fieldErrors.next_service_km && (
                  <p id="err-next-km" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                    {fieldErrors.next_service_km}
                  </p>
                )}
                <label style={labelStyle}>Sonraki Bakım (tarih)</label>
                <input
                  data-field="next_service_date"
                  type="date"
                  min={todayIso}
                  aria-describedby={fieldErrors.next_service_date ? "err-next-date" : undefined}
                  aria-invalid={!!fieldErrors.next_service_date}
                  style={{ ...inputStyle, marginBottom: fieldErrors.next_service_date ? 4 : 16, borderColor: fieldErrors.next_service_date ? colors.danger : colors.border }}
                  value={vehicle.next_service_date || ""}
                  onChange={(e) => setVehicle({ ...vehicle, next_service_date: e.target.value })}
                />
                {fieldErrors.next_service_date && (
                  <p id="err-next-date" role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>
                    {fieldErrors.next_service_date}
                  </p>
                )}
              </>
            )}

            <button onClick={handleSaveVehicle} disabled={saving} style={primaryButtonStyle(saving)}>
              {saving ? "Kaydediliyor…" : isNew ? "Aracı Oluştur" : "Kaydet"}
            </button>
          </section>
        )}

        {!isNew && (
          <>
            <nav style={{ display: "flex", gap: 4, background: colors.surfaceLight, borderRadius: radius.md, padding: 4, border: `1px solid ${colors.border}` }}>
              {(
                [
                  { key: "genel", label: "Genel Bakış" },
                  { key: "gecmis", label: "Geçmiş" },
                  { key: "belgeler", label: "Belgeler" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: radius.sm, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, fontFamily: font, minHeight: 40,
                    background: activeTab === t.key ? colors.greenDark : "transparent",
                    color: activeTab === t.key ? colors.textLight : colors.textMuted,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {activeTab === "genel" && (
              <section style={cardStyle}>
                <SectionHeader icon="clipboard" title="Genel Bakış" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>GÜNCEL KİLOMETRE</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: colors.textDark, letterSpacing: 0.2 }}>
                      {vehicle.current_km != null ? Number(vehicle.current_km).toLocaleString("tr-TR") : "—"}
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginLeft: 4 }}>km</span>
                    </div>
                  </div>
                  <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>PASAPORT DURUMU</div>
                    <span style={badgeStyle(qrRevokedAt ? "danger" : "success")}>{qrRevokedAt ? "Pasif" : "Aktif"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {summaryRows.map((row) => (
                    <button
                      key={row.title}
                      onClick={() => goToSummaryRow(row)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, background: "none", border: "none",
                        borderBottom: `1px solid ${colors.border}`, padding: "12px 2px", cursor: "pointer",
                        fontFamily: font, textAlign: "left", width: "100%", minHeight: 44,
                      }}
                    >
                      <div style={{ width: 34, height: 34, minWidth: 34, borderRadius: "50%", background: "#E6FAEE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={row.icon} color={colors.greenDark} size={16} />
                      </div>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: colors.textDark }}>{row.title}</span>
                      <span style={{ fontSize: 12, color: colors.textMuted }}>{row.meta}</span>
                      <Icon name="chevron-right" color={colors.textMuted} size={16} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 2026-09-23: bireysel satış — servis panelindeki gibi hızlı bakım
                kaydı ve yöneticinin tanımladığı QR anahtarlığı bağlama. */}
            {!isNew && vehicle?.id && (
              <div style={{ display: activeTab === "genel" ? "flex" : "none", flexDirection: "column", gap: 16 }}>
                <OwnerQuickVisit
                  vehicle={vehicle}
                  userId={userId}
                  items={MAINTENANCE_ITEMS}
                  defaultIntervals={DEFAULT_ITEM_INTERVALS}
                  maintenanceItems={maintenanceItems}
                  onSaved={async (u) => {
                    setVehicle((prev: any) => ({ ...prev, ...u }));
                    await refreshMaintenanceItems();
                    await refreshRecords();
                  }}
                />
                <OwnerKeychainCard vehicleId={vehicle.id} />
              </div>
            )}

            <section id="parca" style={{ ...cardStyle, display: activeTab === "genel" ? "block" : "none" }}>
              <SectionHeader icon="wrench" title="Bakım Durumu Özeti" />
              {/* describeMaintenancePlan: tek kaynak — bu satırla üstteki
                  "Yaklaşan Bakım" özet satırı hiçbir zaman birbirini
                  yalanlamaz (bkz. madde A4 yorum notu). */}
              {describeMaintenancePlan({ nextServiceKm: vehicle.next_service_km, nextServiceDate: vehicle.next_service_date }).hasPlan && (
                <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: colors.textDark }}>
                  Sonraki bakım:{" "}
                  {describeMaintenancePlan({ nextServiceKm: vehicle.next_service_km, nextServiceDate: vehicle.next_service_date }).label}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                {[...MAINTENANCE_ITEMS, ...(maintenanceItems.some((m: any) => m.item_key === LEGACY_ITEM.key) ? [LEGACY_ITEM] : [])].map((item) => {
                  const s = getUpcomingStatus(item.key);
                  if (!s) return null;
                  return (
                    <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: colors.surfaceSoft, borderRadius: radius.sm, padding: "8px 12px" }}>
                      <span style={{ fontSize: 13, color: colors.textDark }}>{item.label}</span>
                      <span style={badgeStyle(s.kind)}>{s.label}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowQuickEntry((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  background: colors.surfaceSoft, border: "none", borderRadius: radius.sm, padding: "12px 14px",
                  cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700, color: colors.textDark, minHeight: 44,
                }}
              >
                Parça Değişimleri — Hızlı Ekle
                <Icon name={showQuickEntry ? "chevron-up" : "chevron-down"} color={colors.textMuted} size={16} />
              </button>

              {quickUndo && (
                <div
                  role="status"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    background: colors.greenSoft, borderRadius: radius.sm, padding: "10px 14px", marginTop: 10,
                  }}
                >
                  <span style={{ fontSize: 12.5, color: colors.greenDark, fontWeight: 700 }}>✓ {quickUndo.label} eklendi</span>
                  <button
                    type="button"
                    onClick={handleUndoQuickMaintenance}
                    style={{ background: "none", border: "none", color: colors.greenDark, fontWeight: 800, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", minHeight: 32 }}
                  >
                    Geri al
                  </button>
                </div>
              )}

              {showQuickEntry && (
              <>
              <p style={{ fontSize: 12, color: colors.textMuted, margin: "14px 0" }}>
                Kendin yaptıysan ya da başka bir yerde yaptırdıysan butona bas — otomatik bugünün tarihi, güncel km ve varsayılan periyotla kaydedilir.
              </p>

              {/* PILOT FIX 03 (bölüm D): dokuz büyük kart yerine — arama +
                  en sık 6 işlem kompakt tek-dokunuş düğmesi ilk görünümde. */}
              <input
                type="search"
                placeholder="İşlem ara (örn. lastik)"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {(quickSearch ? MAINTENANCE_ITEMS : TOP_QUICK_ITEMS)
                  .filter((item) => item.label.toLocaleLowerCase("tr-TR").includes(quickSearch.toLocaleLowerCase("tr-TR")))
                  .map((item) => {
                    const status = getItemStatus(item.key);
                    const isSaving = savingItem === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleQuickMaintenance(item.key, item.label)}
                        disabled={isSaving}
                        style={{
                          padding: "10px 14px", borderRadius: radius.pill, minHeight: 44,
                          border: status?.isToday ? `1.5px solid ${colors.greenDark}` : `1px solid ${colors.border}`,
                          background: status?.isToday ? colors.greenSoft : colors.surfaceLight,
                          color: status?.isToday ? colors.greenDark : colors.textDark,
                          fontWeight: 700, fontSize: 13, cursor: isSaving ? "wait" : "pointer", fontFamily: "inherit",
                        }}
                      >
                        {isSaving ? "Kaydediliyor…" : item.label}
                        {status?.isToday && " ✓"}
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setShowAllQuickItems((v) => !v)}
                style={{ background: "none", border: "none", color: colors.greenDark, fontWeight: 700, fontSize: 12.5, padding: "4px 0", cursor: "pointer", marginBottom: showAllQuickItems ? 10 : 4 }}
              >
                {showAllQuickItems ? "Tüm işlemler ve periyot ayarları ▲" : "Tüm işlemler ve periyot ayarları ▾"}
              </button>

              {showAllQuickItems && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {MAINTENANCE_ITEMS.filter((item) => item.label.toLocaleLowerCase("tr-TR").includes(quickSearch.toLocaleLowerCase("tr-TR"))).map((item) => {
                  const status = getItemStatus(item.key);
                  const isSaving = savingItem === item.key;
                  const isSavingInterval = savingInterval === item.key;
                  const currentValue = intervalInputs[item.key] ?? "";
                  return (
                    <div
                      key={item.key}
                      style={{
                        padding: "12px 14px",
                        borderRadius: radius.sm,
                        border: status?.isToday ? `2px solid ${colors.greenDark}` : `1px solid ${colors.border}`,
                        background: status?.isToday ? colors.greenSoft : colors.surfaceLight,
                      }}
                    >
                      <button
                        onClick={() => handleQuickMaintenance(item.key, item.label)}
                        disabled={isSaving}
                        style={{
                          width: "100%", textAlign: "left", background: "none", border: "none", minHeight: 32,
                          cursor: isSaving ? "wait" : "pointer",
                          color: status?.isToday ? colors.greenDark : colors.textDark, fontWeight: 700, fontSize: 13.5, padding: 0, marginBottom: 8,
                        }}
                      >
                        <div>{isSaving ? "Kaydediliyor…" : item.label}</div>
                        {status && (
                          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, color: status.isToday ? colors.greenDark : colors.textMuted }}>
                            {status.isToday ? "✓ Bugün yapıldı" : `Son: ${new Date(status.date).toLocaleDateString("tr-TR")}`}
                          </div>
                        )}
                      </button>

                      <div style={{ fontSize: 10.5, color: colors.textMuted, marginBottom: 4 }}>Periyot (km)</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                        {PRESET_KM_OPTIONS.map((preset) => {
                          const isActive = currentValue === String(preset);
                          return (
                            <button
                              key={preset}
                              onClick={() => handlePresetClick(item.key, preset)}
                              disabled={isSavingInterval}
                              style={{
                                padding: "5px 11px", borderRadius: radius.pill,
                                border: isActive ? `1.5px solid ${colors.greenDark}` : `1px solid ${colors.border}`,
                                background: isActive ? colors.greenDark : colors.surfaceLight,
                                color: isActive ? colors.textLight : colors.textMuted,
                                fontSize: 11, fontWeight: 600, cursor: isSavingInterval ? "wait" : "pointer", minHeight: 28,
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
                        style={{ ...inputStyle, padding: "7px 9px", fontSize: 12 }}
                      />
                    </div>
                  );
                })}
              </div>
              )}
              </>
              )}
            </section>

            <section id="kilometre" style={{ ...cardStyle, display: activeTab === "genel" ? "block" : "none" }}>
              <SectionHeader icon="gauge" title="Kilometre Kayıtları" />
              <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "14px", marginBottom: 14, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: colors.textMuted, marginBottom: 2 }}>GÜNCEL KİLOMETRE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: colors.textDark }}>
                  {vehicle.current_km != null ? Number(vehicle.current_km).toLocaleString("tr-TR") : "—"} km
                </div>
              </div>
              {kmTimeline.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.textMuted }}>Henüz km bilgisi içeren bir kayıt yok.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {kmTimeline.slice(0, 8).map((r) => (
                    <li key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
                      <span style={{ color: colors.textMuted }}>{new Date(r.service_date).toLocaleDateString("tr-TR")}</span>
                      <span style={{ fontWeight: 700, color: colors.textDark }}>{Number(r.km_at_service).toLocaleString("tr-TR")} km</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="muayene" style={{ ...cardStyle, display: activeTab === "belgeler" ? "block" : "none" }}>
              <SectionHeader icon="clipboard" title="Muayene Bilgileri" />
              {(vehicle.muayene_tarihi || vehicle.trafik_sigortasi_bitis || vehicle.kasko_bitis) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {vehicle.muayene_tarihi && (
                    <InfoRow label="Muayene Tarihi" value={new Date(vehicle.muayene_tarihi).toLocaleDateString("tr-TR")} />
                  )}
                  {vehicle.trafik_sigortasi_bitis && (
                    <InfoRow label="Trafik Sigortası Bitiş" value={new Date(vehicle.trafik_sigortasi_bitis).toLocaleDateString("tr-TR")} />
                  )}
                  {vehicle.kasko_bitis && (
                    <InfoRow label="Kasko Bitiş" value={new Date(vehicle.kasko_bitis).toLocaleDateString("tr-TR")} />
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
                  Muayene/sigorta tarihleriniz henüz servis kaydına girilmemiş. Yetkili servisiniz bu bilgileri ekleyebilir.
                </p>
              )}
              <p style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
                Ek not eklemek isterseniz (örn. poliçe numarası) aşağıya serbest metin olarak yazabilirsiniz.
              </p>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Örn: Muayene tarihi 05.2027, kasko poliçe no ..."
                rows={3}
                style={{ ...inputStyle, marginBottom: 10, resize: "vertical", fontFamily: font }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={handleSaveNotes} disabled={savingNotes} style={{ ...primaryButtonStyle(savingNotes), width: "auto", padding: "10px 20px" }}>
                  {savingNotes ? "Kaydediliyor…" : "Kaydet"}
                </button>
                {notesSaved && <span style={{ fontSize: 12.5, color: colors.greenDark, fontWeight: 700 }}>✓ Kaydedildi</span>}
              </div>
            </section>

            <section id="qr" className="otoiz-hero-pattern" style={{ ...cardStyle, textAlign: "center", display: activeTab === "belgeler" && PILOT_FLAGS.qrSelfIssuance ? "block" : "none" }}>
              <SectionHeader icon="qr" title="QR / NFC Yönetimi" center />
              <div className="otoiz-accent-line" style={{ margin: "-6px auto 14px" }} />
              {!PILOT_FLAGS.qrSelfIssuance ? (
                <p style={{ fontSize: 12.5, color: colors.textMuted, padding: "12px 0" }}>
                  Bu özellik şu an kullanılamıyor. QR/NFC yönetimi, güvenlik kabulü tamamlanana kadar pilot kapsamı dışındadır.
                </p>
              ) : qrRevokedAt ? (
                <>
                  <div style={{ padding: "12px 0" }}>
                    <span style={badgeStyle("danger")}>İptal Edildi</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 14 }}>
                    Bu kod artık geçersiz ve tekrar kullanılamaz. Aracın için yeni bir kod oluşturabilirsin.
                  </p>
                  <button onClick={handleIssueNewQr} disabled={qrBusy} style={{ ...primaryButtonStyle(qrBusy), width: "auto", padding: "10px 22px" }}>
                    {qrBusy ? "Oluşturuluyor…" : "Yeni Kod Ata / Yenile"}
                  </button>
                </>
              ) : (
                qrDataUrl && (
                  <>
                    {qrRevealed ? (
                      <img src={qrDataUrl} alt="Araç QR kodu" style={{ width: 170, height: 170, borderRadius: radius.md }} />
                    ) : (
                      <div
                        style={{
                          width: 170, height: 170, margin: "0 auto", borderRadius: radius.md, background: colors.surfaceSoft,
                          border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        aria-hidden="true"
                      >
                        <Icon name="qr" color={colors.textMuted} size={44} />
                      </div>
                    )}
                    <div style={{ margin: "10px 0" }}>
                      <span style={badgeStyle("success")}>QR Atandı • Aktif</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 14 }}>
                      Bu kodu anahtarlığa/NFC etikete işleyebilirsin. Aracını satarsan bu pasaport ve teknik geçmiş araçla kalır.
                    </p>
                    {!qrRevealed && (
                      <button
                        onClick={() => setQrRevealed(true)}
                        style={{ ...primaryButtonStyle(false), width: "auto", padding: "10px 22px", marginBottom: 10 }}
                      >
                        QR'ı Göster
                      </button>
                    )}
                    <div>
                      <button onClick={handleRevokeQr} disabled={qrBusy} style={dangerOutlineButtonStyle(qrBusy)}>
                        {qrBusy ? "İşleniyor…" : "Kodu İptal Et"}
                      </button>
                    </div>
                  </>
                )
              )}
            </section>

            <section id="devir" style={{ ...cardStyle, textAlign: "center", display: activeTab === "genel" && PILOT_FLAGS.ownershipTransferSelfService ? "block" : "none" }}>
              <SectionHeader icon="swap" title="Sahiplik Devri" center />
              <p style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                Aracınızı sattığınızda teknik geçmişi koruyarak yeni sahibine güvenle devredin.
                Kişisel bilgileriniz yeni sahibine aktarılmaz.
              </p>
              <a
                href={`/bireysel/araclar/${params.id}/devret`}
                style={{ display: "inline-block", padding: "11px 22px", background: colors.surfaceSoft, color: colors.textDark, borderRadius: radius.sm, textDecoration: "none", fontWeight: 700, fontSize: 13.5, minHeight: 44 }}
              >
                Aracı Devret / Elden Çıkar
              </a>
            </section>

            <section id="servis-gecmisi" style={{ ...cardStyle, display: activeTab === "gecmis" ? "block" : "none" }}>
              <SectionHeader icon="history" title="Servis Geçmişi" />
              <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>Diğer Bakım Kaydı (serbest not)</h3>
              <input
                placeholder="Yapılan işlem (örn. Genel bakım, lastik rotasyonu)"
                aria-invalid={!!recordError}
                aria-describedby={recordError ? "record-desc-err" : undefined}
                style={{ ...inputStyle, marginBottom: recordError ? 4 : 8, borderColor: recordError ? colors.danger : colors.border }}
                value={newRecord.description}
                onChange={(e) => {
                  setNewRecord({ ...newRecord, description: e.target.value });
                  if (recordError) setRecordError("");
                }}
              />
              {recordError && (
                <p id="record-desc-err" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "0 0 8px" }}>
                  {recordError}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text" inputMode="numeric" placeholder="Km" style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}
                  value={formatKmInput(newRecord.km_at_service)}
                  onChange={(e) => setNewRecord({ ...newRecord, km_at_service: sanitizeKmInput(e.target.value) })}
                />
                <input
                  type="number" placeholder="Ücret (₺)" style={inputStyle}
                  value={newRecord.cost}
                  onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })}
                />
              </div>
              <button
                onClick={handleAddRecord}
                disabled={!newRecord.description.trim()}
                style={{ ...primaryButtonStyle(!newRecord.description.trim()), width: "auto", padding: "10px 20px", marginBottom: 20 }}
              >
                Kaydı Ekle
              </button>

              <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>Geçmiş</h3>
              {records.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.textMuted }}>Henüz kayıt yok.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {records.map((r) => (
                    <li key={r.id} style={{ borderBottom: `1px solid ${colors.border}`, padding: "10px 0", fontSize: 13.5 }}>
                      <div style={{ color: colors.textDark, marginBottom: 4 }}>
                        {new Date(r.service_date).toLocaleDateString("tr-TR")} — {r.description} {r.km_at_service ? `(${r.km_at_service} km)` : ""}
                      </div>
                      <span style={badgeStyle(r.tenant_id ? "success" : "neutral")}>
                        {r.tenant_id ? "Servis Doğrulamalı Kayıt" : "Araç Sahibi Kaydı"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: colors.surfaceSoft, borderRadius: radius.sm, padding: "8px 12px" }}>
      <span style={{ fontSize: 12.5, color: colors.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: colors.textDark }}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon, title, center = false }: { icon: string; title: string; center?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: "#E6FAEE", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={colors.greenDark} size={15} />
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.textDark, margin: 0 }}>{title}</h2>
    </div>
  );
}
