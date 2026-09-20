import { colors, font, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";

// PILOT FIX 03 (bölüm E): Next.js'in varsayılan İngilizce 404 sayfası
// yerine markalı, Türkçe hata ekranı. HTTP durum kodu 404 olarak kalır
// (Next.js bu dosyayı otomatik olarak 404 yanıtlarında render eder).
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`,
        fontFamily: font,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <OtoizLogo variant="dark" size={190} mark="primary" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.textLight, margin: "0 0 10px" }}>Sayfa Bulunamadı</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 1.6, margin: "0 0 28px" }}>
          Aradığınız sayfa taşınmış, kaldırılmış olabilir ya da hiç var olmadı. Ana sayfaya dönebilir ya
          da hesabınıza giriş yapabilirsiniz.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a href="/" style={{ ...primaryButtonStyle(false), display: "block", textDecoration: "none", boxSizing: "border-box" }}>
            Ana Sayfa
          </a>
          <a
            href="/giris"
            style={{
              display: "block",
              padding: "14px 20px",
              background: "rgba(255,255,255,0.08)",
              color: colors.textLight,
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 15,
              minHeight: 48,
              boxSizing: "border-box",
            }}
          >
            Giriş Yap
          </a>
        </div>
      </div>
    </main>
  );
}
