import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

const FEATURES = [
  { title: "Bakım Geçmişi", icon: "service-history" },
  { title: "Belgeler", icon: "document" },
  { title: "Yaklaşan Bakımlar", icon: "calendar" },
  { title: "Güvenli Devir", icon: "secure-transfer" },
];

const STEPS = [
  { n: "01", title: "QR kodu okutun", desc: "OTOİZ kartınızdaki QR koduyla araç pasaportunu açın." },
  { n: "02", title: "Hesabınıza giriş yapın", desc: "Hesabınızla giriş yapın veya bireysel hesabınızı oluşturun." },
  { n: "03", title: "Aracınızı etkinleştirin", desc: "Kartınızdaki tek kullanımlık aktivasyon kodunu girin." },
  { n: "04", title: "Geçmişiniz yanınızda olsun", desc: "Bakım kayıtlarını, belgeleri ve yaklaşan işlemleri tek yerde takip edin." },
];

export default function LandingPage() {
  return (
    <main className="oz-app oz-landing-v2">
      <section className="oz-lv2-hero" aria-labelledby="landing-baslik">
        <div className="oz-lv2-photo" aria-hidden="true" />
        <div className="oz-lv2-container">
          <header className="oz-lv2-header">
            <a href="/" className="oz-lv2-brand" aria-label="OTOİZ ana sayfa">
              <OtoizLogo variant="dark" size={138} />
            </a>
            <nav className="oz-lv2-nav" aria-label="Ana gezinme">
              <a href="#nasil-calisir">Nasıl çalışır?</a>
              <a href="#otoiz-ozellikleri">Özellikler</a>
            </nav>
            <div className="oz-lv2-header-actions">
              <a href="/giris" className="oz-lv2-login">Giriş yap</a>
              <a href="/bireysel/kayit" className="oz-lv2-start">Bireysel kayıt <Icon name="arrow-right" color="#101310" size={17} /></a>
            </div>
          </header>

          <div className="oz-lv2-hero-copy">
            <p className="oz-lv2-eyebrow"><span /> DİJİTAL ARAÇ SERVİS PASAPORTU</p>
            <h1 id="landing-baslik">Aracınızın geçmişi kaybolmaz.</h1>
            <p className="oz-lv2-lead">Bakımlar, belgeler ve araç geçmişi tek yerde.</p>
            <div className="oz-lv2-cta-row">
              <a href="/bireysel/giris" className="oz-lv2-cta-primary" data-testid="landing-bireysel">
                Bireysel Kullanıcı <Icon name="arrow-right" color="#101310" size={19} />
              </a>
              <a href="/panel/login" className="oz-lv2-cta-secondary" data-testid="landing-servis">
                Servis / İşletme <Icon name="arrow-right" color="#E4E7E9" size={18} />
              </a>
            </div>
            <p className="oz-lv2-note">Araç bakım ve sahiplik geçmişinizi düzenli biçimde saklayın.</p>
          </div>

          <div className="oz-lv2-image-caption" aria-hidden="true">
            <span className="oz-lv2-caption-rule" />
            <span>Her kayıt, aracınızın hikâyesine eklenir.</span>
          </div>
        </div>
      </section>

      <section id="otoiz-ozellikleri" className="oz-lv2-features" aria-label="OTOİZ özellikleri">
        <div className="oz-lv2-container oz-lv2-feature-grid">
          {FEATURES.map((feature, index) => (
            <article className="oz-lv2-feature" key={feature.title}>
              <span className="oz-lv2-feature-index">0{index + 1}</span>
              <Icon name={feature.icon} color="#C7CDD1" size={21} />
              <h2>{feature.title}</h2>
            </article>
          ))}
        </div>
      </section>

      <section id="nasil-calisir" className="oz-lv2-how" aria-labelledby="nasil-baslik">
        <div className="oz-lv2-container">
          <div className="oz-lv2-section-heading">
            <p className="oz-lv2-eyebrow"><span /> BASİT VE DÜZENLİ</p>
            <h2 id="nasil-baslik">Nasıl Çalışır?</h2>
            <p>Araç pasaportunu kullanmaya birkaç adımda başlayın.</p>
          </div>
          <ol className="oz-lv2-steps">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="oz-lv2-step-number">{step.n}</span>
                <div><h3>{step.title}</h3><p>{step.desc}</p></div>
                <Icon name="arrow-right" color="#788189" size={18} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="oz-lv2-footer">
        <div className="oz-lv2-container oz-lv2-footer-inner">
          <OtoizLogo variant="dark" size={100} />
          <p>Aracınız için dijital servis pasaportu.</p>
          <nav aria-label="Alt gezinme">
            <a href="/bireysel/kayit">Bireysel kayıt</a>
            <a href="/panel/kayit">İşletme kaydı</a>
            <a href="/aktivasyon">Anahtarlık etkinleştir</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
