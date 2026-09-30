"use client";

// OTOİZ — 2026-09-23: Bireysel satış. Yöneticinin bu kullanıcıya tanımladığı
// QR anahtarlığı kullanıcı burada kendi aracına bağlar. Araç zaten bağlıysa
// kodu ve herkese açık pasaport bağlantısını gösterir.
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, radius, inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle, errorTextStyle, cardStyle } from "@/lib/theme";

// Nihai UX son düzenleme: bağlı değilse normal görünüm yalnız durum, tek
// cümle ve "Anahtarlığı Bağla →". Kod alanı ancak bu düğmeyle açılır.
export default function OwnerKeychainCard({ vehicleId, onStatus, bindRequest = 0 }: { vehicleId: string; onStatus?: (active: boolean) => void; bindRequest?: number }) {
  const supabase = createBrowserSupabase();
  const [loading, setLoading] = useState(true);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [myCodes, setMyCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bindOpen, setBindOpen] = useState(false);

  // "Hızlı İşlemler > QR Yönetimi" bağlı değilse kod alanını doğrudan açar.
  useEffect(() => {
    if (bindRequest > 0) setBindOpen(true);
  }, [bindRequest]);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }

  async function load() {
    setLoading(true);
    // Aracın aktif QR'ı — sahibin kendi aracı olduğu için RLS okumaya izin verir.
    const { data: active } = await supabase
      .from("qr_keys")
      .select("code")
      .eq("vehicle_id", vehicleId)
      .is("revoked_at", null)
      .maybeSingle();
    setActiveCode(active?.code ?? null);
    onStatus?.(!!active);
    if (!active) {
      try {
        const res = await fetch("/api/bireysel/qr", { headers: await authHeader(), cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          setMyCodes(j.codes ?? []);
          if ((j.codes ?? []).length > 0) setCode(j.codes[0]);
        }
      } catch {
        // liste gelmezse kullanıcı kodu elle yazabilir
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function bind() {
    if (busy) return;
    setError("");
    setSuccess("");
    const c = code.toLowerCase().replace(/[\s-]+/g, "");
    if (!c) {
      setError("Anahtarlık kodunu girin.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bireysel/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ code: c, vehicle_id: vehicleId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.");
        return;
      }
      if (!res.ok) {
        setError(j.error || "Anahtarlık bağlanamadı.");
        return;
      }
      setSuccess("✓ Anahtarlık aracınıza bağlandı.");
      await load();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (busy) return;
    if (!window.confirm("Bu anahtarlık kalıcı olarak iptal edilecek; QR artık pasaportu açmaz. Aracınızın geçmişi korunur. Yeni anahtarlık için OTOİZ ile iletişime geçmeniz gerekir. Devam edilsin mi?")) return;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/bireysel/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ action: "revoke", vehicle_id: vehicleId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "İptal edilemedi.");
        return;
      }
      setSuccess("Anahtarlık iptal edildi.");
      await load();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <section id="anahtarlik" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0 }}>QR Durumu</h2>
        <span data-testid="anahtarlik-durum" style={{ fontSize: 12, fontWeight: 700, borderRadius: radius.pill, padding: "3px 10px", background: activeCode ? colors.green : colors.neutralSoft, color: activeCode ? colors.onAccent : colors.textMuted }}>
          {activeCode ? "Aktif" : "Bağlı değil"}
        </span>
      </div>
      {activeCode ? (
        <div>
          <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 14px", lineHeight: 1.5 }}>
            Anahtarlığınız bu araca bağlı. Kod: <code style={{ fontWeight: 700, color: colors.text }}>{activeCode}</code>
          </p>
          {success && <p role="status" style={{ color: colors.greenLight, fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>{success}</p>}
          <a
            href={`/p/${activeCode}`}
            target="_blank"
            rel="noopener"
            style={{ ...secondaryButtonStyle(), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
          >
            Dijital pasaportu aç
          </a>
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            style={{ display: "block", margin: "10px auto 0", background: "transparent", border: "none", color: colors.danger, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "10px 0", minHeight: 44, fontFamily: "inherit" }}
          >
            Anahtarlığımı kaybettim — iptal et
          </button>
          {error && <p role="alert" style={errorTextStyle}>{error}</p>}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 14px", lineHeight: 1.5 }}>OTOİZ anahtarlığınızı bu araca bağlayın.</p>
          {!bindOpen ? (
            <button
              type="button"
              data-testid="anahtarligi-bagla"
              aria-expanded={false}
              onClick={() => setBindOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, minHeight: 44, color: colors.greenLight, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
            >
              Anahtarlığı Bağla <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div data-testid="anahtarlik-kod-alani">
              {myCodes.length > 0 && (
                <p style={{ fontSize: 13.5, color: colors.textMuted, margin: "0 0 12px", lineHeight: 1.5 }}>Hesabınıza tanımlı anahtarlık kodu aşağıda seçili.</p>
              )}
              <label style={labelStyle} htmlFor="owner-qr-code">Anahtarlık kodu</label>
              {myCodes.length > 1 ? (
                <select id="owner-qr-code" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
                  {myCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  id="owner-qr-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ör. 7gs9cqmxhqmy"
                  autoCapitalize="none"
                  autoFocus
                  style={{ ...inputStyle, marginBottom: 12 }}
                />
              )}
              {success && <p role="status" style={{ color: colors.greenLight, fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>{success}</p>}
              {error && <p role="alert" style={{ ...errorTextStyle, margin: "0 0 12px" }}>{error}</p>}
              <button type="button" onClick={bind} disabled={busy} style={primaryButtonStyle(busy)}>
                {busy ? "Bağlanıyor…" : "Anahtarlığımı bu araca bağla"}
              </button>
              <button
                type="button"
                onClick={() => { setBindOpen(false); setError(""); }}
                disabled={busy}
                style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: colors.textMuted, fontSize: 14, fontWeight: 700, minHeight: 44, cursor: "pointer", fontFamily: "inherit" }}
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
