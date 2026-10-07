import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

// OTOİZ Premium landing (onaylı referans görsel). İlk ekranda: araç görseli,
// tek cümle, iki net giriş yolu (Bireysel / Servis), 4 ikonlu değer ve
// "her zaman yanınızda" kartı. Altında kısa "Nasıl Çalışır?". Yalnız bugün
// çalışan özellikler anlatılır (desteklenmeyen iddia yok).
const FEATURES = [
  { title: "Bakım Geçmişi", icon: "service-history" },
  { title: "Belgeler", icon: "document" },
  { title: "Yaklaşan Bakımlar", icon: "calendar" },
  { title: "Güvenli Devir", icon: "secure-transfer" },
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
    <main className="oz-app oz-landing-page">
      <section className="oz-land" aria-labelledby="landing-baslik">
        <div className="oz-land-media" aria-hidden="true" />
        <div className="oz-wrap oz-land-wrap">
          <header className="oz-land-top">
            <a href="/" className="oz-land-brand" aria-label="OTOİZ ana sayfa">
              <OtoizLogo variant="dark" mark="primary" size={150} />
            </a>
            <nav className="oz-land-nav" aria-label="Ana gezinme">
              <a href="/" aria-current="page">Ana Sayfa</a>
              <a href="#nasil-calisir">Nasıl Çalışır?</a>
              <a href="/giris">Bireysel / Servis</a>
            </nav>
            <div className="oz-land-actions">
              <a href="/giris" className="oz-land-login">Giriş Yap</a>
              <a href="/bireysel/kayit" className="oz-land-start">
                Ücretsiz Başlayın
                <Icon name="arrow-right" color="#04110A" size={18} />
              </a>
            </div>
          </header>

          <div className="oz-land-stage">
            <div className="oz-land-copy">
              <span className="oz-land-eyebrow"><i aria-hidden="true" /> OTOİZ DİJİTAL ARAÇ PASAPORTU</span>
              <h1 id="landing-baslik" className="oz-land-title" aria-label="Aracınızın geçmişi kaybolmaz.">
                Aracınızın geçmişi <span>kaybolmaz.</span>
              </h1>
              <p className="oz-land-sub">Bakımlar, belgeler ve araç geçmişi tek yerde.</p>

              <div className="oz-land-ctas">
                <a href="/bireysel/giris" className="oz-cta is-primary" data-testid="landing-bireysel">
                  Bireysel Kullanıcı
                  <Icon name="arrow-right" color="#04110A" size={20} />
                </a>
                <a href="/panel/login" className="oz-cta" data-testid="landing-servis">
                  Servis / İşletme
                  <Icon name="arrow-right" color="#F5F7FA" size={20} />
                </a>
              </div>
            </div>

            <div className="oz-land-visual" aria-hidden="true">
              <div className="oz-land-device">
                <div className="oz-land-device-screen">
                  <div className="oz-device-status"><span>9:41</span><span>● ● ●</span></div>
                  <div className="oz-device-brand"><OtoizLogo variant="dark" size={76} /></div>
                  <div className="oz-device-greeting">
                    <span>DİJİTAL ARAÇ PASAPORTU</span>
                    <strong>Aracınızın geçmişi cebinizde.</strong>
                  </div>
                  <div className="oz-device-vehicle">
                    <span className="oz-device-car" />
                    <span><strong>Aracım</strong><small>Güvenli araç geçmişi</small></span>
                    <Icon name="chevron-right" color="#A3ABB7" size={16} />
                  </div>
                  <div className="oz-device-list">
                    {FEATURES.slice(0, 3).map((f) => (
                      <div className="oz-device-row" key={f.title}>
                        <Icon name={f.icon} color="#4ADE80" size={16} />
                        <span>{f.title}</span>
                        <Icon name="chevron-right" color="#6F7783" size={14} />
                      </div>
                    ))}
                  </div>
                  <div className="oz-device-nav"><span>●</span><span>◌</span><span>◌</span><span>◌</span></div>
                </div>
              </div>
              <div className="oz-land-float">
                <span className="oz-land-float-icon"><Icon name="secure-transfer" color="#4ADE80" size={22} /></span>
                <span><strong>Güvenli ve düzenli</strong><small>Araç geçmişiniz tek yerde.</small></span>
              </div>
            </div>
          </div>

          <ul className="oz-feats" aria-label="OTOİZ ile neler var">
            {FEATURES.map((f) => (
              <li key={f.title} className="oz-feat">
                <Icon name={f.icon} color="#4ADE80" size={24} />
                <h2 className="oz-feat-title">{f.title}</h2>
              </li>
            ))}
          </ul>
          <div className="oz-promo">
            <p className="oz-promo-text">Aracınızın tüm geçmişi her zaman yanınızda.</p>
          </div>
        </div>
      </section>

      <section id="nasil-calisir" className="oz-wrap oz-land-how" aria-labelledby="nasil-baslik">
        <div className="oz-how-heading">
          <span className="oz-land-eyebrow"><i aria-hidden="true" /> HER ŞEY TEK YERDE</span>
          <h2 id="nasil-baslik" className="oz-h2">Nasıl Çalışır?</h2>
        </div>
        <ol className="oz-land-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="oz-card oz-land-step">
              <span className="oz-step-n" aria-hidden="true" style={{ borderColor: "rgba(34,197,94,0.6)", color: "#4ADE80" }}>
                {s.n}
              </span>
              <span>
                <h3>{s.title}</h3>
                <span>{s.desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="oz-wrap oz-land-footer">
        <div className="oz-land-footer-brand"><OtoizLogo variant="dark" size={92} /></div>
        <p>Aracınız için dijital servis pasaportu.</p>
        <div className="oz-land-footer-links">
          <a href="/bireysel/kayit" className="oz-link">Bireysel Kayıt</a>
          <a href="/panel/kayit" className="oz-link">İşletme Kaydı</a>
          <a href="/aktivasyon" className="oz-link">Anahtarlık Etkinleştir</a>
        </div>
      </footer>
    </main>
  );
}
