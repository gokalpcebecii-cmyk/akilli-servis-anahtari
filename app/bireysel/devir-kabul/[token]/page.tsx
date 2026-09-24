"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

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
      // 04A-S takip turu: erken JSX return'ü yalnızca render'ı kapatıyordu —
      // bu effect hook sırası gereği yine de çalışıp session/RPC isteği
      // gönderiyordu. Bayrak kapalıyken HİÇBİR Supabase çağrısı yapılmadan
      // (session dahil) doğrudan çıkılır.
      if (!PILOT_FLAGS.ownershipTransferSelfService) {
        setLoading(false);
        return;
      }

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
      else if (msg.includes("staff_account_cannot_own")) setError("Servis hesabıyla araç devralınamaz; bireysel hesabınızla giriş yapın.");
      else setError("Devir tamamlanamadı. Bağlantı geçersiz olabilir.");
      return;
    }
    setDone(data.vehicle_id);
  }

  // 04A-S turu bulgusu: bu sayfa, karşı sayfalardan (devret) farklı olarak
  // hiçbir PILOT_FLAGS kapısı arkasında değildi — initiate tarafı kapalı
  // olsa bile, önceden üretilmiş geçerli bir token linkiyle bu ekrana
  // ulaşılabiliyordu. "QR/NFC pilot kapsamı güvenlik kabulüne kadar kapalı
  // kalacak" kuralı gereği aynı bayrak burada da uygulanır. Altındaki RPC'ler
  // (accept/preview_ownership_transfer) zaten staging'de authenticated/anon
  // EXECUTE yetkisi revoke edilerek DB seviyesinde kapatıldı.
  if (!PILOT_FLAGS.ownershipTransferSelfService) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Bu Özellik Şu An Kullanılamıyor</h1>
          <p style={{ color: colors.textMuted, marginTop: 8 }}>
            Sahiplik devri, güvenlik kabulü tamamlanana kadar pilot kapsamı dışındadır.
          </p>
        </div>
      </main>
    );
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

  if (!preview && !loggedIn) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <OtoizLogo variant="light" size={150} mark="primary" />
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800, marginTop: 16 }}>Araç Devrini Kabul Et</h1>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: "8px 0 16px" }}>
            Devir bilgilerini görmek ve aracı devralmak için OTOİZ bireysel hesabınızla giriş yapın veya hesap oluşturun.
          </p>
          <button onClick={() => router.push(`/bireysel/giris?next=/bireysel/devir-kabul/${token}`)} style={{ ...primaryButtonStyle(false), marginBottom: 10 }}>
            Giriş Yap
          </button>
          <button onClick={() => router.push(`/bireysel/kayit?next=/bireysel/devir-kabul/${token}`)} style={secondaryButtonStyle()}>
            Hesap Oluştur
          </button>
        </div>
      </main>
    );
  }

  if (preview?.own_transfer) {
    return (
      <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>Bu devri siz başlattınız</h1>
          <p style={{ color: colors.textMuted }}>Bağlantıyı aracı devredeceğiniz kişiyle paylaşın. Kendi hesabınızla kabul edemezsiniz.</p>
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
          <OtoizLogo variant="light" size={150} mark="primary" />
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
