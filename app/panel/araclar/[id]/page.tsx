"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const {
  validateVehicleInput,
  computeMaintenancePlan,
  isValidNextServiceKm,
  isValidNextServiceDate,
  isValidCurrentKmUpdate,
  computeAutoNextServicePlan,
  todayIsoIstanbul,
} = require("@/lib/logic");

// Kilometre input'ları için: yalnızca rakam, baştaki gereksiz sıfırlar
// temizlenir. Bireysel formuyla aynı davranış (PILOT FIX 03 madde A3).
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

const QUICK_ITEMS = [
  { key: "motor_yagi", label: "Motor Yağı" },
  { key: "yag_filtresi", label: "Yağ Filtresi" },
  { key: "hava_filtresi", label: "Hava Filtresi" },
  { key: "polen_filtresi", label: "Polen Filtresi" },
  { key: "fren_on_balata", label: "Ön Balata" },
  { key: "fren_arka_balata", label: "Arka Balata" },
  { key: "lastik", label: "Lastik" },
  { key: "aku", label: "Akü" },
];

// Bir işlem seçildiğinde "önerilen periyot otomatik atansın" (madde C) —
// bu varsayılanlar Planı Düzenle'de her zaman değiştirilebilir.
const DEFAULT_INTERVALS: Record<string, number> = {
  motor_yagi: 10000,
  yag_filtresi: 10000,
  hava_filtresi: 15000,
  polen_filtresi: 15000,
  fren_on_balata: 20000,
  fren_arka_balata: 20000,
  lastik: 40000,
  aku: 30000,
};

const PRESET_KM_OPTIONS = [5000, 10000, 15000, 20000, 30000];

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "yeni";
  const supabase = createBrowserSupabase();

  const [vehicle, setVehicle] = useState<any>(
    isNew ? { plate: "", brand: "", model: "", year: "", current_km: "", next_service_km: "", next_service_date: "" } : null
  );
  const [records, setRecords] = useState<any[]>([]);
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
  const [nextServiceKm, setNextServiceKm] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const quickSubmitRef = useRef(false);

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
      const publicUrl = `${window.location.origin}/p/${qrKey.code}`;
      const qr = await QRCode.toDataURL(publicUrl, { width: 200 });
      setQrDataUrl(qr);
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
          }),
        });
        json = await res.json();
        if (!res.ok) {
          savingRef.current = false;
          setSavingVehicle(false);
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
      savingRef.current = false;
      setSavingVehicle(false);
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

    // İkinci düzeltme turu (madde 8): "Planı düzenle" manuel tarihi de
    // input'un native min'inin ötesinde sunucuyla birebir aynı kontrolden
    // geçiyor.
    if (nextServiceDate && !isValidNextServiceDate(nextServiceDate, todayIso)) {
      setSubmitError("Sonraki bakım tarihi geçmişte olamaz.");
      return;
    }

    const selectedKeys = QUICK_ITEMS.filter((it) => selectedItems[it.key]).map((it) => it.key);

    // Otomatik öneri: varsayılan +10.000 km / 12 ay taban, seçili
    // işlemlerden biri DAHA ERKEN bir vadeye işaret ediyorsa o kazanır.
    // Manuel "Planı düzenle" girişi YALNIZCA kullanıcı GERÇEKTEN
    // doldurduysa (alan boş değilse) bu otomatik öneriyi ezer — sayfa
    // yüklemesinde bu alanlar artık ESKİ plandan DOLDURULMUYOR (yukarıda),
    // bu yüzden "boş" güvenilir biçimde "henüz dokunulmadı" anlamına gelir.
    const selectedIntervals: Record<string, string> = {};
    for (const key of selectedKeys) {
      if (itemIntervals[key]) selectedIntervals[key] = itemIntervals[key];
    }
    const autoPlan = computeAutoNextServicePlan({ currentKm: km, today: todayIso, selectedItemIntervals: selectedIntervals });
    const manualNextKmProvided = nextServiceKm !== "" && nextServiceKm != null;
    const manualNextDateProvided = nextServiceDate !== "" && nextServiceDate != null;
    const finalNextKm = manualNextKmProvided ? Number(nextServiceKm) : autoPlan.nextServiceKm;
    const finalNextDate = manualNextDateProvided ? nextServiceDate : autoPlan.nextServiceDate;

    if (!isValidNextServiceKm(km, finalNextKm)) {
      setSubmitError("Sonraki bakım kilometresi, güncel kilometreden büyük olmalı.");
      return;
    }

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
      // Supabase session, staff/tenant, araç güncelleme, maintenance_items
      // ve maintenance_records hataları AYRI AYRI kontrol edilir — herhangi
      // biri başarısız olursa sonraki adıma geçilmez ve "Kayıt tamamlandı"
      // GÖSTERİLMEZ.
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) {
        setSubmitError("Oturum bilgisi alınamadı." + RETRY_MESSAGE);
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff_users")
        .select("tenant_id")
        .eq("id", session.session.user.id)
        .single();
      // Yalnızca staff nesnesi değil, tenant_id'nin KENDİSİ de zorunlu —
      // tenant_id boş/null ise HİÇBİR yazma yapılmaz (aşağıdaki vehicles
      // güncellemesi de tenant_id'ye bağlı olduğundan bu kontrol olmadan
      // sorgu geçersiz bir filtreyle çalışırdı).
      if (staffError || !staff || !staff.tenant_id) {
        setSubmitError("Servis/personel bilgisi doğrulanamadı." + RETRY_MESSAGE);
        return;
      }
      const tenantId = staff.tenant_id;
      const actorId = session.session.user.id;

      // Araç güncellemesi TENANT KAPSAMINA bağlanır: hem id hem tenant_id
      // filtrelenir VE güncellemenin GERÇEKTEN bir satır döndürdüğü
      // doğrulanır (`.select("id")` ile) — hata dönmese bile eşleşen/
      // güncellenen satır yoksa (ör. araç başka bir tenant'a aitse, RLS
      // sessizce 0 satır etkiler) işlem yetkisiz/başarısız kabul edilir.
      const { data: updatedVehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .update({
          current_km: km,
          next_service_km: finalNextKm,
          next_service_date: finalNextDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .eq("tenant_id", tenantId)
        .select("id");
      if (vehicleError || !updatedVehicle || updatedVehicle.length === 0) {
        setSubmitError("Araç bulunamadı veya bu araca erişim yetkiniz yok." + RETRY_MESSAGE);
        return;
      }

      if (selectedKeys.length > 0) {
        const itemsUpsert = selectedKeys.map((key) => ({
          vehicle_id: params.id,
          item_key: key,
          last_service_date: todayIso,
          last_service_km: km,
          interval_km: itemIntervals[key] ? Number(itemIntervals[key]) : null,
        }));
        const { error: itemsError } = await supabase.from("maintenance_items").upsert(itemsUpsert, { onConflict: "vehicle_id,item_key" });
        if (itemsError) {
          setSubmitError("Bakım kalemleri kaydedilemedi." + RETRY_MESSAGE);
          return;
        }
      }

      // İkinci düzeltme turu, madde 7: aynı anda seçilen birden fazla işlem
      // (ör. Motor Yağı + Yağ Filtresi) geçmişte AYRI satırlar olarak değil,
      // TEK bir servis ziyareti altında (tek maintenance_records satırı,
      // birleştirilmiş açıklama) kaydedilmeli — şema/migration değişikliği
      // olmadan bunu sağlayan tek yol, tek satıra birleştirilmiş açıklama.
      // maintenance_items (her işlemin kendi periyodu/son bakımı) yine de
      // işlem başına ayrı ayrı güncelleniyor, yukarıda değişmedi.
      const visitLabels = selectedKeys.map((key) => QUICK_ITEMS.find((it) => it.key === key)?.label ?? key);
      if (otherSelected && otherText.trim()) {
        visitLabels.push(otherText.trim());
      }
      if (visitLabels.length > 0) {
        const { error: recordError } = await supabase.from("maintenance_records").insert([
          {
            vehicle_id: params.id,
            tenant_id: tenantId,
            description: visitLabels.join(", "),
            km_at_service: km,
            created_by: actorId,
          },
        ]);
        if (recordError) {
          setSubmitError("Servis kaydı oluşturulamadı." + RETRY_MESSAGE);
          return;
        }
      }

      // Yazmalar tamamlandı — ekranı yenileyen okuma sorgularının
      // hataları da kontrol edilir. Yazmalar BAŞARILI olduğu için burada
      // bir hata, "kayıt başarısız" DEĞİL, "kayıt olmuş olabilir ama ekran
      // güncel değil" anlamına gelir — bu YÜZDEN normal başarı mesajı
      // GÖSTERİLMEZ, form verileri TEMİZLENMEZ (kullanıcı ne seçtiğini
      // kaybetmesin, gerekirse manuel sayfa yenilemesiyle devam etsin).
      const { data: mi, error: miError } = await supabase.from("maintenance_items").select("*").eq("vehicle_id", params.id);
      const { data: r, error: rError } = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", params.id)
        .order("service_date", { ascending: false });
      if (miError || rError) {
        setSubmitError("Kayıt kaydedilmiş olabilir ancak ekran yenilenemedi. Yeniden göndermeyin; sayfayı yenileyin.");
        return;
      }

      setMaintenanceItems(mi ?? []);
      setRecords(r ?? []);
      setVehicle((prev: any) => ({ ...prev, current_km: km, next_service_km: finalNextKm, next_service_date: finalNextDate }));

      setSelectedItems({});
      setItemIntervals({});
      setOtherSelected(false);
      setOtherText("");
      setNextServiceKm("");
      setNextServiceDate("");
      setSuccessMessage("✓ Kayıt tamamlandı");
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

  if (loading || !vehicle) return <main style={{ padding: 24, fontFamily: font, color: colors.textMuted }}>Yükleniyor…</main>;

  const chipBase: React.CSSProperties = {
    padding: "16px 10px",
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    userSelect: "none",
    border: `2px solid ${colors.border}`,
    background: colors.surfaceLight,
    color: colors.textDark,
    minHeight: 52,
  };

  return (
    <main className="otoiz-servis-shell" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, paddingBottom: 40 }}>
      <div className="otoiz-hero-pattern otoiz-servis-header" style={{ position: "relative", overflow: "hidden", background: colors.surfaceDark, padding: "16px 18px 22px" }}>
        <div className="otoiz-reflection" aria-hidden="true" />
        <div className="otoiz-servis-container" style={{ maxWidth: 560, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a href="/panel/dashboard" aria-label="Geri" style={{ color: colors.textLight, textDecoration: "none", fontSize: 18, padding: 4 }}>
              ←
            </a>
            {!isNew && (
              <button
                onClick={() => setEditingVehicle((v) => !v)}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", color: colors.textLight, fontSize: 12.5, cursor: "pointer", padding: "8px 12px", borderRadius: radius.sm }}
              >
                {editingVehicle ? "Kapat" : "Araç bilgilerini düzenle"}
              </button>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <OtoizLogo variant="dark" size={155} />
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "6px 0 0", color: colors.textLight }}>
            {isNew ? "Yeni Araç" : "Hızlı Bakım Kaydı"}
          </h1>
          {!isNew && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{vehicle.plate}</div>}
        </div>
      </div>

      <div className="otoiz-servis-container otoiz-servis-grid" style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {(isNew || editingVehicle) && (
          <section className="otoiz-servis-area-edit otoiz-vehicle-shell" style={{ ...cardStyle, margin: "0 auto" }}>
            <label style={labelStyle}>Plaka</label>
            <input
              data-field="plate"
              aria-invalid={!!fieldErrors.plate}
              style={{ ...inputStyle, marginBottom: fieldErrors.plate ? 4 : 10, borderColor: fieldErrors.plate ? colors.danger : colors.border }}
              value={vehicle.plate}
              onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
            />
            {fieldErrors.plate && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>{fieldErrors.plate}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Marka</label>
                <input
                  data-field="brand"
                  aria-invalid={!!fieldErrors.brand}
                  style={{ ...inputStyle, marginBottom: fieldErrors.brand ? 4 : 10, borderColor: fieldErrors.brand ? colors.danger : colors.border }}
                  value={vehicle.brand || ""}
                  onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                />
                {fieldErrors.brand && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>{fieldErrors.brand}</p>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Model</label>
                <input
                  data-field="model"
                  aria-invalid={!!fieldErrors.model}
                  style={{ ...inputStyle, marginBottom: fieldErrors.model ? 4 : 10, borderColor: fieldErrors.model ? colors.danger : colors.border }}
                  value={vehicle.model || ""}
                  onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                />
                {fieldErrors.model && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 10px" }}>{fieldErrors.model}</p>}
              </div>
            </div>
            {isNew ? (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Model Yılı</label>
                  <input
                    data-field="year"
                    type="number"
                    aria-invalid={!!fieldErrors.year}
                    style={{ ...inputStyle, marginBottom: fieldErrors.year ? 4 : 14, borderColor: fieldErrors.year ? colors.danger : colors.border }}
                    value={vehicle.year || ""}
                    onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                  />
                  {fieldErrors.year && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "-10px 0 14px" }}>{fieldErrors.year}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Güncel Kilometre</label>
                  <input
                    data-field="current_km"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Örn. 52430"
                    aria-invalid={!!fieldErrors.current_km}
                    style={{ ...inputStyle, marginBottom: fieldErrors.current_km ? 4 : 14, borderColor: fieldErrors.current_km ? colors.danger : colors.border }}
                    value={vehicle.current_km}
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
                  type="number"
                  aria-invalid={!!fieldErrors.year}
                  style={{ ...inputStyle, marginBottom: fieldErrors.year ? 4 : 14, borderColor: fieldErrors.year ? colors.danger : colors.border }}
                  value={vehicle.year || ""}
                  onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                />
                {fieldErrors.year && <p role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "-10px 0 14px" }}>{fieldErrors.year}</p>}
              </>
            )}

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
                      <input
                        data-field="next_service_km"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Opsiyonel"
                        style={inputStyle}
                        value={vehicle.next_service_km || ""}
                        onChange={(e) => setVehicle({ ...vehicle, next_service_km: sanitizeKmInput(e.target.value) })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki Bakım (tarih)</label>
                      <input
                        data-field="next_service_date"
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
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

            <button onClick={handleSaveVehicleInfo} disabled={savingVehicle} style={{ ...primaryButtonStyle(savingVehicle), width: "auto", padding: "10px 20px" }}>
              {savingVehicle ? "Kaydediliyor…" : isNew ? "Aracı Oluştur" : "Bilgileri Kaydet"}
            </button>
          </section>
        )}

        {!isNew && (
          <section className="otoiz-servis-area-quick" style={{ ...cardStyle, paddingBottom: 88 }}>
            <label style={{ ...labelStyle, fontSize: 13.5 }}>Güncel Kilometre</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              style={{ ...inputStyle, fontSize: 24, fontWeight: 800, padding: 16, textAlign: "center", marginBottom: 16 }}
              value={quickKm}
              onChange={(e) => setQuickKm(sanitizeKmInput(e.target.value))}
              placeholder="Km"
            />

            <label style={{ ...labelStyle, fontSize: 13.5, marginBottom: 10, display: "block" }}>Yapılan İşlemler</label>
            {/* Gerçek <button> + aria-pressed: klavye/ekran okuyucu/dokunma
                hepsiyle çalışır (madde C). Periyot seçici artık burada
                değil, "Planı düzenle" altında — varsayılan görünüm sade. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 10 }}>
              {QUICK_ITEMS.map((item) => {
                const active = !!selectedItems[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleItem(item.key)}
                    style={{
                      ...chipBase,
                      border: active ? `2px solid ${colors.greenDark}` : chipBase.border,
                      background: active ? colors.greenDark : colors.surfaceLight,
                      color: active ? colors.textLight : colors.textDark,
                      fontFamily: "inherit",
                    }}
                  >
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
                  gridColumn: "span 2",
                  border: otherSelected ? `2px solid ${colors.greenDark}` : chipBase.border,
                  background: otherSelected ? colors.greenDark : colors.surfaceLight,
                  color: otherSelected ? colors.textLight : colors.textDark,
                  fontFamily: "inherit",
                }}
              >
                Diğer
              </button>
            </div>

            {otherSelected && (
              <input
                placeholder="Yapılan işlemi kısaca yazın"
                style={{ ...inputStyle, marginBottom: 10 }}
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            )}

            <button
              type="button"
              onClick={() => setShowPlanEditor((v) => !v)}
              style={{ background: "none", border: "none", color: colors.greenDark, fontWeight: 700, fontSize: 12.5, padding: "6px 0", cursor: "pointer", marginBottom: showPlanEditor ? 10 : 4 }}
            >
              {showPlanEditor ? "Planı düzenle ▲" : "Planı düzenle ▾"}
            </button>

            {showPlanEditor && (
              <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: 12, marginBottom: 12 }}>
                {Object.keys(selectedItems).filter((k) => selectedItems[k]).length === 0 ? (
                  <p style={{ fontSize: 12, color: colors.textMuted, margin: 0 }}>Periyot düzenlemek için önce bir işlem seçin.</p>
                ) : (
                  QUICK_ITEMS.filter((it) => selectedItems[it.key]).map((item) => (
                    <div key={item.key} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.textDark }}>{item.label}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {PRESET_KM_OPTIONS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={itemIntervals[item.key] === String(p)}
                            onClick={() => setItemIntervals((prev) => ({ ...prev, [item.key]: String(p) }))}
                            style={{
                              fontSize: 11, padding: "5px 9px", borderRadius: radius.pill, minHeight: 28,
                              border: itemIntervals[item.key] === String(p) ? `1.5px solid ${colors.greenDark}` : `1px solid ${colors.border}`,
                              background: itemIntervals[item.key] === String(p) ? colors.greenDark : colors.surfaceLight,
                              color: itemIntervals[item.key] === String(p) ? "#fff" : colors.textDark,
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
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki Bakım (km, manuel)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      style={inputStyle}
                      value={nextServiceKm}
                      onChange={(e) => setNextServiceKm(sanitizeKmInput(e.target.value))}
                      placeholder="Otomatik önerilir"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: colors.textMuted }}>Sonraki Bakım (tarih)</label>
                    <input type="date" min={new Date().toISOString().slice(0, 10)} style={inputStyle} value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {submitError && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 10 }}>{submitError}</p>}
            {successMessage && (
              <div style={{ background: colors.greenSoft, color: colors.greenDark, padding: "10px 14px", borderRadius: radius.sm, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>
                {successMessage}
              </div>
            )}

            {/* Mobilde her zaman erişilebilir sticky Kaydet (madde C). */}
            <div
              className="otoiz-quick-save-bar"
              style={{ position: "sticky", bottom: 0, background: colors.surfaceLight, paddingTop: 10, marginTop: 4 }}
            >
              <button
                onClick={handleQuickSave}
                disabled={submitting}
                style={{ ...primaryButtonStyle(submitting), padding: 17, fontSize: 16, minHeight: 48 }}
              >
                {submitting ? "Kaydediliyor…" : "KAYDET"}
              </button>
            </div>
          </section>
        )}

        {!isNew && (
          <section className="otoiz-servis-area-qr" style={{ ...cardStyle, textAlign: "center" }}>
            <h2 style={{ fontSize: 14, color: colors.textMuted, fontWeight: 700, marginTop: 0 }}>Araç QR Kodu</h2>
            {qrDataUrl ? (
              <>
                {/* PILOT FIX 03 (bölüm F): büyük taranabilir QR varsayılan
                    açık görünmüyor — "QR'ı Göster" ile açığa çıkıyor. */}
                {qrRevealed ? (
                  <img src={qrDataUrl} alt="Araç QR kodu" style={{ width: 150, height: 150, borderRadius: radius.md }} />
                ) : (
                  <div
                    style={{ width: 150, height: 150, margin: "0 auto", borderRadius: radius.md, background: colors.surfaceSoft, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-hidden="true"
                  >
                    <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>QR Atandı</span>
                  </div>
                )}
                <div style={{ margin: "8px 0" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colors.greenDark, background: colors.greenSoft, padding: "4px 10px", borderRadius: radius.pill }}>
                    QR Atandı • Aktif
                  </span>
                </div>
                {!qrRevealed && (
                  <button onClick={() => setQrRevealed(true)} style={{ ...primaryButtonStyle(false), width: "auto", padding: "8px 18px", marginBottom: 8 }}>
                    QR'ı Göster
                  </button>
                )}
                {qrRevealed && qrCode && <p style={{ fontSize: 11, color: colors.textMuted, fontFamily: "monospace" }}>{qrCode}</p>}
                <p style={{ fontSize: 12, color: colors.textMuted }}>Bu kodu anahtarlığa/NFC etikete işleyin. Araç el değiştirse bile bu kod ve geçmişi aynı kalır.</p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: colors.textMuted }}>
                Bu araca henüz bir QR anahtarlık atanmamış.
                {PILOT_FLAGS.qrMatchingSelfService ? (
                  <>
                    {" "}
                    <a href="/panel/eslestir" style={{ color: colors.greenDark, fontWeight: 700 }}>Anahtarlık Eşleştir</a> sayfasından atayabilirsiniz.
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
        {!isNew && PILOT_FLAGS.ownershipTransferSelfService && (
          <section className="otoiz-servis-area-devret" style={{ textAlign: "center" }}>
            <a href={`/panel/araclar/${params.id}/devret`} style={{ fontSize: 13, color: colors.textMuted, textDecoration: "underline" }}>
              Bu aracın sahipliğini devret
            </a>
          </section>
        )}

        {!isNew && (
          <section className="otoiz-servis-area-gecmis" style={cardStyle}>
            <h2 style={{ fontSize: 14, color: colors.textMuted, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>Geçmiş</h2>
            {records.length === 0 ? (
              <p style={{ fontSize: 13, color: colors.textMuted }}>Henüz kayıt yok.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {records.map((r) => (
                  <li key={r.id} style={{ borderBottom: `1px solid ${colors.border}`, padding: "9px 0", fontSize: 13.5, color: colors.textDark }}>
                    {new Date(r.service_date).toLocaleDateString("tr-TR")} — {r.description} {r.km_at_service ? `(${r.km_at_service.toLocaleString("tr-TR")} km)` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
