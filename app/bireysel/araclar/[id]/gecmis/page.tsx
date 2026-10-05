"use client";

// OTOİZ Nihai UX — İlk kullanım: son 12 aylık başlangıç geçmişi. Yeni araç
// oluşturulduktan hemen sonra bir kez gösterilir (ilerleme: Araç → Geçmiş →
// Hazır). Kayıtlar "Bireysel Geçmiş Kaydı" olarak yazılır (servis doğrulamalı
// DEĞİL). Eklenen her işlem özet kart olur (Düzenle / Sil). Sonraki bakım,
// periyodik bakım içeren en son geçmiş kaydının tarih ve km'sinden başlar.
// "Geçmişi bilmiyorum, şimdi başla" hiçbir şey yazmadan araca geçer; sahte
// veri zorlanmaz.
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle, helperStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { HistoryEntryFields } from "@/components/HistoryEntryFields";
import { saveHistoryEntries, newRequestId, type HistoryEntry } from "@/lib/historySave";
const { emptyEntry, validateHistoryEntry, monthsAgoIso, entrySummary, isBlankEntry } = require("@/lib/history");
const { todayIsoIstanbul } = require("@/lib/logic");
const { fmtDate } = require("@/lib/vehicleStatus");

const MAX_ENTRIES = 10;
const STEPS = ["Araç", "Geçmiş", "Hazır"];

export default function GecmisBaslatPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const vehicleId = params.id as string;
  const today = todayIsoIstanbul();
  const since12 = monthsAgoIso(today, 12);

  const [vehicle, setVehicle] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Eklenmiş (özet karta dönüşmüş) geçmiş işlemler + tek açık düzenleyici.
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [draft, setDraft] = useState<HistoryEntry>(emptyEntry());
  const [editorOpen, setEditorOpen] = useState(true);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draftError, setDraftError] = useState<{ field: string; message: string } | null>(null);
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

  function startNow() {
    router.replace(`/bireysel/araclar/${vehicleId}`);
  }

  function validate(e: HistoryEntry) {
    return validateHistoryEntry(e, { today, currentKm: vehicle.current_km, minDate });
  }

  // Açık düzenleyicideki işlemi özet karta çevirir. Dönüş: başarılı mı.
  function commitDraft(): boolean {
    const err = validate(draft);
    setDraftError(err);
    if (err) {
      window.setTimeout(() => document.getElementById("gecmis-duzenleyici")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
      return false;
    }
    setEntries((prev) => (editIndex != null ? prev.map((e, j) => (j === editIndex ? draft : e)) : [...prev, draft]));
    setDraft(emptyEntry());
    setEditIndex(null);
    setEditorOpen(false);
    requestIdsRef.current = null;
    return true;
  }

  function openNew() {
    if (entries.length >= MAX_ENTRIES) return;
    setDraft(emptyEntry());
    setDraftError(null);
    setEditIndex(null);
    setEditorOpen(true);
  }

  function editEntry(i: number) {
    if (editorOpen && !isBlankEntry(draft) && editIndex !== i && !commitDraft()) return;
    setDraft(entries[i]);
    setDraftError(null);
    setEditIndex(i);
    setEditorOpen(true);
    window.setTimeout(() => document.getElementById("gecmis-duzenleyici")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, j) => j !== i));
    if (editIndex === i) {
      setEditIndex(null);
      setDraft(emptyEntry());
      setEditorOpen(false);
    } else if (editIndex != null && editIndex > i) {
      setEditIndex(editIndex - 1);
    }
    requestIdsRef.current = null;
  }

  function cancelEdit() {
    setDraft(emptyEntry());
    setDraftError(null);
    setEditIndex(null);
    setEditorOpen(false);
  }

  async function save() {
    if (savingRef.current || !vehicle || !userId) return;
    setSaveError("");
    let list = entries;
    // Açık düzenleyicide doldurulmuş bir işlem varsa önce o eklenir.
    if (editorOpen && !isBlankEntry(draft)) {
      const err = validate(draft);
      setDraftError(err);
      if (err) {
        window.setTimeout(() => document.getElementById("gecmis-duzenleyici")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
        return;
      }
      list = editIndex != null ? entries.map((e, j) => (j === editIndex ? draft : e)) : [...entries, draft];
      setEntries(list);
      setDraft(emptyEntry());
      setEditIndex(null);
      setEditorOpen(false);
      requestIdsRef.current = null;
    }
    if (list.length === 0) {
      setSaveError("Kaydetmek için en az bir geçmiş işlem ekleyin. Geçmişi bilmiyorsanız \"Geçmişi bilmiyorum, şimdi başla\" ile devam edin.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (!requestIdsRef.current || requestIdsRef.current.length !== list.length) requestIdsRef.current = list.map(() => newRequestId());
      const res = await saveHistoryEntries({ supabase, vehicleId, userId, entries: list, requestIds: requestIdsRef.current });
      if (!res.ok) {
        setSaveError(res.message || "Kaydedilemedi.");
        return;
      }
      requestIdsRef.current = null;
      setPlan(res.plan);
      setDone(true);
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

  const current = done ? 2 : 1;

  return (
    <main className="otoiz-app-shell" style={{ fontFamily: font, paddingBottom: 60 }}>
      <header style={{ background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}` }}>
        <div className="otoiz-form-shell" style={{ padding: "16px 16px 18px" }}>
          <ol data-testid="onboarding-adimlar" aria-label="İlerleme" style={{ listStyle: "none", margin: "0 0 14px", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {STEPS.map((label, i) => {
              const state = i < current ? "done" : i === current ? "current" : "todo";
              return (
                <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < STEPS.length - 1 ? "1 1 0" : "0 0 auto", minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 26, height: 26, minWidth: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800,
                      border: `1.5px solid ${state === "todo" ? colors.border : colors.green}`,
                      background: state === "done" ? colors.green : "transparent",
                      color: state === "done" ? colors.onAccent : state === "current" ? colors.greenLight : colors.textMuted,
                    }}
                  >
                    {state === "done" ? <Icon name="check" color={colors.onAccent} size={14} /> : i + 1}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: state === "current" ? 800 : 600, color: state === "todo" ? colors.textMuted : colors.text, whiteSpace: "nowrap" }}>
                    {label}
                  </span>
                  {i < STEPS.length - 1 && <span aria-hidden="true" style={{ flex: 1, height: 1, minWidth: 8, background: i < current ? colors.green : colors.border }} />}
                </li>
              );
            })}
          </ol>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.4 }}>{vehicle.plate}</div>
          <div style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
            {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
            {vehicle.year ? ` · ${vehicle.year}` : ""}
            {vehicle.current_km != null ? ` · ${Number(vehicle.current_km).toLocaleString("tr-TR")} km` : ""}
          </div>
        </div>
      </header>

      <div className="otoiz-form-shell" style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {!done && (
          <>
            <section data-testid="gecmis-baslat" className="otoiz-enter">
              <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text, margin: "0 0 8px", lineHeight: 1.25 }}>Aracınızın geçmişini başlatalım</h1>
              <p style={{ fontSize: 15, color: colors.textMuted, margin: 0, lineHeight: 1.55 }}>
                Son 12 ayda yapılan önemli bakım ve işlemleri ekleyin. OTOİZ sonraki bakım takibini bu geçmişe göre başlatsın.
              </p>
              <p style={{ ...helperStyle, fontSize: 13.5, color: colors.textMuted, margin: "8px 0 0" }}>
                Son 12 ay: {fmtDate(since12)} – {fmtDate(today)}. Kayıtlar &quot;Bireysel Geçmiş Kaydı&quot; olarak görünür; servis doğrulamalı değildir.
              </p>
            </section>

            {entries.length > 0 && (
              <ul data-testid="gecmis-ozetler" aria-label="Eklenen geçmiş işlemler" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {entries.map((e, i) => {
                  const sum = entrySummary(e);
                  const editing = editorOpen && editIndex === i;
                  return (
                    <li key={i} data-testid="gecmis-ozet" style={{ ...cardStyle, padding: "14px 16px", borderColor: editing ? colors.green : colors.border }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>{sum.head}</div>
                      <div style={{ fontSize: 14, color: colors.textMuted, marginTop: 3, lineHeight: 1.45, overflowWrap: "anywhere" }}>{sum.items}</div>
                      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                        <button type="button" onClick={() => editEntry(i)} disabled={saving} style={linkButton(colors.text)}>
                          Düzenle
                        </button>
                        <button type="button" onClick={() => removeEntry(i)} disabled={saving} style={linkButton(colors.textMuted)}>
                          Sil
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {editorOpen ? (
              <section id="gecmis-duzenleyici" data-testid="gecmis-duzenleyici" style={{ ...cardStyle, padding: 18 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.text, margin: "0 0 14px" }}>
                  {editIndex != null ? "Geçmiş işlemi düzenle" : entries.length === 0 ? "Geçmiş işlem" : "Yeni geçmiş işlem"}
                </h2>
                <HistoryEntryFields
                  idPrefix="gecmis-0"
                  entry={draft}
                  onChange={(n) => {
                    setDraft(n);
                    if (draftError) setDraftError(null);
                  }}
                  today={today}
                  minDate={minDate}
                  error={draftError}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  {(entries.length > 0 || editIndex != null) && (
                    <button type="button" onClick={cancelEdit} disabled={saving} style={{ ...secondaryButtonStyle(), flex: 1 }}>
                      Vazgeç
                    </button>
                  )}
                  <button type="button" data-testid="islemi-ekle" onClick={commitDraft} disabled={saving} style={{ ...secondaryButtonStyle(), flex: 1 }}>
                    {editIndex != null ? "Değişikliği Kaydet" : "İşlemi Ekle"}
                  </button>
                </div>
              </section>
            ) : (
              entries.length < MAX_ENTRIES && (
                <button
                  type="button"
                  data-testid="bir-islem-daha"
                  onClick={openNew}
                  disabled={saving}
                  style={{ ...secondaryButtonStyle(), borderStyle: "dashed", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  + Bir geçmiş işlem daha ekle
                </button>
              )
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
            <button type="button" onClick={startNow} disabled={saving} style={{ background: "none", border: "none", color: colors.textMuted, fontSize: 14.5, fontWeight: 700, minHeight: 44, cursor: "pointer", fontFamily: font }}>
              Geçmişi bilmiyorum, şimdi başla
            </button>
          </>
        )}

        {done && (
          <section data-testid="gecmis-kaydedildi" className="otoiz-enter" style={{ ...cardStyle, padding: "26px 20px" }}>
            <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: radius.md, background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon name="check" color={colors.greenLight} size={24} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text, margin: "0 0 8px" }}>OTOİZ hazır</h1>
            {plan ? (
              <p data-testid="gecmis-plan" style={{ fontSize: 15, color: colors.textMuted, margin: "0 0 22px", lineHeight: 1.55 }}>
                Geçmişiniz kaydedildi. Sonraki bakım{" "}
                <strong style={{ color: colors.text }}>
                  {[plan.nextServiceKm != null ? `${Number(plan.nextServiceKm).toLocaleString("tr-TR")} km` : null, plan.nextServiceDate ? fmtDate(plan.nextServiceDate) : null].filter(Boolean).join(" · ")}
                </strong>
                . Hesap, {fmtDate(plan.fromDate)} tarihli ve {Number(plan.fromKm).toLocaleString("tr-TR")} km&apos;deki son bakım kaydınıza göre yapıldı.
              </p>
            ) : (
              <p data-testid="gecmis-plan" style={{ fontSize: 15, color: colors.textMuted, margin: "0 0 22px", lineHeight: 1.55 }}>
                Geçmişiniz kaydedildi ve zaman çizelgesine eklendi. Periyodik bakım (yağ veya filtre) kaydı olmadığı için sonraki bakım planı değiştirilmedi.
              </p>
            )}
            <button type="button" onClick={startNow} style={primaryButtonStyle(false)}>
              Aracıma Git
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function linkButton(color: string): React.CSSProperties {
  return { background: "none", border: "none", padding: 0, minHeight: 40, color, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font, textDecoration: "underline", textUnderlineOffset: 3 };
}
