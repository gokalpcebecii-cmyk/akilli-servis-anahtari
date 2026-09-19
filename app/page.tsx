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

  const valueProps = [
    { title: "Güvenli Kayıtlar", icon: "shield" },
    { title: "Araç Değerini Koruyun", icon: "gauge" },
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
      {/* Hero */}
      <section
        className="otoiz-hero-pattern"
        style={{
          position: "relative",
          color: colors.textLight,
          padding: "32px 20px 48px",
          overflow: "hidden",
          background: `linear-gradient(160deg, ${colors.bg} 0%, ${colors.bgAlt} 55%, ${colors.surfaceDark} 100%)`,
        }}
      >
        <div className="otoiz-hero-container" style={{ margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div className="otoiz-hero-grid">
            {/* METİN + CTA */}
            <div className="otoiz-hero-text">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 30 }}>
                <OtoizLogo variant="dark" size={22} mark="primary" />
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>Akıllı Servis Anahtarı</span>
                <span style={{ fontSize: 10.5, letterSpacing: 1.8, textTransform: "uppercase", opacity: 0.5, fontWeight: 600 }}>
                  Dijital Araç Servis Pasaportu
                </span>
              </div>

              <h1 style={{ fontSize: 32, marginBottom: 14, fontWeight: 800, lineHeight: 1.18, letterSpacing: -0.4 }}>
                Bu otomobil için premium<br />dijital servis pasaportu.
              </h1>
              <p style={{ fontSize: 15.5, opacity: 0.75, lineHeight: 1.6, marginBottom: 26, maxWidth: 380 }}>
                Bakım, kilometre ve servis kayıtlarınızı güvenle saklayın — aracınızın tüm geçmişi tek ekranda.
              </p>

              <div className="otoiz-hero-badges-row" style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 34 }}>
                {valueProps.map((v) => (
                  <div
                    key={v.title}
                    style={{
                      display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "7px 13px",
                    }}
                  >
                    <Icon name={v.icon} color={colors.green} size={14} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.9 }}>{v.title}</span>
                  </div>
                ))}
              </div>

              <div className="otoiz-hero-cta-col" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
                <button
                  onClick={openModal}
                  style={{ padding: "15px 24px", background: colors.green, color: colors.textDark, borderRadius: 10, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", minHeight: 48 }}
                >
                  Ücretsiz Başlayın
                </button>
                <button
                  onClick={openModal}
                  style={{ padding: "14px 24px", background: "transparent", color: colors.textLight, border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit", minHeight: 48 }}
                >
                  Giriş Yap
                </button>
              </div>
            </div>

            {/* GÖRSEL SAHNE — araç silüeti + QR anahtarlık + metalik zemin */}
            <div className="otoiz-hero-visual">
              <HeroVehicleScene />
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
      <section style={{ background: colors.surfaceSoft, padding: "56px 20px" }}>
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
      <section style={{ padding: "56px 20px", background: colors.surfaceLight }}>
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
      <section style={{ background: colors.bg, padding: "56px 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 36, color: colors.textLight, fontWeight: 800 }}>
          Kimler İçin?
        </h2>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20 }}>
          {audience.map((a) => (
            <div
              key={a.title}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 26, textAlign: "center" }}
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

// Landing hero'nun otomotiv atmosferi: büyük dolgun araç silüeti (yeşil üst
// ışık vurgulu gradyan), araca "asılı" duran QR anahtarlık (fiziksel ürünün
// UI dili), yeşil parlama ve altta metalik/parlak zemin + soluk yansıma.
// Tamamı inline SVG/CSS — üçüncü taraf fotoğraf veya raster asset yok.
function HeroVehicleScene() {
  const carPath =
    "M46 150 C46 118 66 95 98 91 L150 85 C172 52 218 28 262 28 C304 28 344 50 366 85 L406 91 C440 96 460 118 460 150 Z";
  return (
    <div style={{ position: "relative", maxWidth: 420, margin: "0 auto", padding: "18px 0 0", pointerEvents: "none" }}>
      {/* yeşil parlama */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: "50%", top: "38%", transform: "translate(-50%,-50%)",
          width: "88%", height: 200, borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(54,232,109,0.28), rgba(54,232,109,0.08) 60%, transparent 80%)",
          filter: "blur(6px)", zIndex: 0,
        }}
      />
      <svg viewBox="0 0 506 210" aria-hidden="true" style={{ position: "relative", zIndex: 1, width: "100%", display: "block" }}>
        <defs>
          <linearGradient id="otoizCarBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a5a6e" />
            <stop offset="18%" stopColor="#16324a" />
            <stop offset="100%" stopColor="#0a1c2c" />
          </linearGradient>
          <linearGradient id="otoizCarGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(54,232,109,0.55)" />
            <stop offset="100%" stopColor="rgba(54,232,109,0.08)" />
          </linearGradient>
        </defs>

        {/* gövde */}
        <path d={carPath} fill="url(#otoizCarBody)" stroke="rgba(54,232,109,0.5)" strokeWidth="1.5" />
        {/* cam/greenhouse vurgusu */}
        <path
          d="M128 88 C150 58 195 38 233 36 C271 38 308 56 328 88 L300 90 C278 74 252 66 230 66 C206 66 180 74 156 90 Z"
          fill="url(#otoizCarGlass)"
        />
        {/* rim ışık çizgisi */}
        <path d="M98 91 L150 85 C172 52 218 28 262 28 C304 28 344 50 366 85 L406 91" fill="none" stroke={colors.green} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        {/* tekerlekler */}
        <circle cx="140" cy="151" r="30" fill="#050d15" />
        <circle cx="140" cy="151" r="30" fill="none" stroke="rgba(54,232,109,0.45)" strokeWidth="2.5" />
        <circle cx="366" cy="151" r="30" fill="#050d15" />
        <circle cx="366" cy="151" r="30" fill="none" stroke="rgba(54,232,109,0.45)" strokeWidth="2.5" />

        {/* zemin çizgisi + soluk yansıma */}
        <line x1="20" y1="182" x2="486" y2="182" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        <g opacity="0.12" transform="translate(0,364) scale(1,-1)">
          <path d={carPath} fill="url(#otoizCarBody)" />
        </g>
      </svg>

      {/* QR anahtarlık — fiziksel ürün UI dili */}
      <div
        style={{
          position: "absolute", right: "16%", bottom: -6, zIndex: 2,
          width: 74, background: colors.surfaceDark, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 12px 28px rgba(0,0,0,0.45)", padding: "18px 8px 10px", textAlign: "center",
        }}
      >
        <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.35)", background: "transparent" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginBottom: 8 }}>
          {[1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0].map((on, i) => (
            <div key={i} style={{ width: "100%", paddingBottom: "100%", background: on ? colors.green : "rgba(255,255,255,0.15)", borderRadius: 1 }} />
          ))}
        </div>
        <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.5, color: "rgba(255,255,255,0.7)" }}>
          OTO<span style={{ color: colors.green }}>İZ</span>
        </div>
      </div>
    </div>
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
          padding: "36px 32px 32px",
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
            background: colors.surfaceSoft,
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          <Icon name="close" color={colors.textMuted} size={16} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
            <OtoizLogo variant="light" size={15} mark="primary" />
          </div>
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
  );
}
