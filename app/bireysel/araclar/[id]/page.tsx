"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";
import { fetchStatusRecords } from "@/lib/vehicleRecords";
import { VehicleStatusPanel, StatusPill } from "@/components/VehicleStatusPanel";
import { VehicleTimeline } from "@/components/VehicleTimeline";
import { colors, font, radius, inputStyle, labelStyle, helperStyle, errorTextStyle, primaryButtonStyle, secondaryButtonStyle, dangerOutlineButtonStyle, badgeStyle, cardStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
import OwnerQuickVisit from "@/components/OwnerQuickVisit";
import OwnerKeychainCard from "@/components/OwnerKeychainCard";
import { CaretSafeInput } from "@/components/CaretSafeInput";
import { BrandModelPicker } from "@/components/BrandModelPicker";
import { DocDatesFields, DOC_DATE_FIELDS } from "@/components/DocDatesFields";
import { HistoryEntryFields } from "@/components/HistoryEntryFields";
import { saveHistoryEntries, newRequestId, type HistoryEntry } from "@/lib/historySave";
const { emptyEntry, validateHistoryEntry } = require("@/lib/history");
const { printableQrUrl } = require("@/lib/qrUrl");

const { ITEM_LABELS } = require("@/lib/maintenanceItems");
const { dateDueStatus, fmtDate } = require("@/lib/vehicleStatus");
const { validateVehicleInput, computeMaintenancePlan, isValidNextServiceKm, isValidNextServiceDate, isValidDocDate, todayIsoIstanbul } = require("@/lib/logic");

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
  { key: "yakit_filtresi", label: "Yakıt Filtresi" },
  { key: "sanziman_yagi", label: "Şanzıman Yağı" },
  { key: "antifriz", label: "Antifriz" },
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
const DEFAULT_ITEM_INTERVALS: Record<string, number> = require("@/lib/maintenanceItems").DEFAULT_INTERVALS;

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
    isNew ? { plate: "", brand: "", model: "", year: "", current_km: "", next_service_km: "", next_service_date: "", notes: "", muayene_tarihi: "", kasko_bitis: "", trafik_sigortasi_bitis: "" } : null
  );
  // Aşama E: geçmiş = zaman çizelgesi (vehicle_timeline RPC, 20'lik sayfa).
  // Araç sahibi servis düzeltmelerini yalnız sade "sonradan düzeltildi"
  // notuyla görür (teknik audit ayrıntısı yok).
  const [timelineReload, setTimelineReload] = useState(0);
  const [statusRecords, setStatusRecords] = useState<{ lastMuayene: any; lastDetailing: any }>({ lastMuayene: null, lastDetailing: null });
  const [sourceCounts, setSourceCounts] = useState<{ service: number | null; owner: number | null }>({ service: null, owner: null });
  const [qrActive, setQrActive] = useState<boolean | null>(null);
  const [maintenanceItems, setMaintenanceItems] = useState<any[]>([]);
  const [intervalInputs, setIntervalInputs] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrRevokedAt, setQrRevokedAt] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  // PILOT FIX 03 (bölüm F): büyük taranabilir QR artık varsayılan açık
  // görünmüyor — "QR'ı Göster" açık eylemiyle ortaya çıkıyor.
  const [qrRevealed, setQrRevealed] = useState(false);
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
  // Nihai UX: Parça Durumu formu uzatmasın diye kapalı başlar.
  const [showParts, setShowParts] = useState(false);
  // Tarihler & Belgeler: okuma görünümü; "Düzenle" ile tarih alanları açılır.
  const [docsEditing, setDocsEditing] = useState(false);
  const [docsDraft, setDocsDraft] = useState<Record<string, string>>({});
  const [docsSaving, setDocsSaving] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [docsSaved, setDocsSaved] = useState(false);
  // Zaman çizelgesi: "Geçmiş İşlem Ekle" (bakım/parça ya da diğer kayıt).
  const [addMode, setAddMode] = useState<null | "bakim" | "diger">(null);
  const [histEntry, setHistEntry] = useState<HistoryEntry>(emptyEntry());
  const [histError, setHistError] = useState<{ field: string; message: string } | null>(null);
  const [histSaveError, setHistSaveError] = useState("");
  const [histSaved, setHistSaved] = useState("");
  const histReqRef = useRef<string | null>(null);
  const histSavingRef = useRef(false);
  const [histSaving, setHistSaving] = useState(false);

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

      await loadStatusData();

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
      if (hash === "duzenle") {
        // Ana ekrandaki "Eksik Bilgileri Tamamla": düzenleme formu açılır.
        setEditingVehicle(true);
        window.setTimeout(() => document.getElementById("arac-formu")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      } else if (hash) {
        if (hash === "servis-gecmisi") setActiveTab("gecmis");
        else if (hash === "muayene" || hash === "qr") setActiveTab("belgeler");
        else setActiveTab("genel");
        if (hash === "parca") {
          setShowParts(true);
          setShowQuickEntry(true);
        }
        // #anahtarlik gibi kendi verisini sonradan yükleyen kartlar için
        // kısa aralıklarla birkaç kez denenir.
        let tries = 0;
        const go = () => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          else if (tries++ < 10) window.setTimeout(go, 150);
        };
        window.setTimeout(go, 80);
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
      const publicUrl = printableQrUrl(qrKey.code);
      setQrDataUrl(publicUrl ? await QRCode.toDataURL(publicUrl, { width: 220 }) : null);
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

  // Servis doğrulamalı / bireysel kayıt sayıları + son muayene/detailing.
  async function loadStatusData() {
    const head = () => supabase.from("maintenance_records").select("id", { count: "exact", head: true }).eq("vehicle_id", params.id);
    const [sr, svc, own] = await Promise.all([
      fetchStatusRecords(supabase, params.id as string),
      head().not("tenant_id", "is", null),
      head().is("tenant_id", null),
    ]);
    setStatusRecords(sr);
    setSourceCounts({ service: (svc as any)?.count ?? null, owner: (own as any)?.count ?? null });
  }

  async function refreshRecords() {
    setTimelineReload((n) => n + 1);
    await loadStatusData();
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
            muayene_tarihi: vehicle.muayene_tarihi || null,
            kasko_bitis: vehicle.kasko_bitis || null,
            trafik_sigortasi_bitis: vehicle.trafik_sigortasi_bitis || null,
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
      // Nihai UX: yeni araçtan sonra bir kez "son 12 aylık geçmiş" başlangıcı.
      router.push(`/bireysel/araclar/${json.vehicle.id}/gecmis`);
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
          muayene_tarihi: vehicle.muayene_tarihi || null,
          kasko_bitis: vehicle.kasko_bitis || null,
          trafik_sigortasi_bitis: vehicle.trafik_sigortasi_bitis || null,
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

    // 2026-09-24: kalem + kayıt tek transaction'da (record_service_visit).
    const currentKm = Number(vehicle.current_km) || 0;
    const keepNextKm = vehicle.next_service_km != null && Number(vehicle.next_service_km) > currentKm ? Number(vehicle.next_service_km) : null;
    const keepNextDate = vehicle.next_service_date && vehicle.next_service_date >= today ? vehicle.next_service_date : null;
    const requestId =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
    const { data: rpcData, error: rpcError } = await supabase.rpc("record_service_visit", {
      p_vehicle_id: params.id,
      p_km: currentKm,
      p_items: [{ key: itemKey, interval_km: intervalKm }],
      p_description: label,
      p_next_km: keepNextKm,
      p_next_date: keepNextDate,
      p_request_id: requestId,
    });
    const insertedRecord = !rpcError && rpcData?.record_id ? { id: rpcData.record_id } : null;
    if (rpcError) alert("Kayıt yapılamadı; hiçbir değişiklik kaydedilmedi.");

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

  // Zaman çizelgesi → "Geçmiş İşlem Ekle". Kayıt "Bireysel Geçmiş Kaydı"
  // (tenant_id=null, geçmiş işlem tarihi). Bakım/parça kaydı, araçta daha yeni
  // kayıt yoksa sonraki bakımı bu kaydın tarih ve km'sinden başlatır.
  function openAdd(mode: "bakim" | "diger") {
    setAddMode((m) => (m === mode ? null : mode));
    setHistEntry({ ...emptyEntry(), date: todayIsoIstanbul(), otherOn: mode === "diger" });
    setHistError(null);
    setHistSaveError("");
    setHistSaved("");
    histReqRef.current = null;
  }

  async function handleAddHistory() {
    if (!addMode || !userId || histSavingRef.current) return;
    setHistSaveError("");
    const today = todayIsoIstanbul();
    const minDate = vehicle.year ? `${Math.max(1950, Number(vehicle.year) - 1)}-01-01` : "2000-01-01";
    const err = validateHistoryEntry(histEntry, { today, currentKm: vehicle.current_km, minDate, kind: addMode });
    setHistError(err);
    if (err) return;
    histSavingRef.current = true;
    setHistSaving(true);
    try {
      if (!histReqRef.current) histReqRef.current = newRequestId();
      const res = await saveHistoryEntries({ supabase, vehicleId: params.id as string, userId, entries: [histEntry], requestIds: [histReqRef.current] });
      if (!res.ok) {
        setHistSaveError(res.message || "Kaydedilemedi.");
        return;
      }
      histReqRef.current = null;
      if (res.plan) setVehicle((prev: any) => ({ ...prev, next_service_km: res.plan!.nextServiceKm, next_service_date: res.plan!.nextServiceDate }));
      await refreshMaintenanceItems();
      await refreshRecords();
      setAddMode(null);
      setHistSaved(res.plan ? "Kayıt eklendi; sonraki bakım bu kayda göre güncellendi." : "Kayıt eklendi.");
      window.setTimeout(() => setHistSaved(""), 5000);
    } catch {
      setHistSaveError("Beklenmeyen bir bağlantı hatası oluştu. Tekrar göndermeden önce zaman çizelgesini kontrol edin.");
    } finally {
      histSavingRef.current = false;
      setHistSaving(false);
    }
  }

  function openDocsEdit() {
    setDocsDraft({
      muayene_tarihi: vehicle.muayene_tarihi || "",
      kasko_bitis: vehicle.kasko_bitis || "",
      trafik_sigortasi_bitis: vehicle.trafik_sigortasi_bitis || "",
    });
    setDocsError("");
    setDocsSaved(false);
    setDocsEditing(true);
  }

  async function handleSaveDocs() {
    if (docsSaving) return;
    for (const f of DOC_DATE_FIELDS) {
      if (!isValidDocDate(docsDraft[f.key])) {
        setDocsError(`${f.label} geçerli bir tarih olmalı.`);
        return;
      }
    }
    setDocsError("");
    setDocsSaving(true);
    const patch = {
      muayene_tarihi: docsDraft.muayene_tarihi || null,
      kasko_bitis: docsDraft.kasko_bitis || null,
      trafik_sigortasi_bitis: docsDraft.trafik_sigortasi_bitis || null,
    };
    const { error } = await supabase.from("vehicles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", params.id);
    setDocsSaving(false);
    if (error) {
      setDocsError("Kaydedilemedi; tarihler değişmedi. Tekrar deneyin.");
      return;
    }
    setVehicle((prev: any) => ({ ...prev, ...patch }));
    setDocsEditing(false);
    setDocsSaved(true);
    window.setTimeout(() => setDocsSaved(false), 3000);
  }

  if (loading || !vehicle) return <DetailSkeleton />;

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

  return (
    <main className="otoiz-app-shell" style={{ fontFamily: font, paddingBottom: 60 }}>
      {/* 1) Araç başlığı: plaka, marka/model, kısa meta */}
      <header style={{ background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}` }}>
        <div className={isNew ? "otoiz-vehicle-shell otoiz-form-800" : "otoiz-vehicle-shell otoiz-detail-shell"} style={{ maxWidth: 560, margin: "0 auto", padding: "10px 16px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <a href="/bireysel/araclar" style={{ fontSize: 14.5, fontWeight: 600, color: colors.textMuted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, paddingRight: 12 }}>
              <Icon name="chevron-left" color={colors.textMuted} size={18} />
              Araçlarım
            </a>
            {!isNew && (
              <button
                onClick={() => setEditingVehicle((v) => !v)}
                aria-expanded={editingVehicle}
                style={{ ...secondaryButtonStyle(), width: "auto", minHeight: 44, padding: "0 16px", fontSize: 14 }}
              >
                {editingVehicle ? "Kapat" : "Düzenle"}
              </button>
            )}
          </div>
          {isNew ? (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, margin: "10px 0 6px" }}>Yeni Araç</h1>
              <p style={{ fontSize: 14.5, color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>Plaka, marka, model, model yılı ve kilometreyi girin; tarihleri sonra da ekleyebilirsiniz.</p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.8, color: colors.text, margin: "10px 0 0", lineHeight: 1.15 }}>{vehicle.plate}</h1>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px 12px", flexWrap: "wrap", marginTop: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.textMuted }}>
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Marka/model girilmedi"}
                  {vehicle.year ? ` · ${vehicle.year}` : ""}
                </span>
                {vehicle.current_km != null && vehicle.current_km !== "" && (
                  <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{Number(vehicle.current_km).toLocaleString("tr-TR")} km</span>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className={isNew ? "otoiz-vehicle-shell otoiz-form-800" : "otoiz-vehicle-shell otoiz-detail-shell"} style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        {(isNew || editingVehicle) && (
          <section id="arac-formu" data-testid="arac-formu" className="otoiz-enter otoiz-detail-narrow" style={{ ...cardStyle, padding: 20 }}>
            {!isNew && (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.text, margin: "0 0 4px" }}>Araç Bilgilerini Düzenle</h2>
                <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 18px" }}>Değiştirdiğiniz alanlar kaydettiğinizde güncellenir.</p>
              </>
            )}
            <FormGroupTitle>Araç</FormGroupTitle>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="arac-plate" style={labelStyle}>Plaka</label>
              <CaretSafeInput
                id="arac-plate"
                data-field="plate"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="34 ABC 123"
                aria-describedby={fieldErrors.plate ? "err-plate" : undefined}
                aria-invalid={!!fieldErrors.plate}
                style={{ ...inputStyle, fontWeight: 700, letterSpacing: 0.6 }}
                value={vehicle.plate}
                onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
              />
              {fieldErrors.plate && (
                <p id="err-plate" role="alert" style={errorTextStyle}>
                  {fieldErrors.plate}
                </p>
              )}
            </div>
            <BrandModelPicker
              idPrefix="arac"
              layout="stack"
              brand={vehicle.brand || ""}
              model={vehicle.model || ""}
              errors={{ brand: fieldErrors.brand, model: fieldErrors.model }}
              onChange={(next) => setVehicle({ ...vehicle, ...next })}
            />
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="arac-km" style={labelStyle}>Kilometre</label>
              <CaretSafeInput caretChars="digits"
                id="arac-km"
                data-field="current_km"
                type="text"
                inputMode="numeric"
                placeholder="Örn. 52430"
                aria-describedby={fieldErrors.current_km ? "err-current_km" : "help-km"}
                aria-invalid={!!fieldErrors.current_km}
                style={{ ...inputStyle, fontWeight: 800, fontSize: 18, letterSpacing: 0.3 }}
                value={formatKmInput(vehicle.current_km)}
                onChange={(e) => setVehicle({ ...vehicle, current_km: sanitizeKmInput(e.target.value) })}
              />
              {fieldErrors.current_km ? (
                <p id="err-current_km" role="alert" style={errorTextStyle}>
                  {fieldErrors.current_km}
                </p>
              ) : (
                <p id="help-km" style={helperStyle}>Göstergedeki güncel kilometre.</p>
              )}
            </div>

            <DocDatesFields
              idPrefix="arac"
              value={vehicle}
              onChange={(key, v) => setVehicle({ ...vehicle, [key]: v })}
            />

            <FormGroupTitle>Diğer Bilgiler</FormGroupTitle>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="arac-year" style={labelStyle}>Model Yılı</label>
              <input
                id="arac-year"
                data-field="year"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="Örn. 2019"
                aria-describedby={fieldErrors.year ? "err-year" : undefined}
                aria-invalid={!!fieldErrors.year}
                style={inputStyle}
                value={vehicle.year || ""}
                onChange={(e) => setVehicle({ ...vehicle, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
              {fieldErrors.year && (
                <p id="err-year" role="alert" style={errorTextStyle}>
                  {fieldErrors.year}
                </p>
              )}
            </div>

            <FormGroupTitle>Bakım Planı</FormGroupTitle>
            {isNew ? (
              // PILOT FIX 03 madde B: yeni araç akışında bakım planı elle
              // km/tarih yazılarak değil, otomatik seçenek çipleriyle
              // belirlenir — normal senaryoda klavye hiç açılmaz.
              <>
                <div role="group" aria-label="Bakım planı" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {PLAN_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPlanType(opt.key as typeof planType)}
                      aria-pressed={planType === opt.key}
                      style={chipStyle(planType === opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {planType !== "custom" && planType !== "later" && vehicle.current_km !== "" && !Number.isNaN(Number(vehicle.current_km)) && (
                  <p style={{ ...helperStyle, margin: "0 0 18px", color: colors.textMuted }}>
                    Sonraki bakım:{" "}
                    <strong style={{ color: colors.greenLight }}>
                      {(() => {
                        const plan = computeMaintenancePlan({ currentKm: Number(vehicle.current_km), planType });
                        return `${plan.nextServiceKm!.toLocaleString("tr-TR")} km · ${new Date(plan.nextServiceDate!).toLocaleDateString("tr-TR")}`;
                      })()}
                    </strong>
                  </p>
                )}
                {planType === "later" && <p style={{ ...helperStyle, margin: "0 0 18px" }}>Bakım planı sonra belirlenecek.</p>}
                {planType === "custom" && <NextServiceFields vehicle={vehicle} setVehicle={setVehicle} fieldErrors={fieldErrors} todayIso={todayIso} />}
              </>
            ) : (
              <NextServiceFields vehicle={vehicle} setVehicle={setVehicle} fieldErrors={fieldErrors} todayIso={todayIso} />
            )}

            <button onClick={handleSaveVehicle} disabled={saving} style={{ ...primaryButtonStyle(saving), marginTop: 4 }}>
              {saving ? "Kaydediliyor…" : isNew ? "Aracı Oluştur" : "Kaydet"}
            </button>
            {Object.keys(fieldErrors).length > 0 && (
              <p role="status" style={{ ...errorTextStyle, textAlign: "center", marginTop: 10 }}>Kırmızı işaretli alanları kontrol edin.</p>
            )}
          </section>
        )}

        {!isNew && (
          <>
            <nav aria-label="Araç bölümleri" style={{ display: "flex", gap: 4, background: colors.surface, borderRadius: radius.md, padding: 4, border: `1px solid ${colors.border}` }}>
              {(
                [
                  { key: "genel", label: "Genel Bakış" },
                  { key: "gecmis", label: "Zaman Çizelgesi" },
                  { key: "belgeler", label: "Tarihler & Belgeler" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  aria-current={activeTab === t.key ? "page" : undefined}
                  style={{
                    flex: "1 1 0", minWidth: 0, padding: "8px 4px", borderRadius: radius.sm, border: "none", cursor: "pointer",
                    fontSize: 13.5, fontWeight: 700, fontFamily: font, minHeight: 44, lineHeight: 1.2,
                    background: activeTab === t.key ? colors.green : "transparent",
                    color: activeTab === t.key ? colors.onAccent : colors.textMuted,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {/* Genel Bakış (Nihai UX): sol — Sonraki Bakım → Muayene/Kasko/Trafik →
                Yaklaşan İşlemler → Detailing ve Belgeler; sağ — hızlı bakım kaydı,
                parça durumu, son işlemler, QR, kayıt sayıları. Bakım tek yerde. */}
            {!isNew && vehicle?.id && (
              <div data-testid={activeTab === "genel" ? "bireysel-ozet" : undefined} className="otoiz-detail-grid" style={{ display: activeTab === "genel" ? undefined : "none" }}>
                <div className="otoiz-detail-col">
                  {activeTab === "genel" && (
                    <VehicleStatusPanel
                      vehicle={vehicle}
                      items={maintenanceItems}
                      labels={ITEM_LABELS}
                      lastMuayene={statusRecords.lastMuayene}
                      lastDetailing={statusRecords.lastDetailing}
                      onOpenDocs={() => {
                        setActiveTab("belgeler");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  )}
                </div>
                <div className="otoiz-detail-col">
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
                <section id="parca" style={cardStyle}>
                  <button
                    type="button"
                    data-testid="parca-durumu-ac"
                    aria-expanded={showParts}
                    onClick={() => setShowParts((v) => !v)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: 0, minHeight: 44, cursor: "pointer", fontFamily: font }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>Parça Durumu</span>
                    <Icon name={showParts ? "chevron-up" : "chevron-down"} color={colors.textMuted} size={18} />
                  </button>
                  {showParts && (
                  <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 16px" }}>
                    {[...MAINTENANCE_ITEMS, ...(maintenanceItems.some((m: any) => m.item_key === LEGACY_ITEM.key) ? [LEGACY_ITEM] : [])].map((item) => {
                      const s = getUpcomingStatus(item.key);
                      if (!s) return null;
                      return (
                        <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "12px 14px" }}>
                          <span style={{ fontSize: 14.5, fontWeight: 600, color: colors.text }}>{item.label}</span>
                          <span style={badgeStyle(s.kind)}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowQuickEntry((v) => !v)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                      background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "12px 16px",
                      cursor: "pointer", fontFamily: font, fontSize: 14.5, fontWeight: 700, color: colors.text, minHeight: 52,
                    }}
                  >
                    Parça değişimi ekle
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: colors.greenLight, fontWeight: 700 }}><Icon name="check" color={colors.greenLight} size={16} />{quickUndo.label} eklendi</span>
                      <button
                        type="button"
                        onClick={handleUndoQuickMaintenance}
                        style={{ background: "none", border: "none", color: colors.text, fontWeight: 800, fontSize: 14, textDecoration: "underline", cursor: "pointer", minHeight: 44, fontFamily: font }}
                      >
                        Geri al
                      </button>
                    </div>
                  )}

                  {showQuickEntry && (
                  <>
                  <p style={{ ...helperStyle, margin: "14px 0" }}>
                    Kendiniz yaptıysanız ya da başka yerde yaptırdıysanız işleme dokunun. Bugünün tarihi, güncel km ve varsayılan periyotla kaydedilir.
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
                            style={{ ...chipStyle(!!status?.isToday), cursor: isSaving ? "wait" : "pointer" }}
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
                    style={{ background: "none", border: "none", color: colors.greenLight, fontWeight: 700, fontSize: 14, padding: "4px 0", minHeight: 44, cursor: "pointer", fontFamily: font, marginBottom: showAllQuickItems ? 10 : 4 }}
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
                            border: status?.isToday ? `1px solid ${colors.green}` : `1px solid ${colors.border}`,
                            background: status?.isToday ? colors.greenSoft : colors.surfaceRaised,
                          }}
                        >
                          <button
                            onClick={() => handleQuickMaintenance(item.key, item.label)}
                            disabled={isSaving}
                            style={{
                              width: "100%", textAlign: "left", background: "none", border: "none", minHeight: 32,
                              cursor: isSaving ? "wait" : "pointer",
                              color: status?.isToday ? colors.greenLight : colors.text, fontWeight: 700, fontSize: 14.5, padding: 0, marginBottom: 8, fontFamily: font,
                            }}
                          >
                            <div>{isSaving ? "Kaydediliyor…" : item.label}</div>
                            {status && (
                              <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, color: status.isToday ? colors.greenLight : colors.textMuted }}>
                                {status.isToday ? "✓ Bugün yapıldı" : `Son: ${new Date(status.date).toLocaleDateString("tr-TR")}`}
                              </div>
                            )}
                          </button>

                          <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 6 }}>Periyot (km)</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                            {PRESET_KM_OPTIONS.map((preset) => {
                              const isActive = currentValue === String(preset);
                              return (
                                <button
                                  key={preset}
                                  onClick={() => handlePresetClick(item.key, preset)}
                                  disabled={isSavingInterval}
                                  style={{
                                    padding: "6px 12px", borderRadius: radius.pill,
                                    border: `1px solid ${isActive ? colors.green : colors.border}`,
                                    background: isActive ? colors.green : colors.surface,
                                    color: isActive ? colors.onAccent : colors.textMuted,
                                    fontSize: 13, fontWeight: 700, cursor: isSavingInterval ? "wait" : "pointer", minHeight: 36, fontFamily: font,
                                  }}
                                >
                                  {preset.toLocaleString("tr-TR")}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="veya kendi sayını yaz"
                            value={currentValue}
                            onChange={(e) => handleIntervalInputChange(item.key, e.target.value.replace(/\D/g, ""))}
                            onBlur={() => handleIntervalBlur(item.key)}
                            disabled={isSavingInterval}
                            style={{ ...inputStyle, minHeight: 44, padding: "8px 12px", fontSize: 15 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  )}
                  </>
                  )}
                              </>
                  )}
                </section>
                  {activeTab === "genel" && (
                    <VehicleTimeline
                      supabase={supabase}
                      vehicleId={params.id as string}
                      audience="bireysel"
                      reloadKey={timelineReload}
                      preview={5}
                      title="Son İşlemler"
                      alwaysShowAll
                      onShowAll={() => {
                        setActiveTab("gecmis");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  )}
                  <OwnerKeychainCard vehicleId={vehicle.id} onStatus={setQrActive} />
                  <section aria-label="Kayıt kaynakları" style={{ ...cardStyle, padding: 16 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: "0 0 12px" }}>Kayıtlar</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                      <MiniStat label="Servis doğrulamalı" value={sourceCounts.service != null ? String(sourceCounts.service) : "—"} tone={colors.text} />
                      <MiniStat label="Bireysel kayıt" value={sourceCounts.owner != null ? String(sourceCounts.owner) : "—"} tone={colors.text} />
                    </div>
                  </section>
                  {PILOT_FLAGS.ownershipTransferSelfService && (
                    <section id="devir" style={{ ...cardStyle, textAlign: "center" }}>
                      <SectionHeader icon="swap" title="Sahiplik Devri" center />
                      <p style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                        Aracınızı sattığınızda teknik geçmişi koruyarak yeni sahibine güvenle devredin.
                        Kişisel bilgileriniz yeni sahibine aktarılmaz.
                      </p>
                      <a
                        href={`/bireysel/araclar/${params.id}/devret`}
                        style={{ ...secondaryButtonStyle(), display: "inline-flex", alignItems: "center", justifyContent: "center", width: "auto", textDecoration: "none" }}
                      >
                        Aracı Devret / Elden Çıkar
                      </a>
                    </section>
                  )}
                </div>
              </div>
            )}

            {/* Tarihler & Belgeler (Nihai UX): okunur satırlar; sağ üstte
                "Düzenle" ile tarih alanları açılır. Not ayrı ve ikincil. */}
            <div className="otoiz-detail-narrow" style={{ display: activeTab === "belgeler" ? "flex" : "none", flexDirection: "column", gap: 16 }}>
              <section id="muayene" data-testid="tarihler-belgeler" style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0 }}>Muayene ve Sigorta</h2>
                  {!docsEditing && (
                    <button
                      type="button"
                      aria-label="Tarihleri düzenle"
                      onClick={openDocsEdit}
                      style={{ ...secondaryButtonStyle(), width: "auto", minHeight: 40, padding: "0 16px", fontSize: 14 }}
                    >
                      Düzenle
                    </button>
                  )}
                </div>
                {docsEditing ? (
                  <>
                    <DocDatesFields idPrefix="belge" hideLegend value={docsDraft} onChange={(key, v) => setDocsDraft((d) => ({ ...d, [key]: v }))} />
                    {docsError && <p role="alert" style={{ ...errorTextStyle, margin: "0 0 12px" }}>{docsError}</p>}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" onClick={() => setDocsEditing(false)} disabled={docsSaving} style={{ ...secondaryButtonStyle(), flex: 1 }}>
                        Vazgeç
                      </button>
                      <button type="button" onClick={handleSaveDocs} disabled={docsSaving} style={{ ...primaryButtonStyle(docsSaving), flex: 1 }}>
                        {docsSaving ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div data-testid="belge-ozet" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {DOC_DATE_FIELDS.map((f) => {
                      const v = vehicle[f.key];
                      const st = dateDueStatus(v, todayIsoIstanbul());
                      const name = { muayene_tarihi: "Muayene", kasko_bitis: "Kasko", trafik_sigortasi_bitis: "Zorunlu Trafik Sigortası" }[f.key];
                      return (
                        <div key={f.key} data-testid={`belge-satir-${f.key}`} data-level={st.level} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "12px 14px" }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, color: colors.textMuted }}>{name}</span>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: colors.text, marginTop: 2 }}>
                              {v ? fmtDate(v) : "Tarih girilmedi"}
                              {v && st.daysLeft != null && (
                                <span style={{ fontWeight: 500, color: colors.textMuted }}>
                                  {" · "}
                                  {st.daysLeft === 0 ? "bugün" : st.daysLeft < 0 ? `${Math.abs(st.daysLeft)} gün geçti` : `${st.daysLeft} gün kaldı`}
                                </span>
                              )}
                            </span>
                          </span>
                          <StatusPill level={st.level} />
                        </div>
                      );
                    })}
                    {docsSaved && (
                      <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: colors.greenLight, fontWeight: 700, marginTop: 4 }}>
                        <Icon name="check" color={colors.greenLight} size={16} />
                        Tarihler kaydedildi
                      </span>
                    )}
                  </div>
                )}
              </section>

              <section aria-label="Not" style={{ ...cardStyle, padding: 16 }}>
                <label htmlFor="arac-notlar" style={{ ...labelStyle, fontSize: 13 }}>Not <span style={{ color: colors.textFaint, fontWeight: 500 }}>(isteğe bağlı)</span></label>
                <textarea
                  id="arac-notlar"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Örn. kasko poliçe numarası"
                  rows={2}
                  style={{ ...inputStyle, marginBottom: 10, resize: "vertical", fontFamily: font, lineHeight: 1.5, fontSize: 15 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={handleSaveNotes} disabled={savingNotes} style={{ ...secondaryButtonStyle(), width: "auto", padding: "0 18px", minHeight: 44, fontSize: 14 }}>
                    {savingNotes ? "Kaydediliyor…" : "Notu Kaydet"}
                  </button>
                  {notesSaved && <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: colors.greenLight, fontWeight: 700 }}><Icon name="check" color={colors.greenLight} size={16} />Kaydedildi</span>}
                </div>
              </section>
            </div>

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

            <div id="servis-gecmisi" className="otoiz-detail-narrow" style={{ display: activeTab === "gecmis" ? "flex" : "none", flexDirection: "column", gap: 14 }}>
              {/* Nihai UX: serbest not yerine "Geçmiş İşlem Ekle" — kayıt
                  "Bireysel Geçmiş Kaydı" olarak görünür. */}
              <section data-testid="gecmis-islem-ekle" style={cardStyle}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: "0 0 4px" }}>Geçmiş İşlem Ekle</h2>
                <p style={{ ...helperStyle, margin: "0 0 12px" }}>Servis dışında ya da OTOİZ öncesinde yapılan işlemler &quot;Bireysel Geçmiş Kaydı&quot; olarak eklenir.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {(
                    [
                      { key: "bakim", label: "Bakım / Parça Değişimi" },
                      { key: "diger", label: "Diğer Araç Kaydı" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      aria-expanded={addMode === o.key}
                      onClick={() => openAdd(o.key)}
                      style={{ ...chipStyle(addMode === o.key), borderRadius: radius.sm, minHeight: 48, padding: "10px 12px", lineHeight: 1.25 }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {addMode && (
                  <div style={{ marginTop: 16 }}>
                    <HistoryEntryFields
                      key={addMode}
                      idPrefix={`ekle-${addMode}`}
                      kind={addMode}
                      entry={histEntry}
                      onChange={(n) => {
                        setHistEntry(n);
                        if (histError) setHistError(null);
                        histReqRef.current = null;
                      }}
                      today={todayIso}
                      minDate={vehicle.year ? `${Math.max(1950, Number(vehicle.year) - 1)}-01-01` : "2000-01-01"}
                      error={histError}
                    />
                    {histSaveError && <p role="alert" style={{ ...errorTextStyle, margin: "12px 0 0" }}>{histSaveError}</p>}
                    <button type="button" onClick={handleAddHistory} disabled={histSaving} style={{ ...primaryButtonStyle(histSaving), marginTop: 16 }}>
                      {histSaving ? "Kaydediliyor…" : "Kaydı Ekle"}
                    </button>
                  </div>
                )}
                {histSaved && (
                  <p role="status" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: colors.greenLight, fontWeight: 700, margin: "12px 0 0" }}>
                    <Icon name="check" color={colors.greenLight} size={16} />
                    {histSaved}
                  </p>
                )}
              </section>
              {activeTab === "gecmis" && (
                <VehicleTimeline supabase={supabase} vehicleId={params.id as string} audience="bireysel" reloadKey={timelineReload} />
              )}
            </div>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={colors.greenLight} size={16} />
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0 }}>{title}</h2>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ background: colors.surfaceRaised, borderRadius: radius.sm, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone, marginTop: 4, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function FormGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textFaint, margin: "4px 0 12px", paddingBottom: 8, borderBottom: `1px solid ${colors.border}` }}>
      {children}
    </div>
  );
}

function chipStyle(on: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: radius.pill,
    border: `1px solid ${on ? colors.green : colors.border}`,
    background: on ? colors.greenSoft : colors.surfaceRaised,
    color: on ? colors.greenLight : colors.text,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 44,
    fontFamily: font,
  };
}

// Sonraki bakım km / tarih (düzenlemede ve "Özel" planda). Aynı alan adları
// ve doğrulama; yalnız görünüm ortak.
function NextServiceFields({ vehicle, setVehicle, fieldErrors, todayIso }: { vehicle: any; setVehicle: (v: any) => void; fieldErrors: Record<string, string>; todayIso: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
      <div>
        <label htmlFor="arac-next-km" style={labelStyle}>Sonraki Bakım (km) <span style={{ color: colors.textFaint, fontWeight: 500 }}>(isteğe bağlı)</span></label>
        <CaretSafeInput caretChars="digits"
          id="arac-next-km"
          data-field="next_service_km"
          type="text"
          inputMode="numeric"
          placeholder="Örn. 95.000"
          aria-describedby={fieldErrors.next_service_km ? "err-next-km" : undefined}
          aria-invalid={!!fieldErrors.next_service_km}
          style={{ ...inputStyle, fontWeight: 800, fontSize: 18, letterSpacing: 0.3 }}
          value={formatKmInput(vehicle.next_service_km || "")}
          onChange={(e) => setVehicle({ ...vehicle, next_service_km: sanitizeKmInput(e.target.value) })}
        />
        {fieldErrors.next_service_km && (
          <p id="err-next-km" role="alert" style={errorTextStyle}>
            {fieldErrors.next_service_km}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="arac-next-date" style={labelStyle}>Sonraki Bakım (tarih) <span style={{ color: colors.textFaint, fontWeight: 500 }}>(isteğe bağlı)</span></label>
        <input
          id="arac-next-date"
          data-field="next_service_date"
          type="date"
          min={todayIso}
          aria-describedby={fieldErrors.next_service_date ? "err-next-date" : undefined}
          aria-invalid={!!fieldErrors.next_service_date}
          style={inputStyle}
          value={vehicle.next_service_date || ""}
          onChange={(e) => setVehicle({ ...vehicle, next_service_date: e.target.value })}
        />
        {fieldErrors.next_service_date && (
          <p id="err-next-date" role="alert" style={errorTextStyle}>
            {fieldErrors.next_service_date}
          </p>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <main className="otoiz-app-shell" aria-busy="true" aria-label="Yükleniyor" style={{ fontFamily: font }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="otoiz-skeleton" style={{ height: 22, width: 110, borderRadius: 8 }} />
        <div className="otoiz-skeleton" style={{ height: 36, width: 200, borderRadius: 10 }} />
        <div className="otoiz-skeleton" style={{ height: 52, borderRadius: radius.md }} />
        <div className="otoiz-skeleton" style={{ height: 120, borderRadius: radius.lg }} />
        <div className="otoiz-skeleton" style={{ height: 220, borderRadius: radius.lg }} />
      </div>
    </main>
  );
}
