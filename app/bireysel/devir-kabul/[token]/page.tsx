"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

export default function DevirKabulPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      setLoggedIn(!!session.session);

      const { data, error: rpcError } = await supabase.rpc("preview_ownership_transfer", { p_token: token });
      if (!rpcError && data) setPreview(data);
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("accept_ownership_transfer", { p_token: token });
    setAccepting(false);

    if (rpcError || !data?.ok) {
      const msg = rpcError?.message || "";
      if (msg.includes("expired")) setError("Bu devir bağlantısının süresi dolmuş.");
      else if (msg.includes("already_accepted")) setError("Bu araç zaten devralınmış.");
      else if (msg.includes("cancelled")) setError("Bu devir iptal edilmiş.");
      else if (msg.includes("cannot_accept_own_transfer")) setError("Kendi başlattığınız bir devri kabul edemezsiniz.");
      else setError("Devir tamamlanamadı. Bağlantı geçersiz olabilir.");
      return;
    }
    setDone(data.vehicle_id);
  }

  if (loading) return <main style={{ padding: 24, fontFamily: font, color: colors.textMuted }}>Yükleniyor…</main>;

  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Icon name="check" color={colors.greenDark} size={24} />
          </div>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Devir Tamamlandı</h1>
          <p style={{ color: colors.textMuted, marginBottom: 24 }}>Araç artık hesabınıza bağlı. Bakım geçmişi aynen korundu.</p>
          <button onClick={() => router.push(`/bireysel/araclar/${done}`)} style={{ ...primaryButtonStyle(false), width: "auto", padding: "12px 24px" }}>
            Aracımı Görüntüle
          </button>
        </div>
      </main>
    );
  }

  if (!preview) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Geçersiz veya Süresi Dolmuş Bağlantı</h1>
          <p style={{ color: colors.textMuted }}>Bu devir bağlantısı artık geçerli değil.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <OtoizLogo variant="light" size={14} />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 8, textAlign: "center", color: colors.textDark, fontWeight: 800 }}>Araç Devrini Kabul Et</h1>

        <div style={{ ...cardStyle, textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: colors.textDark }}>{preview.plate}</div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>{preview.brand} {preview.model}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Güncel km: {preview.current_km?.toLocaleString("tr-TR")}</div>
        </div>

        {!loggedIn ? (
          <>
            <p style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16, textAlign: "center" }}>
              Bu aracı devralmak için önce OTOİZ hesabınızla giriş yapmalı veya hesap oluşturmalısınız.
              Giriş yaptıktan sonra bu sayfaya geri dönün.
            </p>
            <button
              onClick={() => router.push(`/bireysel/giris?next=/bireysel/devir-kabul/${token}`)}
              style={{ ...primaryButtonStyle(false), marginBottom: 10 }}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => router.push(`/bireysel/kayit?next=/bireysel/devir-kabul/${token}`)}
              style={secondaryButtonStyle()}
            >
              Hesap Oluştur
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16, textAlign: "center" }}>
              Bu aracı kabul ettiğinizde, teknik bakım geçmişi korunarak hesabınıza bağlanır.
            </p>
            {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</p>}
            <button onClick={handleAccept} disabled={accepting} style={primaryButtonStyle(accepting)}>
              {accepting ? "İşleniyor…" : "Devri Kabul Et"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
