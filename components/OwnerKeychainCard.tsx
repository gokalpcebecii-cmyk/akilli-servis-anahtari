"use client";

// OTOİZ — 2026-09-23: Bireysel satış. Yöneticinin bu kullanıcıya tanımladığı
// QR anahtarlığı kullanıcı burada kendi aracına bağlar. Araç zaten bağlıysa
// kodu ve herkese açık pasaport bağlantısını gösterir.
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle } from "@/lib/theme";

export default function OwnerKeychainCard({ vehicleId }: { vehicleId: string }) {
  const supabase = createBrowserSupabase();
  const [loading, setLoading] = useState(true);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [myCodes, setMyCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      <h2 style={{ fontSize: 15, fontWeight: 800, color: colors.textDark, margin: "0 0 10px" }}>QR Anahtarlık</h2>
      {activeCode ? (
        <div>
          <p style={{ fontSize: 13.5, color: colors.textDark, margin: "0 0 10px" }}>
            Anahtarlığınız bu araca bağlı: <code style={{ fontWeight: 800 }}>{activeCode}</code>
          </p>
          {success && <p role="status" style={{ color: colors.greenDark, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{success}</p>}
          <a
            href={`/p/${activeCode}`}
            target="_blank"
            rel="noopener"
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 16px", borderRadius: radius.sm, background: colors.surfaceSoft, color: colors.textDark, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}
          >
            Dijital pasaportu aç
          </a>
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            style={{ display: "block", marginTop: 12, background: "transparent", border: "none", color: colors.danger, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "10px 0", minHeight: 44, fontFamily: "inherit" }}
          >
            Anahtarlığımı kaybettim — iptal et
          </button>
          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, margin: "4px 0 0" }}>{error}</p>}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 10px" }}>
            {myCodes.length > 0
              ? "Hesabınıza tanımlı bir anahtarlık var. Bu araca bağlamak için aşağıdaki düğmeye basın."
              : "Satın aldığınız OTOİZ anahtarlığının üzerindeki kodu girerek bu araca bağlayın."}
          </p>
          <label style={labelStyle} htmlFor="owner-qr-code">Anahtarlık kodu</label>
          {myCodes.length > 1 ? (
            <select id="owner-qr-code" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
              {myCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input
              id="owner-qr-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ör. 7gs9cqmxhqmy"
              autoCapitalize="none"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
          )}
          {success && <p role="status" style={{ color: colors.greenDark, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{success}</p>}
          {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
          <button type="button" onClick={bind} disabled={busy} style={primaryButtonStyle(busy)}>
            {busy ? "Bağlanıyor…" : "Anahtarlığımı bu araca bağla"}
          </button>
        </div>
      )}
    </section>
  );
}
