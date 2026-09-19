"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openModal(e: React.MouseEvent<HTMLElement>) {
    triggerRef.current = e.currentTarget;
    setModalOpen(true);
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
          style={{ position: "absolute", top: 0, left: 0, right: 0, backgroundSize: "cover", zIndex: 0 }}
        />
        <div aria-hidden="true" className="otoiz-hero-scrim" style={{ position: "absolute", inset: 0, zIndex: 1 }} />

        <div className="otoiz-hero-container" style={{ margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div className="otoiz-hero-grid">
            {/* METİN + CTA */}
            <div className="otoiz-hero-text">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 30 }}>
                <OtoizLogo variant="dark" size={34} mark="primary" />
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>Akıllı Servis Anahtarı</span>
                <span style={{ fontSize: 10.5, letterSpacing: 1.8, textTransform: "uppercase", opacity: 0.5, fontWeight: 600 }}>
                  Dijital Araç Servis Pasaportu
                </span>
              </div>

              <h1 style={{ fontSize: 32, marginBottom: 14, fontWeight: 800, lineHeight: 1.18, letterSpacing: -0.4 }}>
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

              {/* Desktop: referansın geniş kompozisyonundaki dikey ikon+başlık+açıklama listesi */}
              <div className="otoiz-hero-benefits-desktop" style={{ flexDirection: "column", gap: 16, textAlign: "left", marginBottom: 34, maxWidth: 340 }}>
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
                  onClick={openModal}
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
                  onClick={openModal}
                  style={{ padding: "14px 24px", background: "rgba(6,20,33,0.35)", color: colors.textLight, border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 999, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit", minHeight: 48 }}
                >
                  Giriş Yap
                </button>
              </div>
            </div>

            {/* TELEFON ÖNİZLEME — app ekranı hissi */}
            <div className="otoiz-hero-phone">
              <div
                style={{
                  maxWidth: 300, margin: "0 auto", background: `linear-gradient(180deg, ${colors.surfaceDark}, ${colors.bg})`,
                  borderRadius: 34, padding: "14px 12px 20px", border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
                }}
              >
                <div style={{ width: 46, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px" }} />
                <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 18, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>34 XY 999</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>Örnek Araç Pasaportu</div>
                    </div>
                    <div style={{ background: "rgba(54,232,109,0.14)", color: colors.green, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 999, border: "1px solid rgba(54,232,109,0.4)" }}>
                      Aktif
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9.5, opacity: 0.55, marginBottom: 2 }}>GÜNCEL KM</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>84.200</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9.5, opacity: 0.55, marginBottom: 2 }}>SONRAKİ BAKIM</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colors.green }}>90.000 km</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {["Servis Geçmişi", "QR / NFC Yönetimi"].map((label) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "7px 10px" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(54,232,109,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name={label.startsWith("Servis") ? "history" : "qr"} color={colors.green} size={10} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section className="otoiz-hero-pattern" style={{ background: colors.surfaceSoft, padding: "48px 20px 56px" }}>
        <div className="otoiz-section-divider" style={{ marginBottom: 36 }} />
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.greenDark, fontWeight: 700, marginBottom: 8 }}>
            4 adımda dijital güvence
          </div>
          <h2 style={{ fontSize: 24, color: colors.textDark, fontWeight: 800, margin: 0 }}>Sistem Nasıl Çalışır?</h2>
        </div>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20 }}>
            {steps.map((s) => (
              <div
                key={s.n}
                style={{
                  background: colors.surfaceLight,
                  borderRadius: 16,
                  padding: "26px 18px",
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(6,20,33,0.05)",
                  border: `1px solid ${colors.border}`,
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

      {/* Temel Özellikler */}
      <section style={{ padding: "48px 20px 56px", background: colors.surfaceLight }}>
        <div className="otoiz-section-divider" style={{ marginBottom: 36 }} />
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 36, color: colors.textDark, fontWeight: 800 }}>
          Temel Özellikler
        </h2>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{ display: "flex", gap: 14, padding: 18, background: colors.surfaceSoft, borderRadius: 14, alignItems: "flex-start" }}
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

      {/* CTA */}
      <section style={{ padding: "64px 20px", textAlign: "center", background: colors.green }}>
        <h2 style={{ fontSize: 24, marginBottom: 10, color: colors.textDark, fontWeight: 800 }}>
          Bugünü kaydet. Yarın satarken güven oluştur.
        </h2>
        <p style={{ color: colors.textDark, fontSize: 14, marginBottom: 28, maxWidth: 440, margin: "0 auto 28px", opacity: 0.75 }}>
          OTOİZ, aracınızın teknik geçmişini düzenli, taşınabilir ve değerli hale getirir.
        </p>
        <button
          onClick={openModal}
          style={{
            display: "inline-block",
            padding: "15px 36px",
            background: colors.textDark,
            color: colors.textLight,
            borderRadius: 10,
            border: "none",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
            fontFamily: "inherit",
            minHeight: 48,
          }}
        >
          Hemen Kaydolun
        </button>
      </section>

      <footer style={{ textAlign: "center", padding: "28px 20px", color: colors.textMuted, fontSize: 12, background: colors.surfaceSoft }}>
        © 2026 OTOİZ — Ankara
      </footer>

      <LoginChooserModal open={modalOpen} onClose={() => setModalOpen(false)} triggerRef={triggerRef} />
    </main>
  );
}

function LoginChooserModal({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(6,20,33,0.66)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      className="otoiz-modal-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-chooser-title"
        aria-describedby="login-chooser-subtitle"
        className="otoiz-modal-card"
        style={{
          background: colors.surfaceLight,
          width: "100%",
          maxWidth: 560,
          borderRadius: 20,
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(6,20,33,0.45)",
          position: "relative",
        }}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Kapat"
          className="otoiz-modal-close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "50%",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <Icon name="close" color={colors.textLight} size={16} />
        </button>

        {/* Koyu otomotiv görsel bandı — beyaz form kartının "generic auth
            ekranı" hissini kırar; premium decor sistemiyle tutarlı. */}
        <div
          className="otoiz-glass-surface otoiz-hero-pattern"
          style={{
            position: "relative", overflow: "hidden",
            background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgAlt} 55%, ${colors.surfaceDark} 100%)`,
            padding: "30px 32px 22px", textAlign: "center",
          }}
        >
          <div className="otoiz-reflection" aria-hidden="true" />
          <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <OtoizLogo variant="dark" size={24} mark="primary" />
          </div>
          <div className="otoiz-accent-line" style={{ margin: "12px auto 0" }} />
        </div>

        <div style={{ padding: "24px 32px", paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 id="login-chooser-title" style={{ fontSize: 21, fontWeight: 800, color: colors.textDark, margin: "0 0 6px" }}>
              Nasıl devam etmek istersiniz?
            </h2>
            <p id="login-chooser-subtitle" style={{ fontSize: 13.5, color: colors.textMuted, margin: 0 }}>
              Size uygun giriş türünü seçin.
            </p>
          </div>

          <div className="otoiz-modal-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div
            className="otoiz-choice-card"
            style={{ border: `1.5px solid ${colors.border}`, borderRadius: 14, padding: "22px 18px", display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#E6FAEE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Icon name="user" color={colors.greenDark} size={21} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.textDark, margin: "0 0 6px" }}>Bireysel Kullanıcı</h3>
            <p style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5, margin: "0 0 18px", flexGrow: 1 }}>
              Kendi aracınızı yönetin, geçmişini görüntüleyin ve QR/NFC işlemlerini kontrol edin.
            </p>
            <a
              href="/bireysel/giris"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 14px",
                background: colors.green,
                color: colors.textDark,
                borderRadius: 9,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13.5,
                marginBottom: 10,
                minHeight: 44,
              }}
            >
              Bireysel Giriş
            </a>
            <a href="/bireysel/kayit" style={{ textAlign: "center", fontSize: 12, color: colors.textMuted, textDecoration: "underline" }}>
              Kayıt Ol
            </a>
          </div>

          <div
            className="otoiz-choice-card"
            style={{ border: `1.5px solid ${colors.border}`, borderRadius: 14, padding: "22px 18px", display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#E6FAEE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Icon name="tool" color={colors.greenDark} size={21} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.textDark, margin: "0 0 6px" }}>Servis / İşletme</h3>
            <p style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5, margin: "0 0 18px", flexGrow: 1 }}>
              Araç kaydı oluşturun, hızlı bakım girişi yapın ve müşterilerinizi yönetin.
            </p>
            <a
              href="/panel/login"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 14px",
                background: colors.surfaceDark,
                color: colors.textLight,
                borderRadius: 9,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13.5,
                marginBottom: 10,
                minHeight: 44,
              }}
            >
              Kurumsal Giriş
            </a>
            <a href="/panel/kayit" style={{ textAlign: "center", fontSize: 12, color: colors.textMuted, textDecoration: "underline" }}>
              İşletme hesabı oluştur
            </a>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
