"use client";

// OTOİZ — Görüş Bildir (pilot öncesi son cila). Kategori · kısa açıklama ·
// ilgili ekran · Gönder. Görüş OTOİZ ekibine (yönetim > İşlem Kaydı) iletilir.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, inputStyle, labelStyle, helperStyle, errorTextStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { BottomNav } from "@/components/BottomNav";
const { FEEDBACK_CATEGORIES, FEEDBACK_SCREENS, MESSAGE_MAX, normalizeFeedback, validateFeedbackScreenshot } = require("@/lib/feedback");

function GorusInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createBrowserSupabase();
  const initialScreen = FEEDBACK_SCREENS.some((s: any) => s.key === params.get("ekran")) ? String(params.get("ekran")) : "ana_ekran";
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [screen, setScreen] = useState(initialScreen);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/bireysel/giris");
        return;
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError("");
    if (screenshot) {
      const v = validateFeedbackScreenshot({ type: screenshot.type, size: screenshot.size });
      if (v) { setScreenshotError(v); return; }
    }
    setScreenshotError("");
    setErrors({});
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      let screenshot_path: string | null = null;
      if (screenshot && data.session) {
        const ext = (screenshot.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
        const uid = data.session.user.id;
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("pilot-feedback").upload(path, screenshot, { contentType: screenshot.type, upsert: false });
        if (up.error) {
          setScreenshotError("Görsel yüklenemedi. Daha küçük bir dosya deneyin ya da görselsiz gönderin.");
          setBusy(false);
          return;
        }
        screenshot_path = path;
      }
      const check = normalizeFeedback({ category, screen, message, screenshot_path });
      if (!check.valid) {
        setErrors(check.errors);
        setBusy(false);
        return;
      }
      const res = await fetch("/api/gorus", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify(check.value),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
        return;
      }
      if (res.status === 400 && j.errors) setErrors(j.errors);
      else if (res.status === 401) setFormError("Oturumunuz sona ermiş. Lütfen tekrar giriş yapın; yazdığınız metin bu sayfada duruyor.");
      else setFormError(j.error || "Gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
    } catch {
      setFormError("Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin; yazdığınız metin kaybolmadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="otoiz-app-shell otoiz-has-bottom-nav" style={{ fontFamily: font }}>
      <header style={{ background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}` }}>
        <div className="otoiz-page" style={{ paddingTop: 10, paddingBottom: 22 }}>
          <a href="/bireysel/araclar" style={{ fontSize: 14.5, fontWeight: 600, color: colors.textMuted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, paddingRight: 12 }}>
            <Icon name="chevron-left" color={colors.textMuted} size={18} />
            Araçlarım
          </a>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, margin: "10px 0 6px" }}>Görüş Bildir</h1>
          <p style={{ fontSize: 14.5, color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>Öneri, sorun ya da sorunuzu yazın. OTOİZ ekibi okur.</p>
        </div>
      </header>

      <div className="otoiz-page" style={{ paddingTop: 20, paddingBottom: 28 }}>
        {!ready ? (
          <div className="otoiz-skeleton" style={{ height: 320, borderRadius: radius.lg }} aria-busy="true" aria-label="Yükleniyor" />
        ) : sent ? (
          <section data-testid="gorus-basarili" role="status" className="otoiz-enter" style={{ ...cardStyle, padding: "28px 20px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: colors.greenSoft, border: `1px solid rgba(34,197,94,0.5)`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon name="check" color={colors.greenLight} size={26} strokeWidth={2.6} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: colors.text, margin: "0 0 8px" }}>Görüşünüz bize ulaştı</h2>
            <p style={{ fontSize: 14.5, color: colors.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Teşekkür ederiz. Yazdıklarınızı okuyup değerlendireceğiz.</p>
            <a href="/bireysel/araclar" style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              Araçlarıma Dön
            </a>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setMessage("");
                setCategory(null);
              }}
              style={{ ...secondaryButtonStyle(), marginTop: 10 }}
            >
              Yeni görüş yaz
            </button>
          </section>
        ) : (
          <form onSubmit={submit} noValidate data-testid="gorus-formu" style={{ ...cardStyle, padding: 20 }}>
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 20px", minWidth: 0 }}>
              <legend style={{ ...labelStyle, padding: 0 }}>Konu</legend>
              <div role="radiogroup" aria-label="Konu" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {FEEDBACK_CATEGORIES.map((c: any) => {
                  const on = category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setCategory(c.key);
                        if (errors.category) setErrors((p) => ({ ...p, category: "" }));
                      }}
                      style={{
                        minHeight: 52, borderRadius: radius.md, cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 700,
                        border: `1px solid ${on ? colors.green : errors.category ? colors.danger : colors.border}`,
                        background: on ? colors.greenSoft : colors.surfaceRaised,
                        color: on ? colors.greenLight : colors.text,
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {errors.category && <p role="alert" style={errorTextStyle}>{errors.category}</p>}
            </fieldset>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="gorus-mesaj" style={labelStyle}>Açıklama</label>
              <textarea
                id="gorus-mesaj"
                rows={5}
                maxLength={MESSAGE_MAX}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errors.message) setErrors((p) => ({ ...p, message: "" }));
                }}
                placeholder="Ne oldu, ne bekliyordunuz? Kısaca yazın."
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "gorus-mesaj-err" : "gorus-mesaj-yardim"}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
              {errors.message ? (
                <p id="gorus-mesaj-err" role="alert" style={errorTextStyle}>{errors.message}</p>
              ) : (
                <p id="gorus-mesaj-yardim" style={{ ...helperStyle, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>Kişisel bilgi (şifre, kimlik no) yazmayın.</span>
                  <span>{message.length}/{MESSAGE_MAX}</span>
                </p>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="gorus-ekran" style={labelStyle}>İlgili ekran</label>
              <select id="gorus-ekran" value={screen} onChange={(e) => setScreen(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
                {FEEDBACK_SCREENS.map((s: any) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="gorus-ekran-gorsel" style={labelStyle}>Ekran görüntüsü (isteğe bağlı)</label>
              <input
                id="gorus-ekran-gorsel"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { const f = e.target.files?.[0] ?? null; setScreenshot(f); setScreenshotError(""); }}
                style={{ fontSize: 14, color: colors.textMuted }}
              />
              <p style={{ ...helperStyle, margin: "6px 0 0" }}>JPEG, PNG veya WebP · en fazla 10 MB</p>
              {screenshot && <p style={{ fontSize: 13, color: colors.textMuted, margin: "4px 0 0" }}>{screenshot.name}</p>}
              {screenshotError && <p role="alert" style={{ color: colors.danger, fontSize: 13.5, margin: "6px 0 0" }}>{screenshotError}</p>}
            </div>

            {formError && (
              <div role="alert" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: colors.dangerSoft, border: "1px solid rgba(239,83,80,0.5)", color: colors.text, padding: "12px 14px", borderRadius: radius.md, fontSize: 14, lineHeight: 1.45, marginBottom: 14 }}>
                <Icon name="alert" color={colors.danger} size={20} />
                <span>{formError}</span>
              </div>
            )}

            <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>
              {busy ? "Gönderiliyor…" : "Gönder"}
            </button>
          </form>
        )}
      </div>

      <BottomNav active="profile" />
    </main>
  );
}

export default function GorusPage() {
  return (
    <Suspense fallback={null}>
      <GorusInner />
    </Suspense>
  );
}
