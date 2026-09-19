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
          padding: "28px 20px 56px",
          overflow: "hidden",
          background: `linear-gradient(160deg, ${colors.bg} 0%, ${colors.bgAlt} 55%, ${colors.surfaceDark} 100%)`,
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 34 }}>
            <OtoizLogo variant="dark" size={19} />
          </div>

          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: 32,
                marginBottom: 14,
                fontWeight: 800,
                lineHeight: 1.18,
                letterSpacing: -0.4,
              }}
            >
              Aracınızın tüm geçmişi<br />tek ekranda.
            </h1>
            <p style={{ fontSize: 15.5, opacity: 0.75, lineHeight: 1.6, marginBottom: 28, maxWidth: 380, margin: "0 auto 28px" }}>
              Bakım, kilometre ve servis kayıtlarınızı güvenle saklayın.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 36 }}>
              {valueProps.map((v) => (
                <div
                  key={v.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 999,
                    padding: "7px 13px",
                  }}
                >
                  <Icon name={v.icon} color={colors.green} size={14} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.9 }}>{v.title}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 20,
                marginBottom: 32,
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>34 XY 999</div>
                  <div style={{ fontSize: 11.5, opacity: 0.55 }}>Örnek Araç Pasaportu</div>
                </div>
                <div
                  style={{
                    background: "rgba(54,232,109,0.14)",
                    color: colors.green,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: `1px solid rgba(54,232,109,0.4)`,
                  }}
                >
                  Aktif Pasaport
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 2 }}>GÜNCEL KM</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>84.200</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 2 }}>SONRAKİ BAKIM</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: colors.green }}>90.000 km</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
              <button
                onClick={openModal}
                style={{
                  padding: "15px 24px",
                  background: colors.green,
                  color: colors.textDark,
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 48,
                }}
              >
                Ücretsiz Başlayın
              </button>
              <button
                onClick={openModal}
                style={{
                  padding: "14px 24px",
                  background: "transparent",
                  color: colors.textLight,
                  border: "1.5px solid rgba(255,255,255,0.3)",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 48,
                }}
              >
                Giriş Yap
              </button>
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
            <OtoizLogo variant="light" size={15} />
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
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#E6FAEE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Icon name="car" color={colors.greenDark} size={20} />
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
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#E6FAEE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Icon name="tool" color={colors.greenDark} size={20} />
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
