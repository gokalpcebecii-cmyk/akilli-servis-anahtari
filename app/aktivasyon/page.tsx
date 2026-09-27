"use client";

// OTOİZ Faz 3 — self-aktivasyon.
//
// QR okut → (go.<alan-adı>/<token> → /p/<token> "Etkinleştir") →
// /aktivasyon?t=<token> → giriş/kayıt → aktivasyon kodu → araç → tamam.
// QR okutulamazsa seri no + kod ile de çalışır (/aktivasyon).
//
// Tüm güvenlik kararı veritabanında: activate_product() (SECURITY DEFINER,
// yalnız authenticated) oturum sahibini auth.uid()'den alır, e-posta
// doğrulamasını, kod özetini, deneme sınırlarını, araç sahipliğini ve
// "araçta tek aktif QR" kuralını kendisi kontrol eder. Bu sayfa yalnız
// arayüzdür; URL'de vehicle_id taşınmaz.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle, cardStyle, radius } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
const { isQrToken } = require("@/lib/qrUrl");
const { normalizeActivationCode, isActivationCode, formatActivationCode, normalizeSerial, activationErrorMessage } = require("@/lib/activationCode");

type Step = "loading" | "auth" | "code" | "vehicle" | "done";
type Vehicle = { id: string; plate: string; brand: string | null; model: string | null };

function Shell({ step, children }: { step: Step; children: React.ReactNode }) {
  const order: Step[] = ["auth", "code", "vehicle", "done"];
  const idx = Math.max(0, order.indexOf(step));
  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, color: colors.textDark }}>
      <div style={{ background: colors.bg, padding: "18px 16px 34px" }}>
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={120} />
          <h1 style={{ color: colors.textLight, fontSize: 21, fontWeight: 800, margin: "14px 0 4px" }}>Anahtarlığını etkinleştir</h1>
          <div aria-hidden style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {order.map((s, i) => (
              <span key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= idx ? colors.green : "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 420, margin: "-20px auto 0", padding: "0 16px 40px" }}>
        <div style={{ ...cardStyle, padding: 20, boxShadow: "0 12px 40px rgba(6,20,33,0.12)" }}>{children}</div>
      </div>
    </main>
  );
}

function AktivasyonInner() {
  const supabase = createBrowserSupabase();
  const params = useSearchParams();
  const rawToken = String(params.get("t") || "").toLowerCase().replace(/[\s-]+/g, "");
  const token: string | null = isQrToken(rawToken) ? rawToken : null;

  const [step, setStep] = useState<Step>("loading");
  const [serialInput, setSerialInput] = useState("");
  const [code, setCode] = useState("");
  const [serial, setSerial] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ plate: "", brand: "", model: "", year: "", current_km: "" });
  const [doneVehicle, setDoneVehicle] = useState<string | null>(null);

  const here = `/aktivasyon${token ? `?t=${token}` : ""}`;
  const identifier = token || normalizeSerial(serialInput) || "";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setStep(data.session ? "code" : "auth");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadVehicles() {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const { data } = await supabase
      .from("vehicles")
      .select("id, plate, brand, model")
      .eq("owner_user_id", u.user.id)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Vehicle[];
    setVehicles(list);
    setSelected(list.length === 1 ? list[0].id : "");
    setAdding(list.length === 0);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const c = normalizeActivationCode(code);
    if (!identifier) return setError("Anahtarlığın arkasındaki seri numarasını girin (ör. OTZ-000123).");
    if (!isActivationCode(c)) return setError("Aktivasyon kodu 12 karakterdir (ör. ABCD-EFGH-JKMN).");
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("activate_product", { p_identifier: identifier, p_code: c, p_vehicle_id: null });
    setBusy(false);
    if (rpcErr || !data?.ok) return setError(activationErrorMessage(data?.error));
    setSerial(data.serial_no ?? null);
    await loadVehicles();
    setStep("vehicle");
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      let vehicleId = selected;
      if (adding) {
        const { data: s } = await supabase.auth.getSession();
        const res = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
          body: JSON.stringify(nv),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          const fe = j?.errors ? Object.values(j.errors)[0] : null;
          setError(String(fe || j?.error || "Araç eklenemedi."));
          return;
        }
        vehicleId = j?.vehicle?.id;
        await loadVehicles();
        setAdding(false);
        setSelected(vehicleId);
      }
      if (!vehicleId) {
        setError("Bir araç seçin ya da yeni araç ekleyin.");
        return;
      }
      const { data, error: rpcErr } = await supabase.rpc("activate_product", {
        p_identifier: identifier,
        p_code: normalizeActivationCode(code),
        p_vehicle_id: vehicleId,
      });
      if (rpcErr || !data?.ok) {
        setError(activationErrorMessage(data?.error));
        return;
      }
      setDoneVehicle(vehicleId);
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  if (step === "loading") {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;
  }

  if (step === "auth") {
    const next = encodeURIComponent(here);
    return (
      <Shell step={step}>
        <p style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
          Aracının dijital servis pasaportuna bağlamak için önce OTOİZ hesabınla giriş yap. Hesabın yoksa bir dakikada oluştur.
        </p>
        <a href={`/bireysel/giris?next=${next}`} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginBottom: 10 }}>
          Giriş yap
        </a>
        <a href={`/bireysel/kayit?next=${next}`} style={{ ...secondaryButtonStyle(), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          Hesap oluştur
        </a>
      </Shell>
    );
  }

  if (step === "code") {
    return (
      <Shell step={step}>
        <form onSubmit={verifyCode}>
          {!token && (
            <>
              <label style={labelStyle} htmlFor="akt-seri">Seri numarası</label>
              <input id="akt-seri" value={serialInput} onChange={(e) => setSerialInput(e.target.value)} placeholder="OTZ-000123"
                autoCapitalize="characters" autoComplete="off" style={{ ...inputStyle, marginBottom: 14 }} />
            </>
          )}
          <label style={labelStyle} htmlFor="akt-kod">Aktivasyon kodu</label>
          <input
            id="akt-kod"
            value={code}
            onChange={(e) => setCode(formatActivationCode(e.target.value).slice(0, 14))}
            placeholder="ABCD-EFGH-JKMN"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            style={{ ...inputStyle, fontSize: 20, letterSpacing: 2, fontWeight: 800, textAlign: "center", marginBottom: 8 }}
          />
          <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 14px" }}>Kod, anahtarlığın paketindeki kartta yazar.</p>
          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13.5, margin: "0 0 12px" }}>{error}</p>}
          <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>{busy ? "Kontrol ediliyor…" : "Devam"}</button>
        </form>
      </Shell>
    );
  }

  if (step === "vehicle") {
    return (
      <Shell step={step}>
        <form onSubmit={finish}>
          <p style={{ margin: "0 0 12px", fontWeight: 700 }}>Kod doğru{serial ? ` (${serial})` : ""}. Hangi araca bağlayalım?</p>
          {vehicles.map((v) => (
            <label key={v.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", minHeight: 48, marginBottom: 8, cursor: "pointer",
              border: `1.5px solid ${!adding && selected === v.id ? colors.greenDark : colors.border}`, borderRadius: radius.md,
            }}>
              <input type="radio" name="arac" checked={!adding && selected === v.id} onChange={() => { setAdding(false); setSelected(v.id); }} />
              <span><strong>{v.plate}</strong> <span style={{ color: colors.textMuted, fontSize: 13 }}>{[v.brand, v.model].filter(Boolean).join(" ")}</span></span>
            </label>
          ))}
          {vehicles.length > 0 && !adding && (
            <button type="button" onClick={() => { setAdding(true); setSelected(""); }} style={{ ...secondaryButtonStyle(), marginBottom: 12 }}>
              + Yeni araç ekle
            </button>
          )}
          {adding && (
            <div style={{ background: colors.surfaceSoft, borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="nv-plate">Plaka</label>
              <input id="nv-plate" value={nv.plate} onChange={(e) => setNv({ ...nv, plate: e.target.value })} placeholder="34 ABC 123" autoCapitalize="characters" style={{ ...inputStyle, marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="nv-brand">Marka</label>
                  <input id="nv-brand" value={nv.brand} onChange={(e) => setNv({ ...nv, brand: e.target.value })} style={{ ...inputStyle, marginBottom: 10 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="nv-model">Model</label>
                  <input id="nv-model" value={nv.model} onChange={(e) => setNv({ ...nv, model: e.target.value })} style={{ ...inputStyle, marginBottom: 10 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="nv-year">Model yılı</label>
                  <input id="nv-year" inputMode="numeric" value={nv.year} onChange={(e) => setNv({ ...nv, year: e.target.value.replace(/\D/g, "") })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="nv-km">Güncel km</label>
                  <input id="nv-km" inputMode="numeric" value={nv.current_km} onChange={(e) => setNv({ ...nv, current_km: e.target.value.replace(/\D/g, "") })} style={inputStyle} />
                </div>
              </div>
              {vehicles.length > 0 && (
                <button type="button" onClick={() => setAdding(false)} style={{ background: "none", border: "none", color: colors.textMuted, marginTop: 8, padding: 8, cursor: "pointer" }}>
                  Vazgeç, mevcut aracımı seçeceğim
                </button>
              )}
            </div>
          )}
          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13.5, margin: "0 0 12px" }}>{error}</p>}
          <button type="submit" disabled={busy} style={primaryButtonStyle(busy)}>{busy ? "Bağlanıyor…" : "Etkinleştir"}</button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell step={step}>
      <div style={{ textAlign: "center" }}>
        <div aria-hidden style={{ width: 56, height: 56, borderRadius: 28, background: colors.greenSoft, color: colors.greenDark, fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>✓</div>
        <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>Tamam! Anahtarlığın etkin.</h2>
        <p style={{ color: colors.textMuted, margin: "0 0 18px", lineHeight: 1.5 }}>
          Artık QR'ı okutan herkes aracının servis pasaportunu görür; plaka gizli kalır.
        </p>
        <a href={doneVehicle ? `/bireysel/araclar/${doneVehicle}` : "/bireysel/araclar"} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          Aracıma git
        </a>
      </div>
    </Shell>
  );
}

export default function AktivasyonPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Yükleniyor…</main>}>
      <AktivasyonInner />
    </Suspense>
  );
}
