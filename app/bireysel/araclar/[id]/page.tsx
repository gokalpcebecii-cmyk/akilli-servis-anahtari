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
import { Drawer } from "@/components/Drawer";
import { saveHistoryEntries, newRequestId, type HistoryEntry } from "@/lib/historySave";
const { emptyEntry, validateHistoryEntry } = require("@/lib/history");
const { printableQrUrl } = require("@/lib/qrUrl");

const { ITEM_LABELS } = require("@/lib/maintenanceItems");
const { dateDueStatus, fmtDate } = require("@/lib/vehicleStatus");
const { validateVehicleInput, computeMaintenancePlan, isValidNextServiceKm, isValidNextServiceDate, isValidDocDate, isValidCurrentKmUpdate, todayIsoIstanbul } = require("@/lib/logic");

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
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
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
  // Nihai UX: Parça Durumu formu uzatmasın diye kapalı başlar.
  const [showParts, setShowParts] = useState(false);
  const [showIntervals, setShowIntervals] = useState(false);
  // Nihai UX son düzenleme: formlar Genel Bakış'ta değil, odaklı pencerede.
  const [drawer, setDrawer] = useState<null | "bakim" | "km">(null);
  const [kmDraft, setKmDraft] = useState("");
  const [kmError, setKmError] = useState("");
  const [kmSaving, setKmSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [qrBindReq, setQrBindReq] = useState(0);
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

  // Son muayene/detailing kaydı (durum kartları için).
  async function loadStatusData() {
    setStatusRecords(await fetchStatusRecords(supabase, params.id as string));
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

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 4000);
  }

  function openKm() {
    setKmDraft(vehicle.current_km != null && vehicle.current_km !== "" ? String(vehicle.current_km) : "");
    setKmError("");
    setDrawer("km");
  }

  // Hızlı İşlemler > KM Güncelle: yalnız güncel km yazılır; km geri gidemez.
  async function handleSaveKm() {
    if (kmSaving) return;
    const n = Number(kmDraft);
    if (!kmDraft || !Number.isFinite(n) || n <= 0) {
      setKmError("Geçerli bir kilometre girin.");
      return;
    }
    if (!isValidCurrentKmUpdate(vehicle.current_km, n)) {
      setKmError(`Kilometre, kayıtlı son kilometreden (${Number(vehicle.current_km).toLocaleString("tr-TR")} km) düşük olamaz.`);
      return;
    }
    setKmSaving(true);
    const { error } = await supabase.from("vehicles").update({ current_km: n, updated_at: new Date().toISOString() }).eq("id", params.id);
    setKmSaving(false);
    if (error) {
      setKmError("Kaydedilemedi; kilometre değişmedi. Tekrar deneyin.");
      return;
    }
    setVehicle((prev: any) => ({ ...prev, current_km: n }));
    setDrawer(null);
    showFlash("Kilometre güncellendi.");
  }

  function goHistoryAdd() {
    setActiveTab("gecmis");
    window.setTimeout(() => {
      const el = document.getElementById("gecmis-islem-ekle");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.focus({ preventScroll: true });
    }, 60);
  }

  function goQr() {
    if (qrActive === false) setQrBindReq((n) => n + 1);
    window.setTimeout(() => document.getElementById("anahtarlik")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
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
                  { key: "gecmis", label: "Geçmiş" },
                  { key: "belgeler", label: "Tarihler" },
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

            {/* Genel Bakış (Nihai UX son düzenleme) — bilgi odaklı; form yok.
                Sol ana kolon: Sonraki Bakım → Muayene/Kasko/Trafik → Yaklaşan
                İşlemler → Detailing ve diğer takipler. Sağ dar kolon: Hızlı
                İşlemler → Son Kayıtlar → QR Durumu. Telefonda Hızlı İşlemler
                kritik tarihlerden hemen sonra gelir. */}
            {!isNew && vehicle?.id && (
              <div data-testid={activeTab === "genel" ? "bireysel-ozet" : undefined} className="otoiz-detail-grid otoiz-detail-split" style={{ display: activeTab === "genel" ? undefined : "none" }}>
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
                      afterDates={
                        <div className="otoiz-when-stacked">
                          <QuickActions onKm={openKm} onMaintenance={() => setDrawer("bakim")} onHistory={goHistoryAdd} onQr={goQr} flash={flash} />
                        </div>
                      }
                      extra={
                        <div id="parca" style={{ background: colors.surfaceRaised, borderRadius: radius.sm, padding: "4px 14px" }}>
                          <button
                            type="button"
                            data-testid="parca-durumu-ac"
                            aria-expanded={showParts}
                            onClick={() => setShowParts((v) => !v)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: 0, minHeight: 44, cursor: "pointer", fontFamily: font }}
                          >
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: colors.text }}>Parça Durumu</span>
                            <Icon name={showParts ? "chevron-up" : "chevron-down"} color={colors.textMuted} size={18} />
                          </button>
                          {showParts && (
                            <div style={{ paddingBottom: 10 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "4px 0 8px" }}>
                                {[...MAINTENANCE_ITEMS, ...(maintenanceItems.some((m: any) => m.item_key === LEGACY_ITEM.key) ? [LEGACY_ITEM] : [])].map((item) => {
                                  const st = getUpcomingStatus(item.key);
                                  if (!st) return null;
                                  return (
                                    <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: colors.surface, borderRadius: radius.sm, padding: "10px 12px" }}>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{item.label}</span>
                                      <span style={badgeStyle(st.kind)}>{st.label}</span>
                                    </div>
                                  );
                                })}
                                {!MAINTENANCE_ITEMS.some((item) => getUpcomingStatus(item.key)) && (
                                  <p style={{ fontSize: 13.5, color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>Periyodu olan bir parça kaydı eklendiğinde durumu burada görünür.</p>
                                )}
                              </div>
                              <button
                                type="button"
                                aria-expanded={showIntervals}
                                onClick={() => setShowIntervals((v) => !v)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: colors.textMuted, fontWeight: 700, fontSize: 14, padding: 0, minHeight: 44, cursor: "pointer", fontFamily: font }}
                              >
                                Parça periyotları
                                <Icon name={showIntervals ? "chevron-up" : "chevron-down"} color={colors.textMuted} size={16} />
                              </button>
                              {showIntervals && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                  {MAINTENANCE_ITEMS.map((item) => {
                                    const isSavingInterval = savingInterval === item.key;
                                    const currentValue = intervalInputs[item.key] ?? "";
                                    return (
                                      <div key={item.key} style={{ padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.surface }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 6 }}>{item.label} <span style={{ fontWeight: 500, color: colors.textMuted }}>· periyot (km)</span></div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                          {PRESET_KM_OPTIONS.map((preset) => {
                                            const isActive = currentValue === String(preset);
                                            return (
                                              <button
                                                key={preset}
                                                type="button"
                                                onClick={() => handlePresetClick(item.key, preset)}
                                                disabled={isSavingInterval}
                                                style={{
                                                  padding: "6px 12px", borderRadius: radius.pill,
                                                  border: `1px solid ${isActive ? colors.green : colors.border}`,
                                                  background: isActive ? colors.greenSoft : colors.surfaceRaised,
                                                  color: isActive ? colors.greenLight : colors.textMuted,
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
                                          aria-label={`${item.label} periyodu (km)`}
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
                            </div>
                          )}
                        </div>
                      }
                    />
                  )}
                </div>
                <div className="otoiz-detail-col">
                  <div className="otoiz-when-wide">
                    <QuickActions onKm={openKm} onMaintenance={() => setDrawer("bakim")} onHistory={goHistoryAdd} onQr={goQr} flash={flash} />
                  </div>
                  {activeTab === "genel" && (
                    <VehicleTimeline
                      supabase={supabase}
                      vehicleId={params.id as string}
                      audience="bireysel"
                      reloadKey={timelineReload}
                      preview={3}
                      title="Son Kayıtlar"
                      alwaysShowAll
                      onShowAll={() => {
                        setActiveTab("gecmis");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  )}
                  <OwnerKeychainCard vehicleId={vehicle.id} onStatus={setQrActive} bindRequest={qrBindReq} />
                  {PILOT_FLAGS.ownershipTransferSelfService && (
                    <section id="devir" style={{ ...cardStyle, padding: 16 }}>
                      <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: "0 0 4px" }}>Sahiplik Devri</h2>
                      <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 8px", lineHeight: 1.5 }}>
                        Aracınızı sattığınızda teknik geçmişi koruyarak yeni sahibine devredin. Kişisel bilgileriniz aktarılmaz.
                      </p>
                      <a href={`/bireysel/araclar/${params.id}/devret`} style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, color: colors.text, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                        Aracı Devret / Elden Çıkar
                        <Icon name="chevron-right" color={colors.textMuted} size={16} />
                      </a>
                    </section>
                  )}
                </div>
              </div>
            )}

            <Drawer open={drawer === "bakim"} title="Bakım Kaydı Ekle" onClose={() => setDrawer(null)} testId="bakim-kaydi-pencere">
              <div style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 16px" }}>
                <strong style={{ color: colors.text, letterSpacing: 0.4 }}>{vehicle.plate}</strong>
                {vehicle.current_km != null && vehicle.current_km !== "" ? ` · Kayıtlı: ${Number(vehicle.current_km).toLocaleString("tr-TR")} km` : ""}
              </div>
              <OwnerQuickVisit
                bare
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
                onDone={() => {
                  setDrawer(null);
                  showFlash("Bakım kaydedildi.");
                }}
              />
            </Drawer>

            <Drawer open={drawer === "km"} title="KM Güncelle" onClose={() => setDrawer(null)} testId="km-guncelle-pencere">
              <label htmlFor="km-guncelle" style={labelStyle}>Güncel kilometre</label>
              <CaretSafeInput
                caretChars="digits"
                id="km-guncelle"
                inputMode="numeric"
                enterKeyHint="done"
                value={formatKmInput(kmDraft)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  setKmDraft(sanitizeKmInput(e.target.value));
                  if (kmError) setKmError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKm();
                }}
                aria-invalid={!!kmError}
                style={{ ...inputStyle, fontSize: 22, fontWeight: 800, textAlign: "center", borderColor: kmError ? colors.danger : colors.border }}
              />
              {vehicle.current_km != null && vehicle.current_km !== "" && (
                <p style={{ ...helperStyle, margin: "8px 0 0" }}>Kayıtlı: {Number(vehicle.current_km).toLocaleString("tr-TR")} km</p>
              )}
              {kmError && <p role="alert" style={{ ...errorTextStyle, margin: "10px 0 0" }}>{kmError}</p>}
              <button type="button" onClick={handleSaveKm} disabled={kmSaving} style={{ ...primaryButtonStyle(kmSaving), marginTop: 18 }}>
                {kmSaving ? "Kaydediliyor…" : "Kilometreyi Kaydet"}
              </button>
            </Drawer>

            {/* Tarihler (Nihai UX): okunur satırlar; sağ üstte "Düzenle" ile
                tarih alanları açılır. Belge/poliçe bilgisi ileride ayrı modülde. */}
            <div className="otoiz-detail-narrow" style={{ display: activeTab === "belgeler" ? "flex" : "none", flexDirection: "column", gap: 16 }}>
              <section id="muayene" data-testid="tarihler-belgeler" style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0 }}>Önemli Tarihler</h2>
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
              <section id="gecmis-islem-ekle" data-testid="gecmis-islem-ekle" tabIndex={-1} style={{ ...cardStyle, outline: "none" }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: "0 0 4px" }}>Geçmiş İşlem Ekle</h2>
                <p data-testid="gecmis-beyan" style={{ ...helperStyle, margin: "0 0 12px" }}>Bu kayıt sizin beyanınızla eklenir ve Bireysel Geçmiş Kaydı olarak görünür.</p>
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

// Nihai UX son düzenleme — Genel Bakış'ın tek müdahale noktası. Formlar
// buradan odaklı pencerede açılır; Genel Bakış formla dolmaz.
function QuickActions({ onKm, onMaintenance, onHistory, onQr, flash }: { onKm: () => void; onMaintenance: () => void; onHistory: () => void; onQr: () => void; flash?: string }) {
  const items = [
    { key: "km", label: "KM Güncelle", icon: "gauge", onClick: onKm },
    { key: "bakim", label: "Bakım Kaydı Ekle", icon: "wrench", onClick: onMaintenance },
    { key: "gecmis", label: "Geçmiş İşlem Ekle", icon: "history", onClick: onHistory },
    { key: "qr", label: "QR Yönetimi", icon: "qr", onClick: onQr },
  ];
  return (
    <section data-testid="hizli-islemler" aria-label="Hızlı işlemler" style={{ ...cardStyle, padding: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: "0 0 12px" }}>Hızlı İşlemler</h2>
      <div className="otoiz-quick-actions">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            data-action={it.key}
            onClick={it.onClick}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.surfaceRaised, color: colors.text, fontSize: 14.5, fontWeight: 700, fontFamily: font, cursor: "pointer", textAlign: "left", lineHeight: 1.25 }}
          >
            <Icon name={it.icon} color={colors.textMuted} size={18} />
            <span style={{ minWidth: 0, flex: 1 }}>{it.label}</span>
          </button>
        ))}
      </div>
      {flash && (
        <p role="status" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: colors.greenLight, fontWeight: 700, margin: "12px 0 0" }}>
          <Icon name="check" color={colors.greenLight} size={16} />
          {flash}
        </p>
      )}
    </section>
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
