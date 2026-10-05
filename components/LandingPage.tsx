import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

// OTOİZ Premium landing (onaylı referans görsel). İlk ekranda: araç görseli,
// tek cümle, iki net giriş yolu (Bireysel / Servis), 4 ikonlu değer ve
// "her zaman yanınızda" kartı. Altında kısa "Nasıl Çalışır?". Yalnız bugün
// çalışan özellikler anlatılır (desteklenmeyen iddia yok).
const FEATURES = [
  { title: "Bakım Geçmişi", icon: "history" },
  { title: "Belgeler", icon: "document" },
  { title: "Yaklaşan Bakımlar", icon: "calendar" },
  { title: "Güvenli Devir", icon: "shield-check" },
];

// Bireysel kullanıcının gerçek akışı (Aşama C.1'de doğrulanan 6 adım).
const STEPS = [
  { n: "1", title: "QR'ı okutun", desc: "Anahtarlıktaki QR kodu telefonunuzun kamerasıyla okutun." },
  { n: "2", title: "Giriş yapın veya kayıt olun", desc: "Bireysel hesabınızla giriş yapın ya da ücretsiz hesap açın." },
  { n: "3", title: "E-postanızı doğrulayın", desc: "Kayıtta gönderilen doğrulama bağlantısına dokunun." },
  { n: "4", title: "Aktivasyon kodunu girin", desc: "Ürün kartınızdaki aktivasyon kodunu yazın." },
  { n: "5", title: "Aracınızı seçin veya ekleyin", desc: "Kayıtlı aracınızı seçin ya da yeni aracınızı ekleyin." },
  { n: "6", title: "OTOİZ'i kullanmaya başlayın", desc: "Bakım geçmişiniz ve sıradaki bakımınız artık tek yerde." },
];

export default function LandingPage() {
  return (
    <main className="oz-app">
      <section className="oz-land" aria-labelledby="landing-baslik">
        <div className="oz-land-media" aria-hidden="true" />
        <div className="oz-wrap">
          <div className="oz-land-top">
            <OtoizLogo variant="dark" size={112} />
            <a href="/giris" className="oz-iconbtn" aria-label="Giriş Yap">
              <Icon name="menu" color="#F5F7FA" size={24} />
            </a>
          </div>

          <div className="oz-land-copy">
            <h1 id="landing-baslik" className="oz-land-title">
              Aracınızın geçmişi kaybolmaz.
            </h1>
            <p className="oz-land-sub">Bakımlar, belgeler ve araç geçmişi tek yerde.</p>

            <div className="oz-land-ctas">
              <a href="/bireysel/giris" className="oz-cta is-primary" data-testid="landing-bireysel">
                Bireysel Kullanıcı
                <Icon name="arrow-right" color="#04110A" size={20} strokeWidth={2.4} />
              </a>
              <a href="/panel/login" className="oz-cta" data-testid="landing-servis">
                Servis / İşletme
                <Icon name="arrow-right" color="#F5F7FA" size={20} strokeWidth={2.2} />
              </a>
            </div>

            <ul className="oz-feats" aria-label="OTOİZ ile neler var">
              {FEATURES.map((f) => (
                <li key={f.title} className="oz-feat">
                  <Icon name={f.icon} color="#4ADE80" size={24} strokeWidth={1.9} />
                  <h2 className="oz-feat-title">{f.title}</h2>
                </li>
              ))}
            </ul>

            <div className="oz-promo">
              <p className="oz-promo-text">Aracınızın tüm geçmişi her zaman yanınızda.</p>
              <span className="oz-promo-img" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section id="nasil-calisir" className="oz-wrap" aria-labelledby="nasil-baslik" style={{ paddingTop: 36, paddingBottom: 40, scrollMarginTop: 24 }}>
        <h2 id="nasil-baslik" className="oz-h2" style={{ fontSize: 20, marginBottom: 14 }}>
          Nasıl Çalışır?
        </h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, maxWidth: 620 }}>
          {STEPS.map((s) => (
            <li key={s.n} className="oz-card" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 14 }}>
              <span className="oz-step-n" aria-hidden="true" style={{ borderColor: "rgba(34,197,94,0.6)", color: "#4ADE80" }}>
                {s.n}
              </span>
              <span>
                <h3 style={{ display: "block", fontSize: 15, fontWeight: 700, margin: 0 }}>{s.title}</h3>
                <span style={{ display: "block", fontSize: 13, color: "#A3ABB7", marginTop: 3, lineHeight: 1.45 }}>{s.desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="oz-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 22, paddingBottom: "calc(env(safe-area-inset-bottom) + 26px)", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <OtoizLogo variant="dark" size={92} />
        </div>
        <p style={{ fontSize: 13, color: "#6F7783", margin: "0 0 12px" }}>Aracınız için dijital servis pasaportu.</p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 18px" }}>
          <a href="/bireysel/kayit" className="oz-link" style={{ color: "#A3ABB7", fontSize: 13 }}>Bireysel Kayıt</a>
          <a href="/panel/kayit" className="oz-link" style={{ color: "#A3ABB7", fontSize: 13 }}>İşletme Kaydı</a>
          <a href="/aktivasyon" className="oz-link" style={{ color: "#A3ABB7", fontSize: 13 }}>Anahtarlık Etkinleştir</a>
        </div>
      </footer>
    </main>
  );
}
