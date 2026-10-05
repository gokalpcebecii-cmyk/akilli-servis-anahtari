"use client";

// OTOİZ — Hızlı İşlem Alanı. Araç ekranında TEK kart ("Hızlı İşlemler" +
// "İşlem Ekle"); basınca alt pencere açılır: "Ne eklemek istiyorsunuz?" →
// 4 işlem (Bakım Kaydı, KM, Belge, Tarihler). Her işlemin kısa formu aynı
// pencerede açılır; kayıttan sonra kullanıcı araç ekranında kalır ve kısa
// bir başarı bildirimi görür.
import { useEffect, useRef, useState } from "react";
import { colors, font, radius, inputStyle, labelStyle, helperStyle, errorTextStyle, primaryButtonStyle, secondaryButtonStyle, cardStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { CaretSafeInput } from "@/components/CaretSafeInput";
import { ItemChipGrid } from "@/components/ItemChipGrid";
import { DocDatesFields, DOC_DATE_FIELDS } from "@/components/DocDatesFields";
import { saveHistoryEntries, newRequestId } from "@/lib/historySave";
const { ITEM_LABELS, CHIP_LABELS, DEFAULT_INTERVALS } = require("@/lib/maintenanceItems");
const { isValidCurrentKmUpdate, isValidDocDate, todayIsoIstanbul } = require("@/lib/logic");
const {
  OWNER_ACTION_KEYS,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_NOTE_MAX,
  DOC_ACCEPT,
  checkDocumentFile,
  documentPath,
  fmtSize,
  validateMaintenanceAction,
  nextServiceSuggestion,
  visitNextValues,
} = require("@/lib/quickActions");

export type QuickStep = "menu" | "bakim" | "km" | "belge" | "tarih";

const OPTIONS: { key: Exclude<QuickStep, "menu">; title: string; desc: string; icon: string }[] = [
  { key: "bakim", title: "Bakım Kaydı Ekle", desc: "Yapılan bakım işlemlerini kaydedin.", icon: "wrench" },
  { key: "km", title: "KM Güncelle", desc: "Aracın güncel kilometresini yazın.", icon: "gauge" },
  { key: "belge", title: "Belge Ekle", desc: "Fatura, servis fişi veya diğer belgeleri yükleyin.", icon: "document" },
  { key: "tarih", title: "Tarihleri Güncelle", desc: "Muayene, kasko ve trafik sigortası tarihlerini güncelleyin.", icon: "calendar" },
];

const OWNER_ITEMS: { key: string; label: string }[] = OWNER_ACTION_KEYS.map((k: string) => ({ key: k, label: CHIP_LABELS[k] || ITEM_LABELS[k] }));

function fmtKm(v: any) {
  const d = String(v ?? "").replace(/\D/g, "");
  return d ? Number(d).toLocaleString("tr-TR") : "";
}
function digits(raw: string) {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}
function fmtIsoDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}

// ---------------------------------------------------------------------------
// 1) Araç ekranındaki sabit kart
// ---------------------------------------------------------------------------
export function QuickActionCard({ onOpen, onHistory }: { onOpen: () => void; onHistory: () => void }) {
  return (
    <section data-testid="hizli-islemler" aria-labelledby="hizli-islemler-baslik" className="otoiz-qa-card" style={{ fontFamily: font }}>
      <h2 id="hizli-islemler-baslik" style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: 0, letterSpacing: 0.1 }}>
        Hızlı İşlemler
      </h2>
      <p style={{ fontSize: 14.5, color: colors.textMuted, margin: "6px 0 16px", lineHeight: 1.5 }}>
        Bakım, kilometre, belge ve önemli tarihleri buradan kolayca yönetin.
      </p>
      <button
        type="button"
        data-testid="islem-ekle"
        onClick={onOpen}
        className="otoiz-qa-cta"
        style={{ ...primaryButtonStyle(false), minHeight: 54, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 22px rgba(34,197,94,0.22)" }}
      >
        <Icon name="plus" color={colors.onAccent} size={20} strokeWidth={2.6} />
        İşlem Ekle
      </button>
      <button
        type="button"
        data-testid="gecmis-islem-kisayol"
        onClick={onHistory}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 2, width: "100%", minHeight: 52, marginTop: 8, padding: "6px 0", background: "none", border: "none", cursor: "pointer", fontFamily: font, textAlign: "left" }}
      >
        <span style={{ flex: "1 1 220px", fontSize: 13, color: colors.textFaint, lineHeight: 1.4, minWidth: 0 }}>Son 12 aya ait bir işlem eklemek ister misiniz?</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 13.5, fontWeight: 700, color: colors.greenLight, whiteSpace: "nowrap" }}>
          Geçmiş İşlem Ekle
          <Icon name="chevron-right" color={colors.greenLight} size={16} />
        </span>
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Başarı bildirimi
// ---------------------------------------------------------------------------
export function SuccessToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" data-testid="basari-bildirimi" className="otoiz-toast" style={{ fontFamily: font }}>
      <span style={{ width: 28, height: 28, borderRadius: "50%", background: colors.green, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name="check" color={colors.onAccent} size={16} strokeWidth={3} />
      </span>
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) "İşlem Ekle" alt penceresi
// ---------------------------------------------------------------------------
type SheetProps = {
  open: boolean;
  initialStep?: QuickStep;
  onClose: () => void;
  supabase: any;
  vehicle: any;
  userId: string | null;
  maintenanceItems: any[];
  onVehiclePatch: (patch: Record<string, any>) => void;
  onMaintenanceSaved: () => Promise<void> | void;
  onDocumentSaved: () => void;
  onSuccess: (message: string) => void;
};

export function QuickActionSheet(props: SheetProps) {
  const { open, initialStep = "menu", onClose } = props;
  const [step, setStep] = useState<QuickStep>(initialStep);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  // Adım değişince odak başlığa (klavye kendiliğinden açılmaz).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-sheet-title]")?.focus(), 40);
    const body = panelRef.current?.querySelector(".otoiz-sheet-body");
    if (body) body.scrollTop = 0;
    return () => window.clearTimeout(t);
  }, [open, step]);

  if (!open) return null;
  const opt = OPTIONS.find((o) => o.key === step);
  const title = step === "menu" ? "Ne eklemek istiyorsunuz?" : opt!.title;
  const done = (msg: string) => {
    props.onSuccess(msg);
    onClose();
  };
  const safeClose = () => {
    if (!busy) onClose();
  };

  return (
    <div className="otoiz-sheet-root" style={{ fontFamily: font }}>
      <div className="otoiz-sheet-backdrop" aria-hidden="true" onClick={safeClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otoiz-sheet-title"
        data-testid="islem-ekle-pencere"
        data-step={step}
        tabIndex={-1}
        className={`otoiz-sheet-panel${step === "menu" ? "" : " is-form"}`}
      >
        <div className="otoiz-sheet-grab" aria-hidden="true" />
        <div className="otoiz-sheet-head">
          {step !== "menu" && (
            <button type="button" onClick={() => !busy && setStep("menu")} aria-label="Geri" style={roundBtn}>
              <Icon name="chevron-left" color={colors.text} size={20} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="otoiz-sheet-title" data-sheet-title tabIndex={-1} style={{ fontSize: 19, fontWeight: 700, color: colors.text, margin: 0, outline: "none", lineHeight: 1.25 }}>
              {title}
            </h2>
            <div style={{ fontSize: 13, color: colors.textFaint, marginTop: 2, letterSpacing: 0.3 }}>
              <strong style={{ color: colors.textMuted, fontWeight: 700 }}>{props.vehicle.plate}</strong>
              {props.vehicle.current_km != null && props.vehicle.current_km !== "" ? ` · ${Number(props.vehicle.current_km).toLocaleString("tr-TR")} km` : ""}
            </div>
          </div>
          <button type="button" onClick={safeClose} aria-label="Kapat" style={roundBtn}>
            <Icon name="close" color={colors.text} size={18} />
          </button>
        </div>
        <div className="otoiz-sheet-body">
          <div key={step} className="otoiz-sheet-step">
            {step === "menu" && (
              <div className="otoiz-qa-options" role="list">
                {OPTIONS.map((o) => (
                  <button key={o.key} type="button" role="listitem" data-action={o.key} className="otoiz-qa-option" onClick={() => setStep(o.key)}>
                    <span className="otoiz-qa-icon" aria-hidden="true">
                      <Icon name={o.icon} color={colors.greenLight} size={22} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: colors.text, lineHeight: 1.25 }}>{o.title}</span>
                      <span style={{ display: "block", fontSize: 13.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.45 }}>{o.desc}</span>
                    </span>
                    <span className="otoiz-qa-chev" aria-hidden="true" style={{ flex: "none" }}>
                      <Icon name="chevron-right" color={colors.textFaint} size={18} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === "bakim" && <MaintenanceForm {...props} setBusy={setBusy} done={done} />}
            {step === "km" && <KmForm {...props} setBusy={setBusy} done={done} />}
            {step === "belge" && <DocumentForm {...props} setBusy={setBusy} done={done} />}
            {step === "tarih" && <DatesForm {...props} setBusy={setBusy} done={done} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const roundBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  flex: "none",
  borderRadius: "50%",
  border: `1px solid ${colors.border}`,
  background: colors.surfaceRaised,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

type FormProps = SheetProps & { setBusy: (b: boolean) => void; done: (msg: string) => void };

function Field({ label, optional, htmlFor, children, hint, error }: { label: string; optional?: boolean; htmlFor?: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
        {optional && <span style={{ color: colors.textFaint, fontWeight: 500 }}> (isteğe bağlı)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" style={errorTextStyle}>{error}</p>
      ) : hint ? (
        <p style={helperStyle}>{hint}</p>
      ) : null}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" style={{ ...errorTextStyle, background: colors.dangerSoft, border: "1px solid rgba(239,83,80,0.45)", borderRadius: radius.md, padding: "10px 12px", margin: "0 0 14px", color: colors.text }}>
      {message}
    </p>
  );
}

function SubmitButton({ busy, label, busyLabel = "Kaydediliyor…", onClick, testId }: { busy: boolean; label: string; busyLabel?: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={busy} className="otoiz-qa-cta" style={{ ...primaryButtonStyle(busy), minHeight: 54, marginTop: 4 }}>
      {busy ? busyLabel : label}
    </button>
  );
}

// A) Bakım Kaydı Ekle -------------------------------------------------------
function MaintenanceForm({ supabase, vehicle, userId, maintenanceItems, onVehiclePatch, onMaintenanceSaved, setBusy, done }: FormProps) {
  const today = todayIsoIstanbul();
  const [date, setDate] = useState(today);
  const [km, setKm] = useState(vehicle.current_km != null && vehicle.current_km !== "" ? String(vehicle.current_km) : "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{ field: string; message: string } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const reqRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  const items = OWNER_ACTION_KEYS.filter((k: string) => selected[k]);
  const minDate = vehicle.year ? `${Math.max(1950, Number(vehicle.year) - 1)}-01-01` : "2000-01-01";
  const isToday = date === today;

  function intervalFor(k: string): number | null {
    const ex = maintenanceItems.find((m: any) => m.item_key === k);
    if (ex?.interval_km) return Number(ex.interval_km);
    return DEFAULT_INTERVALS[k] ?? null;
  }
  const suggestion = isToday ? nextServiceSuggestion({ items, km, today, intervalFor }) : null;

  function touch() {
    if (err) setErr(null);
    if (saveError) setSaveError("");
    reqRef.current = null;
  }

  async function save() {
    if (savingRef.current) return;
    setSaveError("");
    const entry = { date, km, items, otherOn, otherText, note };
    const v = validateMaintenanceAction(entry, { today, currentKm: vehicle.current_km, minDate });
    setErr(v);
    if (v) return;
    if (!userId) {
      setSaveError("Oturum bilgisi alınamadı. Sayfayı yenileyin.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setBusy(true);
    try {
      if (!reqRef.current) reqRef.current = newRequestId();
      const kmNum = Number(km);
      if (isToday) {
        // Bugün yapılan bakım: tek transaction (record_service_visit).
        const next = visitNextValues({ suggestion, km: kmNum, today, existingKm: vehicle.next_service_km, existingDate: vehicle.next_service_date });
        const labels = items.map((k: string) => ITEM_LABELS[k] || k);
        if (otherOn && otherText.trim()) labels.push(otherText.trim().replace(/\s+/g, " ").slice(0, 80));
        const noteText = note.trim().replace(/\s+/g, " ").slice(0, 200);
        const { error } = await supabase.rpc("record_service_visit", {
          p_vehicle_id: vehicle.id,
          p_km: kmNum,
          p_items: items.map((k: string) => ({ key: k, interval_km: intervalFor(k) })),
          p_description: labels.join(", ") + (noteText ? ` — Not: ${noteText}` : ""),
          p_next_km: next.rpc.km,
          p_next_date: next.rpc.date,
          p_request_id: reqRef.current,
        });
        if (error) {
          const msg = String(error.message || "");
          setSaveError(
            msg.includes("km_lower_than_current")
              ? "Kilometre, kayıtlı son kilometreden düşük olamaz."
              : msg.includes("rate_limited") || msg.includes("Çok fazla")
              ? "Çok fazla işlem yapıldı. Lütfen biraz sonra tekrar deneyin."
              : "Kayıt yapılamadı; hiçbir değişiklik kaydedilmedi. Tekrar deneyin."
          );
          return;
        }
        let patch: Record<string, any> = { current_km: kmNum, next_service_km: next.rpc.km, next_service_date: next.rpc.date };
        if (next.restore) {
          // Mevcut (geride kalmış) plan aynen korunur.
          const { error: rErr } = await supabase.from("vehicles").update({ ...next.restore, updated_at: new Date().toISOString() }).eq("id", vehicle.id);
          if (!rErr) patch = { ...patch, ...next.restore };
        }
        onVehiclePatch(patch);
      } else {
        // Geçmiş tarihli bakım: "Bireysel Geçmiş Kaydı" (mevcut akış).
        const res = await saveHistoryEntries({ supabase, vehicleId: vehicle.id, userId, entries: [{ date, km, items, otherOn, otherText, note }], requestIds: [reqRef.current] });
        if (!res.ok) {
          setSaveError(res.message || "Kaydedilemedi.");
          return;
        }
        if (res.plan) onVehiclePatch({ next_service_km: res.plan.nextServiceKm, next_service_date: res.plan.nextServiceDate });
      }
      reqRef.current = null;
      await onMaintenanceSaved();
      done("Bakım kaydı eklendi.");
    } catch {
      setSaveError("Bağlantı hatası. Tekrar göndermeden önce geçmişi kontrol edin.");
    } finally {
      savingRef.current = false;
      setSaving(false);
      setBusy(false);
    }
  }

  return (
    <div data-testid="form-bakim">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Field label="Tarih" htmlFor="qa-bakim-tarih" error={err?.field === "date" ? err.message : undefined}>
          <input
            id="qa-bakim-tarih"
            type="date"
            max={today}
            min={minDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              touch();
            }}
            aria-invalid={err?.field === "date"}
            style={{ ...inputStyle, borderColor: err?.field === "date" ? colors.danger : colors.border }}
          />
        </Field>
        <Field label="Kilometre" htmlFor="qa-bakim-km" error={err?.field === "km" ? err.message : undefined}>
          <CaretSafeInput
            caretChars="digits"
            id="qa-bakim-km"
            inputMode="numeric"
            enterKeyHint="done"
            value={fmtKm(km)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setKm(digits(e.target.value));
              touch();
            }}
            aria-invalid={err?.field === "km"}
            style={{ ...inputStyle, fontWeight: 700, fontSize: 17, borderColor: err?.field === "km" ? colors.danger : colors.border }}
          />
        </Field>
      </div>
      {!isToday && date && (
        <p data-testid="gecmis-tarih-notu" style={{ ...helperStyle, margin: "-8px 0 16px", color: colors.textMuted }}>
          Geçmiş tarihli kayıt, sizin beyanınızla Bireysel Geçmiş Kaydı olarak eklenir.
        </p>
      )}

      <div style={{ ...labelStyle, marginBottom: 8 }}>Yapılan İşlemler</div>
      <ItemChipGrid
        items={OWNER_ITEMS}
        selected={selected}
        onToggle={(k) => {
          setSelected((s) => ({ ...s, [k]: !s[k] }));
          touch();
        }}
        otherOn={otherOn}
        onToggleOther={() => {
          setOtherOn((v) => !v);
          touch();
        }}
        otherText={otherText}
        onOtherText={(t) => {
          setOtherText(t);
          touch();
        }}
        otherPlaceholder="Ör. Klima gazı dolumu"
      />
      {err?.field === "items" && <p role="alert" style={errorTextStyle}>{err.message}</p>}

      <div style={{ height: 18 }} />
      <Field label="Not" optional htmlFor="qa-bakim-not">
        <input id="qa-bakim-not" maxLength={200} placeholder="Örn. yetkili serviste yapıldı" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
      </Field>

      {suggestion && (
        <div data-testid="sonraki-bakim-onerisi" style={{ display: "flex", alignItems: "center", gap: 12, background: colors.greenSoft, border: "1px solid rgba(34,197,94,0.35)", borderRadius: radius.md, padding: "12px 14px", margin: "0 0 18px" }}>
          <Icon name="clock" color={colors.greenLight} size={20} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>Sonraki bakım önerisi</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: colors.text, marginTop: 2 }}>
              {Number(suggestion.nextServiceKm).toLocaleString("tr-TR")} km · {fmtIsoDate(suggestion.nextServiceDate)}
            </span>
          </span>
        </div>
      )}

      <FormError message={saveError} />
      <SubmitButton busy={saving} label="Bakım Kaydını Ekle" onClick={save} testId="bakim-kaydet" />
    </div>
  );
}

// B) KM Güncelle -------------------------------------------------------------
function KmForm({ supabase, vehicle, onVehiclePatch, setBusy, done }: FormProps) {
  const [draft, setDraft] = useState(vehicle.current_km != null && vehicle.current_km !== "" ? String(vehicle.current_km) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const n = Number(draft);
    if (!draft || !Number.isFinite(n) || n <= 0) {
      setError("Geçerli bir kilometre girin.");
      return;
    }
    if (!isValidCurrentKmUpdate(vehicle.current_km, n)) {
      setError(`Kilometre, kayıtlı son kilometreden (${Number(vehicle.current_km).toLocaleString("tr-TR")} km) düşük olamaz.`);
      return;
    }
    setSaving(true);
    setBusy(true);
    const { error: upErr } = await supabase.from("vehicles").update({ current_km: n, updated_at: new Date().toISOString() }).eq("id", vehicle.id);
    setSaving(false);
    setBusy(false);
    if (upErr) {
      setError("Kaydedilemedi; kilometre değişmedi. Tekrar deneyin.");
      return;
    }
    onVehiclePatch({ current_km: n });
    done("Kilometre güncellendi.");
  }

  return (
    <div data-testid="form-km">
      <label htmlFor="km-guncelle" style={labelStyle}>Güncel kilometre</label>
      <CaretSafeInput
        caretChars="digits"
        id="km-guncelle"
        inputMode="numeric"
        enterKeyHint="done"
        value={fmtKm(draft)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setDraft(digits(e.target.value));
          if (error) setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        aria-invalid={!!error}
        style={{ ...inputStyle, fontSize: 26, fontWeight: 700, textAlign: "center", minHeight: 64, letterSpacing: 0.5, borderColor: error ? colors.danger : colors.border }}
      />
      {vehicle.current_km != null && vehicle.current_km !== "" && (
        <p style={{ ...helperStyle, textAlign: "center", margin: "10px 0 0" }}>Kayıtlı: {Number(vehicle.current_km).toLocaleString("tr-TR")} km</p>
      )}
      {error && <p role="alert" style={{ ...errorTextStyle, textAlign: "center", margin: "10px 0 0" }}>{error}</p>}
      <div style={{ height: 22 }} />
      <SubmitButton busy={saving} label="Kilometreyi Güncelle" onClick={save} testId="km-kaydet" />
    </div>
  );
}

// C) Belge Ekle --------------------------------------------------------------
function DocumentForm({ supabase, vehicle, userId, onDocumentSaved, setBusy, done }: FormProps) {
  const today = todayIsoIstanbul();
  const [docType, setDocType] = useState<string>("");
  const [docDate, setDocDate] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [typeError, setTypeError] = useState("");
  const [dateError, setDateError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pick(f: File | null) {
    setSaveError("");
    if (!f) return;
    const chk = checkDocumentFile(f);
    if (!chk.ok) {
      setFile(null);
      setFileError(chk.error);
      return;
    }
    setFileError("");
    setFile(f);
  }

  async function save() {
    if (saving) return;
    setSaveError("");
    let bad = false;
    if (!docType) {
      setTypeError("Belge tipini seçin.");
      bad = true;
    }
    if (docDate && (!isValidDocDate(docDate) || docDate > today)) {
      setDateError("Belge tarihi ileri bir tarih olamaz.");
      bad = true;
    }
    const chk = file ? checkDocumentFile(file) : { ok: false, error: "Yüklenecek dosyayı seçin." };
    if (!chk.ok) {
      setFileError(chk.error);
      bad = true;
    }
    if (bad) return;
    if (!userId) {
      setSaveError("Oturum bilgisi alınamadı. Sayfayı yenileyin.");
      return;
    }
    setSaving(true);
    setBusy(true);
    try {
      const path = documentPath(vehicle.id, newRequestId(), chk.ext);
      const { error: upErr } = await supabase.storage.from("vehicle-documents").upload(path, file, { contentType: chk.mime, upsert: false, cacheControl: "3600" });
      if (upErr) {
        setSaveError("Dosya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.");
        return;
      }
      const { error: insErr } = await supabase.from("vehicle_documents").insert({
        vehicle_id: vehicle.id,
        uploaded_by: userId,
        doc_type: docType,
        doc_date: docDate || null,
        note: note.trim().replace(/\s+/g, " ").slice(0, DOC_NOTE_MAX) || null,
        storage_path: path,
        file_name: String(file!.name).slice(0, 200),
        mime_type: chk.mime,
        size_bytes: chk.size,
      });
      if (insErr) {
        const msg = String(insErr.message || "");
        setSaveError(msg.includes("rate_limited") || msg.includes("Çok fazla") ? "Çok fazla belge eklendi. Lütfen biraz sonra tekrar deneyin." : "Belge kaydedilemedi. Tekrar deneyin.");
        return;
      }
      onDocumentSaved();
      done("Belge eklendi.");
    } catch {
      setSaveError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setSaving(false);
      setBusy(false);
    }
  }

  return (
    <div data-testid="form-belge">
      <div style={{ ...labelStyle, marginBottom: 8 }} id="qa-belge-tip-baslik">Belge tipi</div>
      <div role="radiogroup" aria-labelledby="qa-belge-tip-baslik" className="otoiz-doc-types">
        {DOC_TYPES.map((t: { key: string; label: string }) => {
          const on = docType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setDocType(t.key);
                setTypeError("");
              }}
              style={{
                minHeight: 52,
                padding: "8px 12px",
                borderRadius: radius.sm,
                border: `1px solid ${on ? colors.green : colors.border}`,
                background: on ? colors.greenSoft : colors.surfaceRaised,
                color: on ? colors.text : colors.textMuted,
                fontSize: 14,
                fontWeight: on ? 800 : 600,
                fontFamily: font,
                cursor: "pointer",
                lineHeight: 1.2,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {typeError && <p role="alert" style={errorTextStyle}>{typeError}</p>}
      <div style={{ height: 18 }} />

      <Field label="Tarih" optional htmlFor="qa-belge-tarih" error={dateError || undefined}>
        <input
          id="qa-belge-tarih"
          type="date"
          max={today}
          value={docDate}
          onChange={(e) => {
            setDocDate(e.target.value);
            setDateError("");
          }}
          style={inputStyle}
        />
      </Field>
      <Field label="Kısa açıklama / not" optional htmlFor="qa-belge-not">
        <input id="qa-belge-not" maxLength={DOC_NOTE_MAX} placeholder="Örn. 60.000 km bakım faturası" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
      </Field>

      <div style={{ ...labelStyle, marginBottom: 8 }}>Dosya</div>
      <input
        ref={fileRef}
        id="qa-belge-dosya"
        data-testid="belge-dosya"
        type="file"
        accept={DOC_ACCEPT}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
        tabIndex={-1}
      />
      <button
        type="button"
        data-testid="belge-dosya-sec"
        onClick={() => fileRef.current?.click()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          minHeight: 72,
          padding: "14px 16px",
          borderRadius: radius.md,
          border: `1.5px dashed ${fileError ? colors.danger : file ? colors.green : "#3a4352"}`,
          background: file ? colors.greenSoft : colors.bgAlt,
          color: colors.text,
          cursor: "pointer",
          fontFamily: font,
          textAlign: "left",
        }}
      >
        <span className="otoiz-qa-icon" aria-hidden="true" style={{ width: 42, height: 42 }}>
          <Icon name={file ? "document" : "upload"} color={colors.greenLight} size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {file ? (
            <>
              <span data-testid="secilen-dosya" style={{ display: "block", fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
              <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{fmtSize(file.size)} · Değiştirmek için dokunun</span>
            </>
          ) : (
            <>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>Dosya Seç</span>
              <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>PDF veya fotoğraf · en fazla 10 MB</span>
            </>
          )}
        </span>
      </button>
      {fileError && <p role="alert" style={errorTextStyle}>{fileError}</p>}
      <div style={{ height: 20 }} />
      <FormError message={saveError} />
      <SubmitButton busy={saving} label="Belgeyi Ekle" busyLabel="Yükleniyor…" onClick={save} testId="belge-kaydet" />
    </div>
  );
}

// D) Tarihleri Güncelle ------------------------------------------------------
function DatesForm({ supabase, vehicle, onVehiclePatch, setBusy, done }: FormProps) {
  const [draft, setDraft] = useState<Record<string, string>>({
    muayene_tarihi: vehicle.muayene_tarihi || "",
    kasko_bitis: vehicle.kasko_bitis || "",
    trafik_sigortasi_bitis: vehicle.trafik_sigortasi_bitis || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    for (const f of DOC_DATE_FIELDS) {
      if (!isValidDocDate(draft[f.key])) {
        setError(`${f.label} geçerli bir tarih olmalı.`);
        return;
      }
    }
    setError("");
    setSaving(true);
    setBusy(true);
    const patch = {
      muayene_tarihi: draft.muayene_tarihi || null,
      kasko_bitis: draft.kasko_bitis || null,
      trafik_sigortasi_bitis: draft.trafik_sigortasi_bitis || null,
    };
    const { error: upErr } = await supabase.from("vehicles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", vehicle.id);
    setSaving(false);
    setBusy(false);
    if (upErr) {
      setError("Kaydedilemedi; tarihler değişmedi. Tekrar deneyin.");
      return;
    }
    onVehiclePatch(patch);
    done("Tarihler güncellendi.");
  }

  return (
    <div data-testid="form-tarih">
      <DocDatesFields idPrefix="qa-tarih" hideLegend value={draft} onChange={(key, v) => setDraft((d) => ({ ...d, [key]: v }))} />
      <FormError message={error} />
      <SubmitButton busy={saving} label="Tarihleri Kaydet" onClick={save} testId="tarih-kaydet" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarihler sekmesi: eklenen belgeler (yalnız sahibine, kısa ömürlü bağlantı)
// ---------------------------------------------------------------------------
// Belge listesi + sunucuda imzalanan bağlantılar + silme. Hem araç
// ekranındaki "Belgeler" kartı hem ana ekrandaki "Belgelerim" bölümü
// aynı kaynağı kullanır (erişim kuralı sunucuda, değişmedi).
export function useVehicleDocuments(supabase: any, vehicleId: string | null, reloadKey: number) {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      // Önce depolamadaki dosya, sonra kayıt. Silme politikaları yalnız
      // aracın güncel sahibinin kendi belgesine izin verir.
      const { error: rmErr } = await supabase.storage.from("vehicle-documents").remove([deleteTarget.storage_path]);
      if (rmErr) {
        setDeleteError("Dosya silinemedi. Bağlantınızı kontrol edip tekrar deneyin.");
        return;
      }
      const { error: delErr } = await supabase.from("vehicle_documents").delete().eq("id", deleteTarget.id);
      if (delErr) {
        setDeleteError("Belge kaydı silinemedi. Sayfayı yenileyip tekrar deneyin.");
        return;
      }
      setDocs((prev) => (prev ? prev.filter((d) => d.id !== deleteTarget.id) : prev));
      setDeleteTarget(null);
    } catch {
      setDeleteError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!vehicleId) return;
    let alive = true;
    (async () => {
      // Belgeler sunucu API'sinden: RLS ile yalnız kendi belgeleriniz ve
      // kabul edilmiş devirde size açıkça aktarılanlar döner. Dosya
      // bağlantısı da sunucuda, belge erişimi doğrulandıktan sonra imzalanır.
      let data: any[] | null = null;
      let token = "";
      try {
        const { data: s } = await supabase.auth.getSession();
        token = s.session?.access_token ?? "";
        const res = await fetch(`/api/belgeler?vehicle_id=${encodeURIComponent(vehicleId as string)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (res.ok) data = ((await res.json()).documents ?? []).slice(0, 50);
      } catch {
        data = null;
      }
      if (!alive) return;
      if (!data) {
        setError(true);
        setDocs([]);
        return;
      }
      setError(false);
      setDocs(data);
      if (data.length) {
        try {
          const res = await fetch("/api/belgeler/baglanti", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ document_ids: data.map((d: any) => d.id) }),
          });
          const body = res.ok ? await res.json() : { urls: {} };
          if (!alive) return;
          setUrls(body.urls ?? {});
        } catch {
          // bağlantılar üretilemezse "Aç" pasif kalır
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [vehicleId, reloadKey]);

  return { docs, urls, error, deleteTarget, setDeleteTarget, deleting, deleteError, setDeleteError, confirmDelete };
}

export function VehicleDocuments({ supabase, vehicleId, reloadKey, onAdd }: { supabase: any; vehicleId: string; reloadKey: number; onAdd: () => void }) {
  const { docs, urls, error, deleteTarget, setDeleteTarget, deleting, deleteError, setDeleteError, confirmDelete } = useVehicleDocuments(supabase, vehicleId, reloadKey);

  return (
    <section data-testid="belgeler" style={{ background: colors.surface, borderRadius: radius.lg, border: `1px solid ${colors.border}`, padding: 18, color: colors.text }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Belgeler</h2>
        <button
          type="button"
          onClick={onAdd}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", borderRadius: radius.md, border: `1px solid ${colors.border}`, background: colors.surfaceRaised, color: colors.text, fontSize: 14, fontWeight: 700, fontFamily: font, cursor: "pointer" }}
        >
          <Icon name="plus" color={colors.greenLight} size={16} strokeWidth={2.6} />
          Belge Ekle
        </button>
      </div>
      {docs === null ? (
        <div className="otoiz-skeleton" style={{ height: 60, borderRadius: radius.md }} />
      ) : docs.length === 0 ? (
        <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>
          {error ? "Belgeler şu an yüklenemedi." : "Fatura, servis fişi veya sigorta belgelerinizi burada saklayabilirsiniz."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => {
            const url = urls[d.id];
            const when = d.doc_date ? fmtIsoDate(d.doc_date) : new Date(d.created_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
            return (
              <div
                key={d.id}
                data-testid="belge-satir"
                style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "10px 12px", borderRadius: radius.sm, background: colors.surfaceRaised, color: colors.text }}
              >
                <a
                  href={url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!url}
                  aria-label={`${DOC_TYPE_LABELS[d.doc_type] || "Belge"} aç`}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, color: colors.text, textDecoration: "none" }}
                >
                  <Icon name="document" color={colors.greenLight} size={20} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{DOC_TYPE_LABELS[d.doc_type] || "Belge"}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: colors.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[when, fmtSize(d.size_bytes), d.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: url ? colors.greenLight : colors.textFaint, whiteSpace: "nowrap" }}>Aç</span>
                </a>
                {d.own && (
                <button
                  type="button"
                  data-testid="belge-sil"
                  aria-label={`${DOC_TYPE_LABELS[d.doc_type] || "Belge"} sil`}
                  onClick={() => { setDeleteError(""); setDeleteTarget(d); }}
                  style={{ minWidth: 56, minHeight: 44, padding: "0 10px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: "transparent", color: colors.danger, fontSize: 13.5, fontWeight: 700, fontFamily: font, cursor: "pointer" }}
                >
                  Sil
                </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <DocumentDeleteDialog target={deleteTarget} deleting={deleting} error={deleteError} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={confirmDelete} />
    </section>
  );
}

// Belge silme onayı (metinler değişmedi).
export function DocumentDeleteDialog({ target, deleting, error, onCancel, onConfirm }: { target: any | null; deleting: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  if (!target) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="belge-sil-baslik" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 80 }}>
      <div style={{ ...cardStyle, width: "100%", maxWidth: 380, padding: 22 }}>
        <h3 id="belge-sil-baslik" style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>Belgeyi sil</h3>
        <p style={{ fontSize: 14.5, color: colors.textMuted, margin: "0 0 18px", lineHeight: 1.5 }}>Bu belgeyi silmek istediğinizden emin misiniz?</p>
        {error && <p role="alert" style={{ color: colors.danger, fontSize: 13.5, margin: "0 0 12px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} disabled={deleting} style={{ ...secondaryButtonStyle(), flex: 1 }}>
            İptal
          </button>
          <button
            type="button"
            data-testid="belge-sil-onay"
            onClick={onConfirm}
            disabled={deleting}
            style={{ flex: 1, minHeight: 48, borderRadius: radius.md, border: "none", background: colors.danger, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: font, cursor: deleting ? "wait" : "pointer", opacity: deleting ? 0.7 : 1 }}
          >
            {deleting ? "Siliniyor…" : "Belgeyi Sil"}
          </button>
        </div>
      </div>
    </div>
  );
}
