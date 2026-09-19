"use client";

import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

export default function HomePage() {
  const router = useRouter();

  // "Giriş Yap"/"Ücretsiz Başlayın" artık modal/bottom-sheet açmıyor —
  // referanstaki gibi tam ekran giriş türü seçim sayfasına yönlendiriyor.
  function goToGirisSecimi() {
    router.push("/giris");
  }

  // Desktop hero (referans marketing kompozisyonunun sol kolonu): 4 madde, ikon+başlık+açıklama.
  const valueProps = [
    { title: "Tüm Servis Geçmişi", desc: "Tek yerde, her zaman erişilebilir.", icon: "history" },
    { title: "Doğrulanabilir Kayıtlar", desc: "Güvenilir ve şeffaf veriler.", icon: "shield-check" },
    { title: "Araç Değerini Koru", desc: "Daha yüksek ikinci el değeri.", icon: "gauge" },
    { title: "QR / NFC Erişim", desc: "Tek dokunuşla tüm bilgilere ulaşın.", icon: "qr" },
  ];
  // Mobil hero (referansın "LANDING" ekran mockup'ı): 3 madde, ikon+kısa etiket, 3 kolon.
  const mobileValueProps = [
    { title: "Güvenli Kayıtlar", icon: "shield" },
    { title: "Daha Yüksek Araç Değeri", icon: "gauge" },
    { title: "Her Zaman Erişilebilir", icon: "qr" },
  ];

  const steps = [
    { n: "1", title: "Servis kayıt ekler", desc: "Yetkili servis, yapılan bakım ve parça değişimini sisteme kaydeder." },
    { n: "2", title: "Araç sahibi görüntüler", desc: "Müşteri tüm servis geçmişini QR üzerinden kolayca görür." },
    { n: "3", title: "QR ile anında erişim", desc: "Anahtarlıktaki QR kod ile pasaporta hızlıca ulaşılır." },
    { n: "4", title: "Araç satıldığında devredilir", desc: "Teknik geçmiş korunur, kişisel bilgiler devredilmez." },
  ];

  const features = [
    { title: "Bakım ve onarım geçmişi", desc: "Her işlem tarih ve açıklamasıyla kayıt altında.", icon: "wrench" },
    { title: "Kilometre takibi", desc: "Güncel km her ziyarette otomatik güncellenir.", icon: "gauge" },
    { title: "Sonraki bakım hatırlatması", desc: "Km ve tarih eşiğine göre otomatik uyarı.", icon: "bell" },
    { title: "Servis doğrulamalı kayıtlar", desc: "Sadece yetkili personel kayıt ekleyebilir.", icon: "check" },
    { title: "KVKK uyumlu veri yönetimi", desc: "Kişisel veriler talep halinde güvenle silinir.", icon: "shield" },
    { title: "Araçla birlikte yaşayan geçmiş", desc: "Sahiplik değişse de teknik geçmiş kalır.", icon: "link" },
  ];

  const audience = [
    { title: "Özel servisler", desc: "Müşteri bağlılığını artırmak isteyen işletmeler.", icon: "tool" },
    { title: "Araç sahipleri", desc: "Aracının geçmişini düzenli tutmak isteyenler.", icon: "car" },
    { title: "İkinci el alıcıları", desc: "Daha güvenli bir satın alma deneyimi isteyenler.", icon: "cart" },
  ];

  // Referansın alt bölümündeki 4 kısa fayda kartı (CTA'nın hemen üstünde).
  const finalBenefits = [
    { title: "Daha Güvenli", desc: "Kayıtlar kaybolmaz, daima sizinle.", icon: "shield" },
    { title: "Daha Yüksek Değer", desc: "Düzenli bakım, yüksek ikinci el değeri.", icon: "gauge" },
    { title: "Daha Sürdürülebilir", desc: "Bakımlı araç, daha temiz yarınlar.", icon: "link" },
    { title: "Daha Özgür", desc: "Tüm araç bilgileriniz tek uygulamada.", icon: "check" },
  ];

  // Referansın alt "ürün vitrini" şeridi — Playwright fixture ile üretilen
  // GERÇEK çalışan UI screenshot'ları (bkz. public/showcase/, kaynak:
  // e2e/pixel-reference-screenshots.spec.ts). Şematik/temsili kart yok.
  const showcaseScreens: { label: string; src: string }[] = [
    { label: "Landing", src: "/showcase/01-landing.webp" },
    { label: "Giriş Seçimi", src: "/showcase/02-giris-secimi.webp" },
    { label: "Bireysel Giriş", src: "/showcase/03-bireysel-giris.webp" },
    { label: "Bireysel Ana Ekran", src: "/showcase/04-bireysel-ana-ekran.webp" },
    { label: "Servis Hızlı Bakım", src: "/showcase/05-servis-hizli-bakim.webp" },
    { label: "Araç Detay / Pasaport", src: "/showcase/06-arac-detay.webp" },
    { label: "Araç Devret", src: "/showcase/07-arac-devret.webp" },
    { label: "Public Pasaport", src: "/showcase/08-public-pasaport.webp" },
  ];

  return (
    <main style={{ fontFamily: font, color: colors.textDark, overflowX: "hidden", background: colors.surfaceLight }}>
      {/* Hero — onaylanan OTOİZ referans görselinin (araç + anahtarlık fotoğrafı)
          project-owned hero art olarak kullanıldığı, gerçek HTML logo/metin/CTA
          ile üzerine bindirilmiş kompozisyon. Referans görseldeki plaka/ekran
          mock'ları veya butonlar UI olarak kullanılmıyor — yalnızca atmosfer. */}
      <section
        className="otoiz-hero-section"
        style={{
          position: "relative",
          color: colors.textLight,
          padding: "32px 20px 48px",
          overflow: "hidden",
          background: colors.bg,
        }}
      >
        <div
          aria-hidden="true"
          className="otoiz-hero-photo"
          style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 }}
        />
        <div aria-hidden="true" className="otoiz-hero-scrim" style={{ position: "absolute", inset: 0, zIndex: 1 }} />

        <div className="otoiz-hero-container" style={{ margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div className="otoiz-hero-grid">
            {/* METİN + CTA */}
            <div className="otoiz-hero-text">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 30 }}>
                <OtoizLogo variant="dark" size={352} mark="primary" className="otoiz-landing-logo" />
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>Akıllı Servis Anahtarı</span>
                <span style={{ fontSize: 10.5, letterSpacing: 1.8, textTransform: "uppercase", opacity: 0.5, fontWeight: 600 }}>
                  Dijital Araç Servis Pasaportu
                </span>
              </div>

              <h1 className="otoiz-hero-headline" style={{ fontSize: 32, marginBottom: 14, fontWeight: 800, lineHeight: 1.18, letterSpacing: -0.4, textShadow: "0 2px 10px rgba(0,0,0,0.55)" }}>
                Bu otomobil için premium<br />dijital servis pasaportu.
              </h1>
              <p style={{ fontSize: 15.5, opacity: 0.85, lineHeight: 1.6, marginBottom: 26, maxWidth: 380, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
                Bakım, kilometre ve servis kayıtlarınızı güvenle saklayın — aracınızın tüm geçmişi tek ekranda.
              </p>

              {/* Mobil: referansın LANDING ekranındaki 3 kolonlu kısa ikon+etiket satırı */}
              <div className="otoiz-hero-benefits-mobile" style={{ display: "flex", marginBottom: 30, maxWidth: 380 }}>
                {mobileValueProps.map((v, i) => (
                  <div
                    key={v.title}
                    style={{
                      flex: 1, textAlign: "center", padding: "0 8px",
                      borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.14)" : "none",
                    }}
                  >
                    <Icon name={v.icon} color={colors.green} size={20} />
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginTop: 6, lineHeight: 1.3 }}>{v.title}</div>
                  </div>
                ))}
              </div>

              {/* Referansın onboarding-carousel nokta göstergesi — yalnızca mobilde, dekoratif */}
              <div className="otoiz-hero-dots" style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{ width: i === 0 ? 16 : 6, height: 6, borderRadius: 999, background: i === 0 ? colors.green : "rgba(255,255,255,0.25)" }}
                  />
                ))}
              </div>

              <div className="otoiz-hero-cta-col" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
                <button
                  onClick={goToGirisSecimi}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "15px 24px", background: colors.green, color: colors.textDark, borderRadius: 999, border: "none",
                    fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", minHeight: 48,
                  }}
                >
                  Ücretsiz Başlayın
                  <Icon name="chevron-right" color={colors.textDark} size={16} />
                </button>
                <button
                  onClick={goToGirisSecimi}
                  style={{ padding: "14px 24px", background: "rgba(6,20,33,0.35)", color: colors.textLight, border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 999, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit", minHeight: 48 }}
                >
                  Giriş Yap
                </button>
              </div>
            </div>

            {/* TELEFON — gerçek smartphone-frame mockup, içinde gerçek
                Bireysel Ana Ekran screenshot'ı (Playwright fixture çıktısı,
                bkz. public/showcase/04-bireysel-ana-ekran.webp). Hero'nun
                ana objelerinden biri: arka plan fotoğrafına karşı öne
                çıkması için yeşil-tonlu bir glow üzerine oturuyor. */}
            <div className="otoiz-hero-phone">
              <div className="otoiz-hero-phone-glow" aria-hidden="true" />
              <PhoneFrame
                src="/showcase/04-bireysel-ana-ekran.webp"
                alt="OTOİZ Bireysel Ana Ekran — gerçek uygulama görünümü"
                width={230}
                className="otoiz-hero-phone-frame"
                priority
              />
            </div>

            {/* SAĞ KOLON — referansın kompozisyonundaki gibi fayda listesi +
                altında premium "imza" sloganı. Yalnızca desktop'ta görünür
                (bkz. .otoiz-hero-benefits-col / .otoiz-hero-signature). */}
            <div className="otoiz-hero-benefits-col">
              <div className="otoiz-hero-benefits-desktop" style={{ flexDirection: "column", gap: 16, textAlign: "left", marginBottom: 34, maxWidth: 300 }}>
                {valueProps.map((v) => (
                  <div key={v.title} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div
                      style={{
                        width: 38, height: 38, minWidth: 38, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Icon name={v.icon} color={colors.green} size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colors.textLight, marginBottom: 1 }}>{v.title}</div>
                      <div style={{ fontSize: 12.5, opacity: 0.6 }}>{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Referanstaki premium "imza" hissi — el yazısı stilinde kısa
                  slogan, sağ fayda kolonunun bir parçası gibi ince bir üst
                  ayraçla bağlanıyor; "font demo" değil, imza gibi kompakt. */}
              <div className="otoiz-hero-signature" style={{ maxWidth: 250, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <div
                  style={{
                    fontFamily: "'Caveat', cursive", fontSize: 26, fontWeight: 600, color: colors.textLight,
                    lineHeight: 1.2,
                  }}
                >
                  Aracınızın İzi{" "}
                  <span style={{ borderBottom: `2px solid ${colors.green}`, paddingBottom: 1 }}>Hep Sizinle.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ürün vitrini — referanstaki 8 ekranlık yatay şerit. Gerçek
          screenshot/resim gömülmüyor; her kart gerçek HTML/CSS ile üretilmiş
          sadeleştirilmiş bir önizleme. */}
      <section style={{ background: colors.bg, padding: "36px 20px 44px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.green, fontWeight: 700, opacity: 0.85 }}>
              Tek anahtar, sekiz ekran
            </div>
          </div>
          <div className="otoiz-showcase-strip" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, justifyContent: "center" }}>
            {showcaseScreens.map((s) => (
              <div key={s.label} style={{ minWidth: 132, width: 132 }}>
                <PhoneFrame src={s.src} alt={`OTOİZ ${s.label} — gerçek uygulama görünümü`} width={132} />
                <div style={{ textAlign: "center", fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginTop: 10, lineHeight: 1.3 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır — koyu lacivert shell + premium off-white kartlar;
          düz beyaz "SaaS" blok hissi yerine landing'in geri kalanıyla aynı
          koyu/yeşil marka dilinin devamı. */}
      <section className="otoiz-hero-pattern" style={{ background: `linear-gradient(180deg, ${colors.surfaceDark}, ${colors.bg})`, padding: "48px 20px 56px", position: "relative", overflow: "hidden" }}>
        <div className="otoiz-reflection" aria-hidden="true" />
        <div className="otoiz-accent-line" style={{ margin: "0 auto 36px" }} />
        <div style={{ textAlign: "center", marginBottom: 40, position: "relative" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.green, fontWeight: 700, marginBottom: 8 }}>
            4 adımda dijital güvence
          </div>
          <h2 style={{ fontSize: 24, color: colors.textLight, fontWeight: 800, margin: 0 }}>Sistem Nasıl Çalışır?</h2>
        </div>
        <div style={{ maxWidth: 920, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20 }}>
            {steps.map((s) => (
              <div
                key={s.n}
                style={{
                  background: colors.surfaceSoft,
                  borderRadius: 16,
                  padding: "26px 18px",
                  textAlign: "center",
                  boxShadow: "0 14px 32px rgba(2,8,15,0.35)",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: colors.surfaceDark,
                    color: colors.green,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 14px",
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: 15, marginBottom: 8, color: colors.textDark, fontWeight: 700 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Temel Özellikler — aynı koyu shell devam ediyor (Nasıl Çalışır'dan
          sert bir kesim yerine kesintisiz koyu zemin). */}
      <section className="otoiz-hero-pattern" style={{ padding: "48px 20px 56px", background: colors.bg, position: "relative", overflow: "hidden" }}>
        <div className="otoiz-reflection" aria-hidden="true" />
        <div className="otoiz-accent-line" style={{ margin: "0 auto 36px" }} />
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 36, color: colors.textLight, fontWeight: 800, position: "relative" }}>
          Temel Özellikler
        </h2>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, position: "relative" }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{ display: "flex", gap: 14, padding: 18, background: colors.surfaceSoft, borderRadius: 14, alignItems: "flex-start", boxShadow: "0 14px 32px rgba(2,8,15,0.35)" }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  minWidth: 40,
                  borderRadius: 10,
                  background: colors.surfaceDark,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={f.icon} color={colors.green} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.textDark, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Kimler İçin */}
      <section className="otoiz-hero-pattern" style={{ background: colors.bg, padding: "56px 20px", position: "relative" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 36, color: colors.textLight, fontWeight: 800 }}>
          Kimler İçin?
        </h2>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20 }}>
          {audience.map((a) => (
            <div
              key={a.title}
              className="otoiz-glass-surface"
              style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 26, textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(54,232,109,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Icon name={a.icon} color={colors.green} />
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: colors.textLight, fontWeight: 700 }}>{a.title}</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, margin: 0 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA — referanstaki koyu zeminli 4 fayda kartı + güçlü yeşil CTA */}
      <section className="otoiz-hero-pattern" style={{ padding: "56px 20px 64px", background: `linear-gradient(180deg, ${colors.bg}, ${colors.surfaceDark})`, position: "relative" }}>
        <div style={{ maxWidth: 980, margin: "0 auto 44px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {finalBenefits.map((b) => (
            <div key={b.title} className="otoiz-glass-surface" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "18px 16px", textAlign: "center" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(54,232,109,0.14)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                <Icon name={b.icon} color={colors.green} size={18} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textLight, marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{b.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 26, marginBottom: 10, color: colors.textLight, fontWeight: 800 }}>
            Bugünü kaydet. Yarın satarken güven oluştur.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginBottom: 30, maxWidth: 440, margin: "0 auto 30px" }}>
            OTOİZ, aracınızın teknik geçmişini düzenli, taşınabilir ve değerli hale getirir.
          </p>
          <button
            onClick={goToGirisSecimi}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "17px 40px",
              background: colors.green,
              color: colors.textDark,
              borderRadius: 999,
              border: "none",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              fontFamily: "inherit",
              minHeight: 52,
              boxShadow: "0 16px 34px rgba(54,232,109,0.3)",
            }}
          >
            Hemen Kaydolun
            <Icon name="chevron-right" color={colors.textDark} size={18} />
          </button>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "28px 20px", color: colors.textMuted, fontSize: 12, background: colors.surfaceSoft }}>
        © 2026 OTOİZ — Ankara
      </footer>
    </main>
  );
}

// Gerçek smartphone-frame mockup — bezel + notch + içinde gerçek uygulama
// screenshot'ı. Hero'da büyük boyutta (referansın merkez telefon objesi),
// vitrin şeridinde küçük boyutta yeniden kullanılıyor. Ekran görüntüsü
// 390×844 (mobil viewport) oranında üretildiği için genişlik verilince
// yükseklik orantılı hesaplanır — kırpma/gerilme olmaz.
function PhoneFrame({
  src, alt, width, className, priority,
}: { src: string; alt: string; width: number; className?: string; priority?: boolean }) {
  // Tüm ölçüler % / aspect-ratio ile — bir CSS media query outer genişliği
  // değiştirdiğinde bezel/notch/ekran orantılı olarak otomatik yeniden
  // ölçeklenir (JS'de sabit px hesaplanmıyor).
  return (
    <div
      className={className}
      style={{
        width, borderRadius: "15%", padding: "4.5%",
        background: "linear-gradient(160deg, #0c1620, #030a12)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: "0 26px 54px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "390 / 844", borderRadius: "11%", overflow: "hidden", background: colors.bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: "2.5%", left: "50%", transform: "translateX(-50%)",
            width: "30%", height: "4.2%", borderRadius: 999,
            background: "#030a12",
          }}
        />
      </div>
    </div>
  );
}
