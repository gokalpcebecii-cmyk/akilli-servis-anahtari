"use client";

// OTOİZ Nihai UX — İlk kullanım: son 12 aylık başlangıç geçmişi. Yeni araç
// oluşturulduktan hemen sonra bir kez gösterilir. Kayıtlar "Bireysel Geçmiş
// Kaydı" olarak yazılır (servis doğrulamalı DEĞİL). Sonraki bakım, periyodik
// bakım içeren en son geçmiş kaydının tarih ve km'sinden başlar. "Şimdilik
// Atla" hiçbir şey yazmadan araca geçer; sahte veri zorlanmaz.
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle, helperStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { HistoryEntryFields } from "@/components/HistoryEntryFields";
import { saveHistoryEntries, newRequestId, type HistoryEntry } from "@/lib/historySave";
const { emptyEntry, validateHistoryEntry, monthsAgoIso } = require("@/lib/history");
const { todayIsoIstanbul } = require("@/lib/logic");
const { fmtDate } = require("@/lib/vehicleStatus");

const MAX_ENTRIES = 10;

export default function GecmisBaslatPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const vehicleId = params.id as string;
  const today = todayIsoIstanbul();
  const since12 = monthsAgoIso(today, 12);

  const [vehicle, setVehicle] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<"intro" | "form" | "done">("intro");
  const [entries, setEntries] = useState<HistoryEntry[]>([emptyEntry()]);
  const [errors, setErrors] = useState<Record<number, { field: string; message: string } | null>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const requestIdsRef = useRef<string[] | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      setUserId(session.session.user.id);
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", vehicleId).single();
      if (!v || v.owner_user_id !== session.session.user.id) {
        router.push("/bireysel/araclar");
        return;
      }
      setVehicle(v);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const minDate = vehicle?.year ? `${Math.max(1950, Number(vehicle.year) - 1)}-01-01` : "2000-01-01";

  function skip() {
    router.replace(`/bireysel/araclar/${vehicleId}`);
  }

  function updateEntry(i: number, next: HistoryEntry) {
    setEntries((prev) => prev.map((e, j) => (j === i ? next : e)));
    if (errors[i]) setErrors((prev) => ({ ...prev, [i]: null }));
    // İçerik değişti: yeni gönderim yeni kayıt kimlikleriyle yapılır.
    requestIdsRef.current = null;
  }

  function addEntry() {
    if (entries.length >= MAX_ENTRIES) return;
    setEntries((prev) => [...prev, emptyEntry()]);
    requestIdsRef.current = null;
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, j) => j !== i));
    setErrors({});
    requestIdsRef.current = null;
  }

  async function save() {
    if (savingRef.current || !vehicle || !userId) return;
    setSaveError("");
    const errs: Record<number, any> = {};
    entries.forEach((e, i) => {
      const err = validateHistoryEntry(e, { today, currentKm: vehicle.current_km, minDate });
      if (err) errs[i] = err;
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const first = Math.min(...Object.keys(errs).map(Number));
      window.setTimeout(() => document.getElementById(`gecmis-${first}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (!requestIdsRef.current) requestIdsRef.current = entries.map(() => newRequestId());
      const res = await saveHistoryEntries({ supabase, vehicleId, userId, entries, requestIds: requestIdsRef.current });
      if (!res.ok) {
        setSaveError(res.message || "Kaydedilemedi.");
        return;
      }
      requestIdsRef.current = null;
      setPlan(res.plan);
      setStep("done");
      window.scrollTo({ top: 0 });
    } catch {
      setSaveError("Beklenmeyen bir bağlantı hatası oluştu. Tekrar göndermeden önce aracın geçmişini kontrol edin.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!vehicle) {
    return (
      <main className="otoiz-app-shell" aria-busy="true" aria-label="Yükleniyor" style={{ fontFamily: font }}>
        <div className="otoiz-form-shell" style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="otoiz-skeleton" style={{ height: 36, width: 200, borderRadius: 10 }} />
          <div className="otoiz-skeleton" style={{ height: 220, borderRadius: radius.lg }} />
        </div>
      </main>
    );
  }

  return (
    <main className="otoiz-app-shell" style={{ fontFamily: font, paddingBottom: 60 }}>
      <header style={{ background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}` }}>
        <div className="otoiz-form-shell" style={{ padding: "18px 16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.4 }}>{vehicle.plate}</div>
          <div style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
            {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
            {vehicle.year ? ` · ${vehicle.year}` : ""}
            {vehicle.current_km != null ? ` · ${Number(vehicle.current_km).toLocaleString("tr-TR")} km` : ""}
          </div>
        </div>
      </header>

      <div className="otoiz-form-shell" style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {step === "intro" && (
          <section data-testid="gecmis-baslat" className="otoiz-enter" style={{ ...cardStyle, padding: "26px 20px" }}>
            <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: radius.md, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon name="history" color={colors.textMuted} size={22} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text, margin: "0 0 8px", lineHeight: 1.25 }}>Aracınızın geçmişini başlatalım</h1>
            <p style={{ fontSize: 15, color: colors.textMuted, margin: "0 0 22px", lineHeight: 1.55 }}>
              Son 12 ayda yapılan önemli bakım ve işlemleri ekleyin. OTOİZ sonraki bakım takibini bu geçmişe göre başlatsın.
            </p>
            <button type="button" onClick={() => setStep("form")} style={primaryButtonStyle(false)}>
              Geçmiş Bakım Ekle
            </button>
            <button type="button" onClick={skip} style={{ ...secondaryButtonStyle(), marginTop: 10 }}>
              Şimdilik Atla
            </button>
          </section>
        )}

        {step === "form" && (
          <>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text, margin: "0 0 6px" }}>Geçmiş bakım ve işlemler</h1>
              <p style={{ ...helperStyle, fontSize: 14, color: colors.textMuted, margin: 0 }}>
                Son 12 ay: {fmtDate(since12)} – {fmtDate(today)}. Bu kayıtlar &quot;Bireysel Geçmiş Kaydı&quot; olarak görünür; servis doğrulamalı değildir.
              </p>
            </div>

            {entries.map((e, i) => (
              <section key={i} id={`gecmis-${i}`} style={{ ...cardStyle, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: 0 }}>{i + 1}. işlem</h2>
                  {entries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(i)} style={{ background: "none", border: "none", color: colors.textMuted, fontSize: 14, fontWeight: 700, minHeight: 40, cursor: "pointer", fontFamily: font }}>
                      Kaldır
                    </button>
                  )}
                </div>
                <HistoryEntryFields idPrefix={`gecmis-${i}`} entry={e} onChange={(n) => updateEntry(i, n)} today={today} minDate={minDate} error={errors[i]} />
              </section>
            ))}

            {entries.length < MAX_ENTRIES && (
              <button
                type="button"
                data-testid="bir-islem-daha"
                onClick={addEntry}
                style={{ ...secondaryButtonStyle(), borderStyle: "dashed", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                + Bir işlem daha ekle
              </button>
            )}

            {saveError && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: colors.dangerSoft, border: "1px solid rgba(239,83,80,0.5)", color: colors.text, padding: "12px 14px", borderRadius: radius.md, fontSize: 14, lineHeight: 1.45 }}>
                <Icon name="alert" color={colors.danger} size={20} />
                <p role="alert" style={{ margin: 0 }}>{saveError}</p>
              </div>
            )}

            <button type="button" onClick={save} disabled={saving} style={primaryButtonStyle(saving)}>
              {saving ? "Kaydediliyor…" : "Geçmişi Kaydet ve OTOİZ'i Başlat"}
            </button>
            <button type="button" onClick={skip} disabled={saving} style={{ background: "none", border: "none", color: colors.textMuted, fontSize: 14.5, fontWeight: 700, minHeight: 44, cursor: "pointer", fontFamily: font }}>
              Şimdilik Atla
            </button>
          </>
        )}

        {step === "done" && (
          <section data-testid="gecmis-kaydedildi" className="otoiz-enter" style={{ ...cardStyle, padding: "26px 20px" }}>
            <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: radius.md, background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon name="check" color={colors.greenLight} size={24} strokeWidth={2.6} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text, margin: "0 0 8px" }}>Geçmiş kaydedildi</h1>
            {plan ? (
              <p data-testid="gecmis-plan" style={{ fontSize: 15, color: colors.textMuted, margin: "0 0 22px", lineHeight: 1.55 }}>
                Sonraki bakım{" "}
                <strong style={{ color: colors.text }}>
                  {[plan.nextServiceKm != null ? `${Number(plan.nextServiceKm).toLocaleString("tr-TR")} km` : null, plan.nextServiceDate ? fmtDate(plan.nextServiceDate) : null].filter(Boolean).join(" · ")}
                </strong>
                . Hesap, {fmtDate(plan.fromDate)} tarihli ve {Number(plan.fromKm).toLocaleString("tr-TR")} km&apos;deki son bakım kaydınıza göre yapıldı.
              </p>
            ) : (
              <p data-testid="gecmis-plan" style={{ fontSize: 15, color: colors.textMuted, margin: "0 0 22px", lineHeight: 1.55 }}>
                Kayıtlarınız zaman çizelgesine eklendi. Periyodik bakım (yağ veya filtre) kaydı olmadığı için sonraki bakım planı değiştirilmedi.
              </p>
            )}
            <button type="button" onClick={skip} style={primaryButtonStyle(false)}>
              Aracıma Git
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
