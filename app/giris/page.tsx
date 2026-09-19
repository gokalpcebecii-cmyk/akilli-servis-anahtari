import { colors, font, radius } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

// Referansın "Mobil Deneyimi" orta telefonundaki tam ekran giriş türü seçim
// ekranı — artık popup/modal/bottom-sheet DEĞİL, kendi route'u olan bir
// sayfa. Auth akışına dokunmuyor: kartlar mevcut /bireysel/giris ve
// /panel/login sayfalarına yönlendiriyor.
export default function GirisSecimiPage() {
  return (
    <main
      className="otoiz-hero-pattern"
      style={{
        position: "relative", overflow: "hidden", minHeight: "100vh",
        background: `linear-gradient(160deg, ${colors.bg} 0%, ${colors.bgAlt} 55%, ${colors.surfaceDark} 100%)`,
        color: colors.textLight, fontFamily: font,
        display: "flex", flexDirection: "column",
      }}
    >
      <div className="otoiz-reflection" aria-hidden="true" />

      <div style={{ position: "relative", zIndex: 1, padding: "20px 20px 0" }}>
        <a
          href="/"
          aria-label="Geri"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)", color: colors.textLight, textDecoration: "none", fontSize: 18,
          }}
        >
          ←
        </a>
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "18px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <OtoizLogo variant="dark" size={250} mark="primary" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginTop: 6 }}>Akıllı Servis Anahtarı</div>
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "10px 24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.25 }}>Nasıl devam etmek istersiniz?</h1>
        <p style={{ fontSize: 13.5, opacity: 0.65, margin: 0 }}>İhtiyaçlarınıza en uygun seçeneği seçin.</p>
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 355, margin: "0 auto", width: "100%" }}>
          <a
            href="/bireysel/giris"
            className="otoiz-giris-card"
            style={{
              display: "block", textDecoration: "none",
              background: colors.surfaceLight, borderRadius: radius.xl, padding: "24px 22px",
              boxShadow: "0 14px 34px rgba(6,20,33,0.35)", minHeight: 44,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="user" color={colors.greenDark} size={26} />
              </div>
              <Icon name="chevron-right" color={colors.textMuted} size={20} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: colors.textDark, marginBottom: 6 }}>Bireysel Kullanıcı</div>
            <div style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
              Kendi aracınızı yönetin, geçmişini görüntüleyin, QR/NFC işlemlerini kontrol edin.
            </div>
          </a>

          <a
            href="/panel/login"
            className="otoiz-giris-card"
            style={{
              display: "block", textDecoration: "none",
              background: colors.surfaceLight, borderRadius: radius.xl, padding: "24px 22px",
              boxShadow: "0 14px 34px rgba(6,20,33,0.35)", minHeight: 44,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="tool" color={colors.greenDark} size={26} />
              </div>
              <Icon name="chevron-right" color={colors.textMuted} size={20} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: colors.textDark, marginBottom: 6 }}>Servis / Kurumsal</div>
            <div style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
              Araç kaydı oluşturun, hızlı bakım girişi yapın, müşterilerinizi yönetin.
            </div>
          </a>
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 12, opacity: 0.55, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span aria-hidden="true">ⓘ</span> Daha sonra değiştirilebilir.
        </div>
      </div>

      {/* Alt dekor — referanstaki yeşil ışık/eğim alanı, yalnızca dekoratif */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 20px 28px" }}>
        <div
          aria-hidden="true"
          style={{
            height: 90, margin: "0 -20px -28px", position: "relative", overflow: "hidden",
            background: "linear-gradient(200deg, transparent 40%, rgba(54,232,109,0.18) 100%)",
          }}
        >
          <div style={{ position: "absolute", inset: "-40% -10% auto auto", width: "70%", height: "180%", background: "radial-gradient(closest-side, rgba(54,232,109,0.35), transparent 70%)", filter: "blur(2px)" }} />
        </div>
        <div style={{ position: "relative", fontSize: 11, fontWeight: 700, letterSpacing: 1, opacity: 0.7, marginTop: -50 }}>
          DAHA İYİ BİR<br />YOLCULUK İÇİN
        </div>
        <div className="otoiz-accent-line" style={{ margin: "10px auto 0" }} />
      </div>
    </main>
  );
}
