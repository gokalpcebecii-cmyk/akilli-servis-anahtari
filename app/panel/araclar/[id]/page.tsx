"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";
import { fetchStatusRecords } from "@/lib/vehicleRecords";
import { useRecordRevisions } from "@/components/RevisionHistory";
import { VehicleStatusPanel } from "@/components/VehicleStatusPanel";
import { VehicleTimeline } from "@/components/VehicleTimeline";
import { colors, font, radius, inputStyle, labelStyle, helperStyle, errorTextStyle, primaryButtonStyle, secondaryButtonStyle, cardStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";
import { CaretSafeInput } from "@/components/CaretSafeInput";
import { BrandModelPicker } from "@/components/BrandModelPicker";
import { DocDatesFields } from "@/components/DocDatesFields";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
const { printableQrUrl, QR_LOCK_MESSAGE } = require("@/lib/qrUrl");

const {
  validateVehicleInput,
  computeMaintenancePlan,
  isValidNextServiceKm,
  isValidNextServiceDate,
  isValidCurrentKmUpdate,
  resolveQuickPlan,
  todayIsoIstanbul,
} = require("@/lib/logic");
const { ITEM_LABELS, DEFAULT_INTERVALS, SERVICE_QUICK_KEYS, SERVICE_MORE_KEYS, NEXT_PLAN_OPTIONS } = require("@/lib/maintenanceItems");

// Kilometre input'ları için: yalnızca rakam, baştaki gereksiz sıfırlar
// temizlenir. Bireysel formuyla aynı davranış (PILOT FIX 03 madde A3).
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

const PLAN_OPTIONS: { key: string; label: string }[] = [
  { key: "default", label: "+10.000 km / 12 ay" },
  { key: "extended_km", label: "+15.000 km / 12 ay" },
  { key: "extended_months", label: "+10.000 km / 6 ay" },
  { key: "custom", label: "Özel" },
  { key: "later", label: "Bakım planını sonra belirle" },
];

// Aşama E: servis hızlı kayıt — 11 hızlı seçim + "Diğer"; eski kalemler
// "Daha fazla işlem" altında (mevcut kayıtlarla uyum). Varsayılan periyotlar
// lib/maintenanceItems.js'de tek kaynak.
const QUICK_ITEMS: { key: string; label: string }[] = SERVICE_QUICK_KEYS.map((key: string) => ({ key, label: ITEM_LABELS[key] }));
const MORE_ITEMS: { key: string; label: string }[] = SERVICE_MORE_KEYS.map((key: string) => ({ key, label: ITEM_LABELS[key] }));
const ALL_ITEMS = [...QUICK_ITEMS, ...MORE_ITEMS];

const PRESET_KM_OPTIONS = [5000, 10000, 15000, 20000, 30000];

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "yeni";
  const supabase = createBrowserSupabase();

  const [vehicle, setVehicle] = useState<any>(
    isNew ? { plate: "", brand: "", model: "", year: "", current_km: "", next_service_km: "", next_service_date: "", muayene_tarihi: "", kasko_bitis: "", trafik_sigortasi_bitis: "" } : null
  );
  // Aşama E: geçmiş = zaman çizelgesi (20'lik sayfalar, vehicle_timeline RPC);
  // düzeltme geçmişi ayrı RPC'den (servis: revizyon ayrıntısı).
  const [revisionReload, setRevisionReload] = useState(0);
  const [statusRecords, setStatusRecords] = useState<{ lastMuayene: any; lastDetailing: any }>({ lastMuayene: null, lastDetailing: null });
  const [quickPlan, setQuickPlan] = useState<string>("default");
  const [showMoreItems, setShowMoreItems] = useState(false);
  const revisions = useRecordRevisions(supabase, params.id as string, revisionReload);
  const [maintenanceItems, setMaintenanceItems] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrRevealed, setQrRevealed] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const [planType, setPlanType] = useState<"default" | "extended_km" | "extended_months" | "custom" | "later">("default");

  // Hızlı bakım girişi state'i
  const [quickKm, setQuickKm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [itemIntervals, setItemIntervals] = useState<Record<string, string>>({});
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState("");
  // Son cila: isteğe bağlı kısa not — kayıt açıklamasının sonuna eklenir
  // (veritabanı/RPC değişmedi).
  const [visitNote, setVisitNote] = useState("");
  const [nextServiceKm, setNextServiceKm] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const quickSubmitRef = useRef(false);
  // Tek bir kayıt denemesinin kimliği: başarıya kadar aynı kalır (tekrar
  // deneme aynı kaydı üretir), başarıdan sonra sıfırlanır.
  const quickRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", params.id).single();
      setVehicle(v);
      if (v) {
        setQuickKm(String(v.current_km ?? ""));
        // Pilot bugfix turu: nextServiceKm/nextServiceDate BİLEREK aracın
        // ESKİ next_service_km/next_service_date'inden DOLDURULMAZ — bu
        // ikisi yalnızca "Planı düzenle" altında kullanıcının GERÇEKTEN
        // yazdığı bir manuel geçersiz kılmayı temsil eder (boş = henüz
        // dokunulmadı = otomatik öneri kullanılır, bkz. handleQuickSave).
        // Eskiden burada eski değerlerle dolduruluyordu; bu, kullanıcı
        // hiçbir şeye dokunmasa bile ESKİ planın "manuel giriş" sanılıp
        // otomatik önerinin üzerine sessizce yazılmasına yol açıyordu.
      }

      setStatusRecords(await fetchStatusRecords(supabase, params.id as string));

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
  // Servis kullanıcıları için qr_keys üzerinde doğrudan INSERT izni RLS'de
  // bilerek yok (havuzdaki kodlar yalnızca /api/qr-eslestir üzerinden
  // atanabilir) — bu yüzden burada kod bulunamazsa staff'ı /panel/eslestir'e
  // yönlendiriyoruz, kendimiz üretmiyoruz.
  async function loadQr(vehicleId: string) {
    const { data: qrKey } = await supabase
      .from("qr_keys")
      .select("code")
      .eq("vehicle_id", vehicleId)
      .is("revoked_at", null)
      .maybeSingle();

    if (qrKey) {
      setQrCode(qrKey.code);
      const publicUrl = printableQrUrl(qrKey.code);
      setQrDataUrl(publicUrl ? await QRCode.toDataURL(publicUrl, { width: 200 }) : null);
    } else {
      setQrCode(null);
      setQrDataUrl(null);
    }
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

  async function handleSaveVehicleInfo() {
    // Çift tıklama / Enter+click tek kayıt üretsin (madde A5).
    if (savingRef.current) return;

    if (isNew) {
      const { valid, errors, normalized } = validateVehicleInput({
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        current_km: vehicle.current_km,
      });
      if (!valid) {
        setFieldErrors(errors);
        focusFirstError(errors);
        return; // Geçersiz istekte hiçbir yan etki (araç/QR) oluşmaz.
      }
      setFieldErrors({});

      const plan = computeMaintenancePlan({
        currentKm: normalized.current_km,
        planType,
        customNextKm: vehicle.next_service_km,
        customNextDate: vehicle.next_service_date,
      });

      savingRef.current = true;
      setSavingVehicle(true);
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
          setSavingVehicle(false);
          if (res.status === 401) {
            alert("Oturumunuz sona ermiş. Lütfen tekrar giriş yapın; girdiğiniz bilgiler kaydedilmedi.");
            await supabase.auth.signOut({ scope: "local" });
            window.location.replace("/panel/login?oturum=bitti");
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
        setSavingVehicle(false);
        alert("Bağlantı hatası. Lütfen tekrar deneyin.");
        return;
      }
      router.push(`/panel/araclar/${json.vehicle.id}`);
    } else {
      savingRef.current = true;
      setSavingVehicle(true);
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year || null,
          muayene_tarihi: vehicle.muayene_tarihi || null,
          kasko_bitis: vehicle.kasko_bitis || null,
          trafik_sigortasi_bitis: vehicle.trafik_sigortasi_bitis || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      savingRef.current = false;
      setSavingVehicle(false);
      if (updateError) {
        // Düzenleme ekranı açık kalır; başarı izlenimi verilmez.
        alert("Kaydedilemedi. Lütfen sayfayı yenileyip tekrar deneyin.");
        return;
      }
      setEditingVehicle(false);
    }
  }

  // Bir işlem seçildiğinde önerilen periyot otomatik atanır (madde C) —
  // "Planı düzenle" içinde her zaman değiştirilebilir/kaldırılabilir.
  function toggleItem(key: string) {
    setSelectedItems((prev) => {
      const next = !prev[key];
      if (next) {
        setItemIntervals((iv) => (iv[key] ? iv : { ...iv, [key]: String(DEFAULT_INTERVALS[key] ?? 10000) }));
      }
      return { ...prev, [key]: next };
    });
  }

  const anySelected = Object.values(selectedItems).some(Boolean) || otherSelected;
  const kmValid = quickKm !== "" && !Number.isNaN(Number(quickKm));

  // Tek dokunuşla seçilen tüm işlemleri TEK seferde, tek "Kaydet" ile
  // gönderir: bir staff/tenant sorgusu, bir araç güncellemesi, bir toplu
  // maintenance_items upsert, bir toplu maintenance_records insert.
  // Hedef: 15-20 saniyelik bakım girişi.
  async function handleQuickSave() {
    // Çift tıklama / Enter+click / yavaş ağ tek kayıt üretsin (madde A5).
    // Ref senkron olduğu için re-render beklemeden ikinci çağrıyı da
    // engeller — hızlı çift tıklama tek mantıksal gönderim üretir.
    if (quickSubmitRef.current) return;
    if (submitting) return;
    setSubmitError("");
    setSuccessMessage("");

    if (!kmValid) {
      setSubmitError("Lütfen geçerli bir kilometre girin.");
      return;
    }
    const km = Number(quickKm);
    // Pilot bugfix turu: güncel kilometre, kayıtlı ESKİ kilometreden
    // düşük olamaz.
    if (!isValidCurrentKmUpdate(vehicle.current_km, km)) {
      setSubmitError(
        `Güncel kilometre, kayıtlı son kilometreden (${Number(vehicle.current_km).toLocaleString("tr-TR")} km) düşük olamaz.`
      );
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

    // Tüm "bugün" kontrolleri Europe/Istanbul takvim gününü kullanır.
    const todayIso = todayIsoIstanbul();

    const selectedKeys = ALL_ITEMS.filter((it) => selectedItems[it.key]).map((it) => it.key);

    // Aşama E: "Sonraki bakım" seçimi. Varsayılan (+10.000 km / 12 ay) güncel
    // km'den otomatik hesaplanır; seçili işlemlerden biri daha erken vade
    // gösteriyorsa o kazanır. Özel: yalnız yazılan km/tarih. Sonra belirle:
    // plan boş kalır. Doğrulama sunucudaki record_service_visit ile aynı.
    const selectedIntervals: Record<string, string> = {};
    for (const key of selectedKeys) {
      if (itemIntervals[key]) selectedIntervals[key] = itemIntervals[key];
    }
    const plan = resolveQuickPlan({
      planKey: quickPlan,
      currentKm: km,
      today: todayIso,
      selectedItemIntervals: selectedIntervals,
      customNextKm: nextServiceKm,
      customNextDate: nextServiceDate,
    });
    if (plan.error) {
      setSubmitError(plan.error);
      return;
    }
    const finalNextKm = plan.nextServiceKm;
    const finalNextDate = plan.nextServiceDate;

    quickSubmitRef.current = true;
    setSubmitting(true);

    const RETRY_MESSAGE = " Tekrar göndermeden önce sayfayı yenileyip kayıt geçmişini kontrol edin.";

    // ÖNEMLİ — GERÇEK BİR DB TRANSACTION'I DEĞİL: aşağıdaki üç yazma
    // (vehicles update, maintenance_items upsert, maintenance_records
    // insert) HÂLÂ AYRI, birbirinden BAĞIMSIZ isteklerdir — tek bir
    // Postgres transaction'ı İÇİNDE DEĞİLDİR (Supabase'in istemci SDK'sı
    // çoklu tablo yazmalarını atomik sarmalamaz). Aşağıdaki "her adımdan
    // sonra hata kontrolü + ilk hatada dur" deseni kısmi başarıyı EN AZA
    // indirir (ör. vehicles güncellemesi başarısızsa maintenance_items/
    // records'a HİÇ geçilmez) — ama vehicles GÜNCELLENDİKTEN SONRA
    // maintenance_items/records adımlarından biri başarısız olursa yine
    // de KISMİ bir durum (araç güncellenmiş, bakım kaydı GİRİLMEMİŞ)
    // oluşabilir; bu istemci tarafından GERİ ALINAMAZ. Gerçek atomiklik
    // yalnızca sunucu tarafında TEK bir (BEGIN...COMMIT içeren) SECURITY
    // DEFINER RPC ile sağlanabilir — bu, AYRI bir Supabase staging
    // kurulumunda tasarlanıp test edilmeli. Bu turda hiçbir migration/RPC
    // oluşturulmadı/uygulanmadı; bu yalnızca istemci-seviyesi bir hata
    // yönetimi sıkılaştırmasıdır.
    try {
      // 2026-09-24: araç km/sonraki bakım + bakım kalemleri + bakım kaydı
      // artık TEK veritabanı transaction'ında (record_service_visit RPC)
      // yazılıyor — bir adım hata verirse hiçbiri kalıcı olmaz. Aynı istek
      // kimliğiyle yeniden gönderim ikinci kayıt üretmez (çift tıklama /
      // bağlantı kopması sonrası tekrar deneme güvenli). Kaydın "Servis
      // Doğrulamalı" olup olmadığını istemci değil veritabanı belirler.
      if (!quickRequestIdRef.current) {
        quickRequestIdRef.current =
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
      }
      const visitLabels = selectedKeys.map((key) => ITEM_LABELS[key] ?? key);
      if (otherSelected && otherText.trim()) {
        visitLabels.push(otherText.trim());
      }
      const noteText = visitNote.trim().replace(/\s+/g, " ").slice(0, 200);
      const itemsPayload = selectedKeys.map((key) => ({
        key,
        interval_km: itemIntervals[key] ? Number(itemIntervals[key]) : null,
      }));
      const { data: rpcData, error: rpcError } = await supabase.rpc("record_service_visit", {
        p_vehicle_id: params.id,
        p_km: km,
        p_items: itemsPayload,
        p_description: visitLabels.join(", ") + (noteText ? ` — Not: ${noteText}` : ""),
        p_next_km: finalNextKm,
        p_next_date: finalNextDate,
        p_request_id: quickRequestIdRef.current,
      });
      if (rpcError) {
        const msg = String(rpcError.message || "");
        if (msg.includes("km_lower_than_current")) {
          setSubmitError("Güncel kilometre, kayıtlı son kilometreden düşük olamaz.");
        } else if (msg.includes("forbidden") || (rpcError as any).code === "42501") {
          setSubmitError("Bu araca kayıt yetkiniz yok ya da işletmeniz henüz onaylanmadı.");
        } else if (/failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) {
          // Bağlantı koptu: istek sunucuya ulaşmış olabilir, "hiçbir
          // değişiklik kaydedilmedi" denemez.
          setSubmitError("Beklenmeyen bir bağlantı hatası oluştu." + RETRY_MESSAGE);
        } else {
          setSubmitError("Kayıt yapılamadı; hiçbir değişiklik kaydedilmedi." + RETRY_MESSAGE);
        }
        return;
      }
      quickRequestIdRef.current = null;

      // Yazmalar tamamlandı — ekranı yenileyen okuma sorgularının
      // hataları da kontrol edilir. Yazmalar BAŞARILI olduğu için burada
      // bir hata, "kayıt başarısız" DEĞİL, "kayıt olmuş olabilir ama ekran
      // güncel değil" anlamına gelir — bu YÜZDEN normal başarı mesajı
      // GÖSTERİLMEZ, form verileri TEMİZLENMEZ (kullanıcı ne seçtiğini
      // kaybetmesin, gerekirse manuel sayfa yenilemesiyle devam etsin).
      const { data: mi, error: miError } = await supabase.from("maintenance_items").select("*").eq("vehicle_id", params.id);
      if (miError) {
        setSubmitError("Kayıt kaydedilmiş olabilir ancak ekran yenilenemedi. Yeniden göndermeyin; sayfayı yenileyin.");
        return;
      }

      setMaintenanceItems(mi ?? []);
      setRevisionReload((n) => n + 1);
      fetchStatusRecords(supabase, params.id as string).then(setStatusRecords);
      setVehicle((prev: any) => ({ ...prev, current_km: km, next_service_km: finalNextKm, next_service_date: finalNextDate }));

      setSelectedItems({});
      setItemIntervals({});
      setOtherSelected(false);
      setOtherText("");
      setVisitNote("");
      setNextServiceKm("");
      setNextServiceDate("");
      setQuickPlan("default");
      setShowMoreItems(false);
      setSuccessMessage(rpcData?.service_verified === false ? "✓ Kayıt tamamlandı" : "✓ Kayıt tamamlandı · Servis Doğrulamalı");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch {
      // Beklenmeyen ağ/fetch istisnası (ör. bağlantı koptu) — yukarıdaki
      // adımların HİÇBİRİ {error} SONUCU DEĞİL, doğrudan THROW ile
      // sonlanmış olabilir. Bu durumda da "Kayıt tamamlandı" GÖSTERİLMEZ
      // ve kullanıcı aynı açık mesajla yönlendirilir.
      setSubmitError("Beklenmeyen bir bağlantı hatası oluştu." + RETRY_MESSAGE);
    } finally {
      // Buton kalıcı olarak "Kaydediliyor…" durumunda KALMAZ — başarı,
      // beklenen hata VEYA beklenmeyen istisna FARK ETMEKSİZİN kilit
      // mutlaka açılır.
      quickSubmitRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading || !vehicle)
    return (
      <main className="otoiz-app-shell" aria-busy="true" aria-label="Yükleniyor" style={{ fontFamily: font }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="otoiz-skeleton" style={{ height: 36, width: 200, borderRadius: 10 }} />
          <div className="otoiz-skeleton" style={{ height: 64, borderRadius: radius.md }} />
          <div className="otoiz-skeleton" style={{ height: 260, borderRadius: radius.lg }} />
        </div>
      </main>
    );

  const chipBase: React.CSSProperties = {
    padding: "14px 10px",
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    userSelect: "none",
    border: `1px solid ${colors.border}`,
    background: colors.surfaceRaised,
    color: colors.text,
    minHeight: 52,
  };

  return (
    <main className="otoiz-servis-shell" style={{ minHeight: "100vh", background: colors.bg, fontFamily: font, paddingBottom: 40 }}>
      <div className="otoiz-servis-header" style={{ position: "relative", background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}`, padding: "10px 16px 22px" }}>
        <div className="otoiz-servis-container" style={{ maxWidth: 560, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a href="/panel/dashboard" style={{ color: colors.textMuted, textDecoration: "none", fontSize: 14.5, fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 4, paddingRight: 12 }}>
              <Icon name="chevron-left" color={colors.textMuted} size={18} />
              Araçlar
            </a>
            {!isNew && (
              <button
                onClick={() => setEditingVehicle((v) => !v)}
                aria-expanded={editingVehicle}
                style={{ ...secondaryButtonStyle(), width: "auto", minHeight: 44, padding: "0 14px", fontSize: 14 }}
              >
                {editingVehicle ? "Kapat" : "Araç bilgilerini düzenle"}
              </button>
            )}
          </div>
          <h1 style={{ fontSize: isNew ? 26 : 14, fontWeight: isNew ? 800 : 700, margin: "10px 0 0", color: isNew ? colors.text : colors.textMuted, letterSpacing: isNew ? 0 : 0.4 }}>
            {isNew ? "Yeni Araç" : "Hızlı Bakım Kaydı"}
          </h1>
          {isNew && <p style={{ fontSize: 14.5, color: colors.textMuted, margin: "6px 0 0" }}>Plaka, marka ve kilometreyi girin; aracı oluşturun.</p>}
          {!isNew && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.8, color: colors.text }}>{vehicle.plate}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
                {vehicle.brand} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
              </span>
              {vehicle.current_km != null && vehicle.current_km !== "" && (
                <span style={{ fontSize: 15, fontWeight: 700, color: colors.greenLight }}>
                  {Number(vehicle.current_km).toLocaleString("tr-TR")} km
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="otoiz-servis-container otoiz-servis-grid" style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {(isNew || editingVehicle) && (
          <section className="otoiz-servis-area-edit otoiz-vehicle-shell" style={{ ...cardStyle, margin: "0 auto" }}>
            <label style={labelStyle}>Plaka</label>
            <CaretSafeInput
              data-field="plate"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={!!fieldErrors.plate}
              style={{ ...inputStyle, marginBottom: fieldErrors.plate ? 4 : 10, borderColor: fieldErrors.plate ? colors.danger : colors.border }}
              value={vehicle.plate}
              onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
            />
            {fieldErrors.plate && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>{fieldErrors.plate}</p>}
            <BrandModelPicker
              idPrefix="servis-arac"
              layout="stack"
              brand={vehicle.brand || ""}
              model={vehicle.model || ""}
              errors={{ brand: fieldErrors.brand, model: fieldErrors.model }}
              onChange={(next) => setVehicle({ ...vehicle, ...next })}
            />
            {isNew ? (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Model Yılı</label>
                  <input
                    data-field="year"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    aria-invalid={!!fieldErrors.year}
                    style={{ ...inputStyle, marginBottom: fieldErrors.year ? 4 : 14, borderColor: fieldErrors.year ? colors.danger : colors.border }}
                    value={vehicle.year || ""}
                    onChange={(e) => setVehicle({ ...vehicle, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  />
                  {fieldErrors.year && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "-10px 0 14px" }}>{fieldErrors.year}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Güncel Kilometre</label>
                  <CaretSafeInput caretChars="digits"
                    data-field="current_km"
                    type="text"
                    inputMode="numeric"
                   
                    placeholder="Örn. 52430"
                    aria-invalid={!!fieldErrors.current_km}
                    style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3, marginBottom: fieldErrors.current_km ? 4 : 14, borderColor: fieldErrors.current_km ? colors.danger : colors.border }}
                    value={formatKmInput(vehicle.current_km)}
                    onChange={(e) => setVehicle({ ...vehicle, current_km: sanitizeKmInput(e.target.value) })}
                  />
                  {fieldErrors.current_km && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "-10px 0 14px" }}>{fieldErrors.current_km}</p>}
                </div>
              </div>
            ) : (
              <>
                <label style={labelStyle}>Model Yılı</label>
                <input
                  data-field="year"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  aria-invalid={!!fieldErrors.year}
                  style={{ ...inputStyle, marginBottom: fieldErrors.year ? 4 : 14, borderColor: fieldErrors.year ? colors.danger : colors.border }}
                  value={vehicle.year || ""}
                  onChange={(e) => setVehicle({ ...vehicle, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                />
                {fieldErrors.year && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "-10px 0 14px" }}>{fieldErrors.year}</p>}
              </>
            )}

            <DocDatesFields
              idPrefix="servis-arac"
              value={vehicle}
              onChange={(key, v) => setVehicle({ ...vehicle, [key]: v })}
            />

            {isNew && (
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
                {planType === "custom" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki Bakım (km)</label>
                      <CaretSafeInput caretChars="digits"
                        data-field="next_service_km"
                        type="text"
                        inputMode="numeric"
                       
                        placeholder="Opsiyonel"
                        style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}
                        value={formatKmInput(vehicle.next_service_km || "")}
                        onChange={(e) => setVehicle({ ...vehicle, next_service_km: sanitizeKmInput(e.target.value) })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki Bakım (tarih)</label>
                      <input
                        data-field="next_service_date"
                        type="date"
                        min={todayIsoIstanbul()}
                        aria-invalid={!!fieldErrors.next_service_date}
                        style={{ ...inputStyle, borderColor: fieldErrors.next_service_date ? colors.danger : colors.border }}
                        value={vehicle.next_service_date || ""}
                        onChange={(e) => setVehicle({ ...vehicle, next_service_date: e.target.value })}
                      />
                      {fieldErrors.next_service_date && (
                        <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "4px 0 0" }}>{fieldErrors.next_service_date}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <button onClick={handleSaveVehicleInfo} disabled={savingVehicle} style={primaryButtonStyle(savingVehicle)}>
              {savingVehicle ? "Kaydediliyor…" : isNew ? "Aracı Oluştur" : "Bilgileri Kaydet"}
            </button>
          </section>
        )}

        {!isNew && (
          <section className="otoiz-servis-area-quick" data-testid="hizli-kayit" style={{ ...cardStyle, paddingBottom: 88 }}>
            {/* Aşama E — 15–20 sn akış: 1 KM → 2 işlemler → 3 sonraki bakım → KAYDET.
                Normal bakımda klavye yalnız km için açılır; geri kalan her şey dokunuş. */}
            <StepLabel n={1} text="Güncel Kilometre" />
            <CaretSafeInput caretChars="digits"
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              aria-label="Güncel kilometre"
              autoFocus
              // Mevcut km önceden dolu geliyor; odaklanınca tümü seçilsin ki
              // yazılan yeni değer eskisinin SONUNA eklenmesin (canlı testte
              // 68000 + "68500" → 6806850000 oldu).
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              style={{ ...inputStyle, fontSize: 24, fontWeight: 800, padding: 14, textAlign: "center", marginBottom: 16 }}
              value={formatKmInput(quickKm)}
              onChange={(e) => setQuickKm(sanitizeKmInput(e.target.value))}
              placeholder="Km"
            />

            <StepLabel n={2} text="Yapılan İşlemler" />
            {/* Gerçek <button> + aria-pressed: klavye/ekran okuyucu/dokunma
                hepsiyle çalışır. */}
            <div className="otoiz-quick-chips" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 8 }}>
              {[...QUICK_ITEMS, ...(showMoreItems ? MORE_ITEMS : [])].map((item) => {
                const active = !!selectedItems[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleItem(item.key)}
                    style={{
                      ...chipBase,
                      border: active ? `1px solid ${colors.green}` : chipBase.border,
                      background: active ? colors.green : colors.surfaceRaised,
                      color: active ? colors.onAccent : colors.text,
                      fontFamily: "inherit",
                    }}
                  >
                    {active && <span aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "-3px", marginRight: 4 }}><Icon name="check" color={colors.onAccent} size={16} strokeWidth={2.6} /></span>}
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={otherSelected}
                onClick={() => setOtherSelected((v) => !v)}
                style={{
                  ...chipBase,
                  border: otherSelected ? `1px solid ${colors.green}` : chipBase.border,
                  background: otherSelected ? colors.green : colors.surfaceRaised,
                  color: otherSelected ? colors.onAccent : colors.text,
                  fontFamily: "inherit",
                }}
              >
                Diğer
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowMoreItems((v) => !v)}
              style={{ background: "none", border: "none", color: colors.greenLight, fontWeight: 700, fontSize: 14, padding: "4px 0", minHeight: 44, cursor: "pointer", fontFamily: font }}
            >
              {showMoreItems ? "Daha az işlem göster" : "Daha fazla işlem (balata, triger, buji, silecek)"}
            </button>

            {otherSelected && (
              <input
                placeholder="Yapılan işlemi kısaca yazın"
                aria-label="Diğer işlem"
                style={{ ...inputStyle, marginBottom: 10 }}
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            )}

            <div style={{ marginTop: 14 }}>
              <StepLabel n={3} text="Not" optional />
            </div>
            <input
              data-testid="servis-not"
              aria-label="Not"
              placeholder="Örn. ön lastikler 3 mm"
              maxLength={200}
              style={{ ...inputStyle, marginBottom: 20 }}
              value={visitNote}
              onChange={(e) => setVisitNote(e.target.value)}
            />

            <div>
              <StepLabel n={4} text="Sonraki Bakım" />
            </div>
            <div role="radiogroup" aria-label="Sonraki bakım" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {NEXT_PLAN_OPTIONS.map((opt: any) => {
                const on = quickPlan === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setQuickPlan(opt.key)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: radius.pill,
                      border: `1px solid ${on ? colors.green : colors.border}`,
                      background: on ? colors.greenSoft : colors.surfaceRaised,
                      color: on ? colors.greenLight : colors.text,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      minHeight: 44,
                      fontFamily: "inherit",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {quickPlan === "custom" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki bakım (km)</label>
                  <CaretSafeInput caretChars="digits"
                    type="text"
                    inputMode="numeric"
                    style={{ ...inputStyle, fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}
                    value={formatKmInput(nextServiceKm)}
                    onChange={(e) => setNextServiceKm(sanitizeKmInput(e.target.value))}
                    placeholder="Örn. 95.000"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki bakım (tarih)</label>
                  <input type="date" min={todayIsoIstanbul()} style={inputStyle} value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} />
                </div>
              </div>
            )}
            <PlanPreview
              plan={
                kmValid
                  ? resolveQuickPlan({
                      planKey: quickPlan,
                      currentKm: Number(quickKm),
                      selectedItemIntervals: Object.fromEntries(
                        ALL_ITEMS.filter((it) => selectedItems[it.key] && itemIntervals[it.key]).map((it) => [it.key, itemIntervals[it.key]])
                      ),
                      customNextKm: nextServiceKm,
                      customNextDate: nextServiceDate,
                    })
                  : null
              }
              planKey={quickPlan}
            />

            <button
              type="button"
              onClick={() => setShowPlanEditor((v) => !v)}
              style={{ background: "none", border: "none", color: colors.greenLight, fontWeight: 700, fontSize: 14, padding: "6px 0", minHeight: 44, cursor: "pointer", fontFamily: font, marginBottom: showPlanEditor ? 10 : 4 }}
            >
              {showPlanEditor ? "Parça periyotlarını gizle" : "Parça periyotları"}
            </button>

            {showPlanEditor && (
              <div style={{ background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 14, marginBottom: 12 }}>
                {Object.keys(selectedItems).filter((k) => selectedItems[k]).length === 0 ? (
                  <p style={{ fontSize: 12, color: colors.textMuted, margin: 0 }}>Periyot düzenlemek için önce bir işlem seçin.</p>
                ) : (
                  ALL_ITEMS.filter((it) => selectedItems[it.key]).map((item) => (
                    <div key={item.key} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: colors.text }}>{item.label}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {PRESET_KM_OPTIONS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={itemIntervals[item.key] === String(p)}
                            onClick={() => setItemIntervals((prev) => ({ ...prev, [item.key]: String(p) }))}
                            style={{
                              fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: radius.pill, minHeight: 36,
                              border: `1px solid ${itemIntervals[item.key] === String(p) ? colors.green : colors.border}`,
                              background: itemIntervals[item.key] === String(p) ? colors.green : colors.surface,
                              color: itemIntervals[item.key] === String(p) ? colors.onAccent : colors.text,
                              cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            {p / 1000}bin km
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {submitError && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: colors.dangerSoft, border: `1px solid rgba(239,83,80,0.5)`, color: colors.text, padding: "12px 14px", borderRadius: radius.md, fontSize: 14, lineHeight: 1.45, margin: "8px 0 10px" }}>
                <Icon name="alert" color={colors.danger} size={20} />
                <p role="alert" style={{ margin: 0 }}>{submitError}</p>
              </div>
            )}
            {successMessage && (
              <div role="status" className="otoiz-enter" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", background: colors.greenSoft, border: `1px solid rgba(34,197,94,0.5)`, color: colors.greenLight, padding: "14px", borderRadius: radius.md, fontWeight: 800, fontSize: 15.5, margin: "8px 0 10px" }}>
                <Icon name="check" color={colors.greenLight} size={20} strokeWidth={2.6} />
                {successMessage.replace(/^✓\s*/, "")}
              </div>
            )}

            {/* Mobilde her zaman erişilebilir sticky Kaydet. */}
            <div
              className="otoiz-quick-save-bar"
              style={{ position: "sticky", bottom: 0, background: colors.surface, paddingTop: 10, paddingBottom: "calc(8px + env(safe-area-inset-bottom))", marginTop: 4 }}
            >
              <button
                onClick={handleQuickSave}
                disabled={submitting}
                style={{ ...primaryButtonStyle(submitting), padding: 17, fontSize: 17, minHeight: 56 }}
              >
                {submitting ? "Kaydediliyor…" : "KAYDET"}
              </button>
            </div>
          </section>
        )}

        {!isNew && (
          <div className="otoiz-servis-area-durum" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <VehicleStatusPanel
              vehicle={vehicle}
              items={maintenanceItems}
              labels={ITEM_LABELS}
              lastMuayene={statusRecords.lastMuayene}
              lastDetailing={statusRecords.lastDetailing}
              compact
            />
          </div>
        )}

        {!isNew && (
          <section className="otoiz-servis-area-qr" style={{ ...cardStyle, textAlign: "center" }}>
            <h2 style={{ fontSize: 17, color: colors.text, fontWeight: 800, margin: "0 0 14px" }}>Araç QR Kodu</h2>
            {qrCode ? (
              <>
                {/* PILOT FIX 03 (bölüm F): büyük taranabilir QR varsayılan
                    açık görünmüyor — "QR'ı Göster" ile açığa çıkıyor. */}
                {qrRevealed ? (
                  qrDataUrl ? (
                    <img src={qrDataUrl} alt="Araç QR kodu" style={{ width: 160, height: 160, borderRadius: radius.md, background: colors.white, padding: 8 }} />
                  ) : (
                    <p role="status" style={{ fontSize: 12, color: colors.danger, fontWeight: 700 }}>{QR_LOCK_MESSAGE}</p>
                  )
                ) : (
                  <div
                    style={{ width: 150, height: 150, margin: "0 auto", borderRadius: radius.md, background: colors.surfaceSoft, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-hidden="true"
                  >
                    <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>QR Atandı</span>
                  </div>
                )}
                <div style={{ margin: "8px 0" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colors.onAccent, background: colors.green, padding: "3px 10px", borderRadius: radius.pill }}>
                    QR Atandı • Aktif
                  </span>
                </div>
                {!qrRevealed && (
                  <button onClick={() => setQrRevealed(true)} style={{ ...secondaryButtonStyle(), width: "auto", padding: "0 20px", marginBottom: 8 }}>
                    QR'ı Göster
                  </button>
                )}
                {qrRevealed && qrCode && <p style={{ fontSize: 11, color: colors.textMuted, fontFamily: "monospace" }}>{qrCode}</p>}
                <p style={{ ...helperStyle, color: colors.textMuted }}>Araç el değiştirse bile bu kod ve geçmişi aynı kalır.</p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.5, margin: 0 }}>
                Bu araca henüz bir QR anahtarlık atanmamış.
                {PILOT_FLAGS.qrMatchingSelfService ? (
                  <>
                    {" "}
                    <a href="/panel/eslestir" style={{ color: colors.greenLight, fontWeight: 700 }}>Anahtarlık Eşleştir</a> sayfasından atayabilirsiniz.
                  </>
                ) : (
                  " Anahtarlık eşleştirme pilot sürecinde OTOİZ ekibi tarafından yapılır."
                )}
              </p>
            )}
          </section>
        )}

        {/* PILOT FIX 03 madde A7: self-service devir pilot boyunca
            erişilemez — CTA'nın kendisi de kaldırıldı (bkz. lib/pilotFlags.ts). */}
        {!isNew && PILOT_FLAGS.serviceOwnershipTransfer && (
          <section className="otoiz-servis-area-devret" style={{ textAlign: "center" }}>
            <a href={`/panel/araclar/${params.id}/devret`} style={{ fontSize: 13, color: colors.textMuted, textDecoration: "underline" }}>
              Bu aracın sahipliğini devret
            </a>
          </section>
        )}

        {!isNew && (
          <div className="otoiz-servis-area-gecmis">
            <VehicleTimeline supabase={supabase} vehicleId={params.id as string} audience="servis" reloadKey={revisionReload} revisions={revisions} />
          </div>
        )}
      </div>
    </main>
  );
}

function StepLabel({ n, text, optional = false }: { n: number; text: string; optional?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${colors.green}`, color: colors.greenLight, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {n}
      </span>
      <span style={{ fontSize: 15.5, fontWeight: 800, color: colors.text }}>{text}</span>
      {optional && <span style={{ fontSize: 13, color: colors.textFaint }}>(isteğe bağlı)</span>}
    </div>
  );
}

function PlanPreview({ plan, planKey }: { plan: any; planKey: string }) {
  let text = "Kilometre girin; sonraki bakım otomatik önerilir.";
  let tone: string = colors.textMuted;
  if (plan) {
    if (planKey === "later") text = "Sonraki bakım planı sonra belirlenecek.";
    else if (plan.error) {
      text = plan.error;
      tone = colors.danger;
    } else {
      const parts = [
        plan.nextServiceKm != null ? `${Number(plan.nextServiceKm).toLocaleString("tr-TR")} km` : null,
        plan.nextServiceDate ? new Date(`${plan.nextServiceDate}T12:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : null,
      ].filter(Boolean);
      text = `Sonraki bakım: ${parts.join(" · ")}`;
      tone = colors.greenLight;
    }
  }
  return (
    <p data-testid="plan-onizleme" style={{ fontSize: 14.5, fontWeight: 700, color: tone, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "12px 14px", margin: "4px 0 4px" }}>
      {text}
    </p>
  );
}
