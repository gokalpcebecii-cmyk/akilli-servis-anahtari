import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

const NAV = [
  ["Ana Sayfa", "#"],
  ["Nasıl Çalışır?", "#nasil-calisir"],
  ["Özellikler", "#ozellikler"],
  ["Kurumsal", "/panel/login"],
  ["Bireysel", "/bireysel/giris"],
  ["İletişim", "#iletisim"],
];

const FEATURES = [
  {
    title: "Bakım Geçmişi",
    desc: "Servis ve kendi bakım kayıtlarınız tarih ve kilometresiyle bir arada.",
    icon: "wrench",
  },
  {
    title: "Belgeler",
    desc: "Fatura, sigorta, muayene ve servis belgeleri tek yerde.",
    icon: "document",
  },
  {
    title: "Yaklaşan Bakımlar",
    desc: "Kilometre ve tarih yaklaşırken bakımınızı zamanında görün.",
    icon: "calendar",
  },
  {
    title: "Güvenli Devir",
    desc: "Teknik geçmiş araçla kalır; kişisel bilgiler yeni sahibine aktarılmaz.",
    icon: "shield-check",
  },
];

const SCREENS = [
  ["Giriş / Karşılama", "/showcase/02-giris-secimi.webp"],
  ["Dijital Kokpit", "/showcase/04-bireysel-ana-ekran.webp"],
  ["Bakım Geçmişi", "/showcase/06-arac-detay.webp"],
  ["Belgelerim", "/showcase/08-public-pasaport.webp"],
  ["Servis Paneli", "/showcase/05-servis-hizli-bakim.webp"],
];

export default function LandingPage() {
  return (
    <main className="oz-app oz-final-landing">
      <section className="oz-final-hero" aria-labelledby="landing-baslik">
        <div className="oz-final-hero-media" aria-hidden="true" />
        <div className="oz-final-hero-glow" aria-hidden="true" />

        <div className="oz-final-shell">
          <header className="oz-final-header">
            <a href="/" className="oz-final-brand" aria-label="OTOİZ Ana Sayfa">
              <OtoizLogo variant="dark" mark="primary" size={150} />
            </a>

            <nav className="oz-final-nav" aria-label="Ana navigasyon">
              {NAV.map(([label, href]) => (
                <a key={label} href={href}>{label}</a>
              ))}
            </nav>

            <div className="oz-final-header-actions">
              <a href="/giris" className="oz-final-login">Giriş Yap</a>
              <a href="/bireysel/kayit" className="oz-final-start">Ücretsiz Başlayın</a>
            </div>

            <a href="/giris" className="oz-final-menu" aria-label="Menü">
              <Icon name="menu" color="#F7F9FB" size={23} />
            </a>
          </header>

          <div className="oz-final-hero-content">
            <div className="oz-final-kicker">DİJİTAL ARAÇ SERVİS PASAPORTU</div>
            <h1 id="landing-baslik">
              Aracınızın geçmişi <span>kaybolmaz.</span>
            </h1>
            <p>Bakımlar, belgeler ve araç geçmişi tek yerde.</p>

            <div className="oz-final-ctas">
              <a href="/bireysel/giris" className="oz-final-cta is-primary">
                <span><Icon name="user" color="#07110B" size={20} />Bireysel Kullanıcı</span>
                <Icon name="arrow-right" color="#07110B" size={18} />
              </a>
              <a href="/panel/login" className="oz-final-cta">
                <span><Icon name="tool" color="#F5F7FA" size={20} />Servis / İşletme</span>
                <Icon name="arrow-right" color="#F5F7FA" size={18} />
              </a>
            </div>
          </div>

          <div id="ozellikler" className="oz-final-features">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="oz-final-feature">
                <div className="oz-final-feature-icon">
                  <Icon name={feature.icon} color="#00E676" size={23} />
                </div>
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="oz-final-ecosystem" aria-labelledby="ecosystem-title">
        <div className="oz-final-shell">
          <div className="oz-final-ecosystem-copy">
            <div className="oz-final-kicker">TEK EKOSİSTEM</div>
            <h2 id="ecosystem-title">Aracınızın tüm geçmişi <span>her zaman yanınızda.</span></h2>
            <p>OTOİZ; bakım kayıtlarını, belgeleri, yaklaşan işlemleri ve servis doğrulamalarını web, mobil ve servis panelinde aynı düzen içinde buluşturur.</p>

            <div className="oz-final-ecosystem-pills" aria-label="OTOİZ erişim kanalları">
              <span><Icon name="tabs" color="#00E676" size={19} />Web</span>
              <span><Icon name="smartphone" color="#00E676" size={19} />Mobil</span>
              <span><Icon name="gauge" color="#00E676" size={19} />Servis Paneli</span>
            </div>
          </div>

          <div className="oz-final-phone-hero" aria-hidden="true">
            <img src="/showcase/04-bireysel-ana-ekran.webp" alt="" />
          </div>
        </div>
      </section>

      <section id="nasil-calisir" className="oz-final-showcase" aria-labelledby="showcase-title">
        <div className="oz-final-shell">
          <div className="oz-final-showcase-head">
            <div>
              <div className="oz-final-kicker">OTOİZ DENEYİMİ</div>
              <h2 id="showcase-title">Tek tasarım dili, tüm yolculuk.</h2>
            </div>
            <p>Girişten dijital kokpite, bakım geçmişinden servis operasyonuna kadar aynı premium otomotiv dili.</p>
          </div>

          <div className="oz-final-screen-grid">
            {SCREENS.map(([label, src], index) => (
              <figure key={label} className="oz-final-screen">
                <div className="oz-final-phone-frame">
                  <img src={src} alt={label} />
                </div>
                <figcaption><span>0{index + 1}</span>{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <footer id="iletisim" className="oz-final-footer">
        <div className="oz-final-shell">
          <OtoizLogo variant="dark" mark="compact" size={102} />
          <p>Aracınız için dijital servis pasaportu.</p>
          <div>
            <a href="/bireysel/kayit">Bireysel Kayıt</a>
            <a href="/panel/kayit">İşletme Kaydı</a>
            <a href="/aktivasyon">Anahtarlık Etkinleştir</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
