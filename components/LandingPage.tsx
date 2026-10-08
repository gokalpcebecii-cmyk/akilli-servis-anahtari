"use client";

import { useState } from "react";
import { OtoizLogo } from "@/components/OtoizLogo";
import InkOrbitEcosystem from "@/components/ink-orbit/InkOrbitEcosystem";

// Düzen, video ve giriş animasyonları AKOR şablonundan (Mohammad Shehadeh / Hirael, MIT).
// Bildirim: public/media/templates/akor/NOTICE.txt
// Metinler ve bağlantılar OTOİZ'in çalışan ürününe aittir. Sora yerine Inter kullanılır;
// şablonun latin alt kümesi Türkçe karakterleri kapsamaz.

const NAV = [
  { label: "Ana Sayfa", href: "/" },
  { label: "Nasıl Çalışır?", href: "#nasil-calisir" },
  { label: "Bireysel / Servis", href: "/giris" },
];

const FEATURES = [
  { title: "Bakım Geçmişi", icon: "/media/templates/akor/service-1.webp" },
  { title: "Belgeler", icon: "/media/templates/akor/service-2.webp" },
  { title: "Yaklaşan Bakımlar", icon: "/media/templates/akor/service-3.webp" },
  { title: "Güvenli Devir", icon: "/media/templates/akor/service-4.webp" },
];

const STEPS = [
  { n: "1", title: "OTOİZ Kartınızı Alın", desc: "Aracınızın dijital servis pasaportunu başlatmak için OTOİZ kartınızı edinin." },
  { n: "2", title: "QR Kodu Okutun", desc: "Kart üzerindeki QR kodu telefonunuzun kamerasıyla tarayın." },
  { n: "3", title: "Hesabınızı Oluşturun", desc: "Kaydolun veya giriş yapın. E-postanızı doğrulayın ve kartınızın aktivasyon kodunu girin." },
  { n: "4", title: "Aracınızı Eşleştirin", desc: "Mevcut aracınızı seçin veya yeni araç ekleyerek kartınızı aracınıza bağlayın." },
  { n: "5", title: "Bakım ve Belgelerinizi Yönetin", desc: "Servis kayıtlarını, bakım geçmişini, belgelerinizi ve yaklaşan bakım bilgilerini takip edin." },
  { n: "6", title: "Güvenle Devredin", desc: "Aracınızı sattığınızda güvenli devir sürecini başlatın ve aktarılacak belgeleri seçin." },
];

const FOOTER_LINKS = [
  { label: "Bireysel Kayıt", href: "/bireysel/kayit" },
  { label: "İşletme Kaydı", href: "/panel/kayit" },
  { label: "Anahtarlık Etkinleştir", href: "/aktivasyon" },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);

  return (
    <main className="akor">
      <header className="akor-nav" data-slot="navbar">
        <div className="akor-nav-bar">
          <a href="/" className="akor-brand" aria-label="OTOİZ ana sayfa">
            <OtoizLogo variant="dark" mark="primary" size={112} />
          </a>
          <nav className="akor-nav-links" aria-label="Ana gezinme">
            {NAV.map((link) => (
              <a key={link.href} href={link.href} aria-current={link.href === "/" ? "page" : undefined}>
                {link.label}
              </a>
            ))}
          </nav>
          <a href="/giris" className="akor-btn akor-btn-secondary">Giriş Yap</a>
          <button
            type="button"
            className="akor-menu"
            aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          </button>
        </div>
        {menuOpen ? (
          <div className="akor-menu-panel">
            {NAV.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </header>

      <section id="home" className="akor-hero" data-slot="hero" aria-labelledby="landing-baslik">
        {heroFailed ? (
          <div className="akor-hero-fallback" aria-hidden="true" />
        ) : (
          <video
            className="akor-hero-video"
            src="/media/templates/akor/hero.mp4"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            onError={() => setHeroFailed(true)}
          />
        )}
        <div className="akor-hero-copy">
          <h1 id="landing-baslik" className="rise akor-d1">Aracınızın geçmişi kaybolmaz.</h1>
          <p className="rise akor-d2">Bakımlar, belgeler ve araç geçmişi tek yerde.</p>
          <div className="akor-hero-actions fade-up akor-d3">
            <a href="/bireysel/giris" className="akor-btn akor-btn-primary" data-testid="landing-bireysel">
              Bireysel Kullanıcı
            </a>
            <a href="/panel/login" className="akor-textlink" data-testid="landing-servis">
              Servis / İşletme
            </a>
          </div>
        </div>
      </section>

      <section id="hizmetler" className="akor-features" data-slot="services" aria-label="OTOİZ ile neler var">
        <p className="akor-features-line">Aracınızın tüm geçmişi her zaman yanınızda.</p>
        <div className="akor-feature-grid">
          {FEATURES.map((feature, index) => (
            <article key={feature.title} className="akor-feature">
              <img src={feature.icon} alt="" width={48} height={48} />
              <p className="akor-num">{String(index + 1).padStart(2, "0")}</p>
              <h3>{feature.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <InkOrbitEcosystem />

      <section id="nasil-calisir" className="akor-about" data-slot="about" aria-labelledby="nasil-baslik">
        <div className="akor-label">
          <p>Her şey tek yerde</p>
          <div aria-hidden="true" />
        </div>
        <div className="akor-about-copy">
          <h2 id="nasil-baslik">Nasıl Çalışır?</h2>
          <p className="akor-about-lead">OTOİZ kartınızı etkinleştirin, aracınızı bağlayın ve dijital servis pasaportunuzu kullanmaya başlayın.</p>
          <ol>
            {STEPS.map((step) => (
              <li key={step.n}>
                <span aria-hidden="true">{step.n}</span>
                <span>
                  <h3>{step.title}</h3>
                  <span>{step.desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="akor-close">
            <p>OTOİZ — Aracınızın Geçmişi ve Geleceği.</p>
            <a className="akor-btn akor-btn-primary" href="/bireysel/kayit">Ücretsiz Başlayın</a>
          </div>
        </div>
      </section>

      <footer className="akor-footer" data-slot="footer">
        <div className="akor-footer-row">
          <a href="/" className="akor-brand" aria-label="OTOİZ ana sayfa">
            <OtoizLogo variant="dark" mark="compact" size={92} />
          </a>
          <nav className="akor-footer-links" aria-label="Alt bağlantılar">
            {FOOTER_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>
        </div>
        <p>Aracınız için dijital servis pasaportu.</p>
      </footer>
    </main>
  );
}
