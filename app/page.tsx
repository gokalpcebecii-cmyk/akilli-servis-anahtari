"use client";

import { useEffect, useRef, useState } from "react";

export default function HomePage() {
  const navy = "#0B1F3A";
  const navyLight = "#16345C";
  const accent = "#4A90D9";
  const accentLight = "#EAF2FB";
  const gold = "#D4A94A";

  const [modalOpen, setModalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openModal(e: React.MouseEvent<HTMLElement>) {
    triggerRef.current = e.currentTarget;
    setModalOpen(true);
  }

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

  const Icon = ({ name, color = "#fff", size = 22 }: { name: string; color?: string; size?: number }) => {
    const s = { width: size, height: size, stroke: color, fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    switch (name) {
      case "wrench": return <svg viewBox="0 0 24 24" style={s}><path d="M14.7 6.3a4 4 0 1 1-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 1 5.4-5.4l-3 3-2-2 3-3Z" /></svg>;
      case "gauge": return <svg viewBox="0 0 24 24" style={s}><path d="M12 20a8 8 0 1 1 8-8" /><path d="M12 12l4-4" /><circle cx="12" cy="12" r="1" /></svg>;
      case "bell": return <svg viewBox="0 0 24 24" style={s}><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
      case "check": return <svg viewBox="0 0 24 24" style={s}><path d="M20 6 9 17l-5-5" /></svg>;
      case "shield": return <svg viewBox="0 0 24 24" style={s}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" /></svg>;
      case "link": return <svg viewBox="0 0 24 24" style={s}><path d="M9 15 15 9" /><path d="M14 4h3a4 4 0 0 1 0 8h-2" /><path d="M10 20H7a4 4 0 0 1 0-8h2" /></svg>;
      case "tool": return <svg viewBox="0 0 24 24" style={s}><path d="M4 20l6-6" /><path d="M14.7 6.3a4 4 0 1 1-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 1 5.4-5.4l-3 3-2-2 3-3Z" /></svg>;
      case "car": return <svg viewBox="0 0 24 24" style={s}><path d="M4 16v-4l2-5h12l2 5v4" /><path d="M4 16h16" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></svg>;
      case "cart": return <svg viewBox="0 0 24 24" style={s}><circle cx="9" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /><path d="M3 4h2l2.4 11h9.2L19 8H6.2" /></svg>;
      case "close": return <svg viewBox="0 0 24 24" style={s}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>;
      default: return null;
    }
  };

  return (
    <main style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#1A1A1A", overflowX: "hidden" }}>
      {/* Hero */}
      <section style={{
        position: "relative", color: "#fff", padding: "56px 20px 64px", overflow: "hidden",
        backgroundImage: `linear-gradient(160deg, rgba(11,31,58,0.92) 0%, rgba(11,31,58,0.85) 50%, rgba(14,42,77,0.95) 100%), url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80')`,
        backgroundSize: "cover", backgroundPosition: "center"
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "6px 14px",
            fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 20, color: gold, fontWeight: 600
          }}>
            Daha Şeffaf · Daha Güvenli · Daha Değerli
          </div>
          <h1 style={{ fontSize: 34, marginBottom: 14, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
            Aracın Dijital<br />Servis Pasaportu
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.6, marginBottom: 32, textShadow: "0 1px 10px rgba(0,0,0,0.3)" }}>
            Bakım, onarım ve kilometre geçmişini tek dijital pasaportta topla.
            Araç satılsa bile teknik geçmiş araçla yaşamaya devam eder.
          </p>

          <div style={{
            background: "rgba(11,31,58,0.55)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 20, padding: 20, marginBottom: 32, backdropFilter: "blur(8px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>34 XY 999</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>Örnek Araç Pasaportu</div>
              </div>
              <div style={{ background: "rgba(74,144,217,0.25)", color: "#7CB4E8", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, border: `1px solid ${accent}` }}>
                Aktif Pasaport
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left" }}>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>GÜNCEL KM</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>84.200</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>SONRAKİ BAKIM</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: gold }}>90.000 km</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
            <button
              onClick={openModal}
              style={{
                padding: "15px 24px", background: `linear-gradient(135deg, ${gold}, #B8892F)`, color: navy,
                borderRadius: 10, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer",
                boxShadow: "0 8px 24px rgba(212,169,74,0.35)", fontFamily: "inherit"
              }}
            >
              Ücretsiz Başlayın →
            </button>
            <button
              onClick={openModal}
              style={{
                padding: "14px 24px", background: "rgba(255,255,255,0.05)", color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 10, fontWeight: 600, fontSize: 15,
                cursor: "pointer", fontFamily: "inherit"
              }}
            >
              Giriş Yap
            </button>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section style={{ background: "#FAFAF7", padding: "56px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: accent, fontWeight: 700, marginBottom: 8 }}>
            4 adımda dijital güvence
          </div>
          <h2 style={{ fontSize: 24, color: navy, fontWeight: 800, margin: 0 }}>Sistem Nasıl Çalışır?</h2>
        </div>
        <div style={{ maxWidth: 920, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20 }}>
            {steps.map((s) => (
              <div key={s.n} style={{
                background: "#fff", borderRadius: 16, padding: "26px 18px", textAlign: "center",
                boxShadow: "0 4px 20px rgba(11,31,58,0.06)", border: "1px solid #EEEAE0"
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${navy}, ${navyLight})`,
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px", fontWeight: 800, fontSize: 16
                }}>
                  {s.n}
                </div>
                <h3 style={{ fontSize: 15, marginBottom: 8, color: navy, fontWeight: 700 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "#777", lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Temel Özellikler */}
      <section style={{ padding: "56px 20px", background: "#fff" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 36, color: navy, fontWeight: 800 }}>
          Temel Özellikler
        </h2>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {features.map((f) => (
            <div key={f.title} style={{
              display: "flex", gap: 14, padding: 18, background: accentLight, borderRadius: 14, alignItems: "flex-start"
            }}>
              <div style={{
                width: 40, height: 40, minWidth: 40, borderRadius: 10, background: navy,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Icon name={f.icon} color={gold} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: navy, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "#667", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Kimler İçin */}
      <section style={{ background: navy, padding: "56px 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 36, color: "#fff", fontWeight: 800 }}>
          Kimler İçin?
        </h2>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20 }}>
          {audience.map((a) => (
            <div key={a.title} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16, padding: 26, textAlign: "center"
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "rgba(212,169,74,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px"
              }}>
                <Icon name={a.icon} color={gold} />
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: "#fff", fontWeight: 700 }}>{a.title}</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, margin: 0 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: "64px 20px", textAlign: "center",
        background: `linear-gradient(135deg, ${gold}, #B8892F)`
      }}>
        <h2 style={{ fontSize: 24, marginBottom: 10, color: navy, fontWeight: 800 }}>
          Bugünü kaydet. Yarın satarken güven oluştur.
        </h2>
        <p style={{ color: "#2A2416", fontSize: 14, marginBottom: 28, maxWidth: 440, margin: "0 auto 28px", opacity: 0.85 }}>
          OTOİZ, aracın teknik geçmişini düzenli, taşınabilir ve değerli hale getirir.
        </p>
        <button
          onClick={openModal}
          style={{
            display: "inline-block", padding: "15px 36px", background: navy, color: "#fff",
            borderRadius: 10, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer",
            boxShadow: "0 8px 24px rgba(11,31,58,0.3)", fontFamily: "inherit"
          }}
        >
          Hemen Kaydolun
        </button>
      </section>

      <footer style={{ textAlign: "center", padding: "28px 20px", color: "#999", fontSize: 12, background: "#FAFAF7" }}>
        © 2026 OTOİZ — Ankara
      </footer>

      <LoginChooserModal open={modalOpen} onClose={() => setModalOpen(false)} triggerRef={triggerRef} Icon={Icon} />
    </main>
  );
}

function LoginChooserModal({
  open,
  onClose,
  triggerRef,
  Icon,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  Icon: (props: { name: string; color?: string; size?: number }) => JSX.Element | null;
}) {
  const navy = "#0B1F3A";
  const gold = "#D4A94A";
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
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(6,14,28,0.62)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
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
          background: "#fff",
          width: "100%",
          maxWidth: 560,
          borderRadius: 20,
          padding: "36px 32px 32px",
          boxShadow: "0 30px 80px rgba(6,14,28,0.45)",
          position: "relative",
        }}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Kapat"
          className="otoiz-modal-close"
          style={{
            position: "absolute", top: 16, right: 16, width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#F4F1EA", border: "none", borderRadius: "50%", cursor: "pointer",
          }}
        >
          <Icon name="close" color="#555" size={16} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1, color: navy, marginBottom: 14 }}>
            OTO<span style={{ color: gold }}>İZ</span>
          </div>
          <h2 id="login-chooser-title" style={{ fontSize: 21, fontWeight: 800, color: navy, margin: "0 0 6px" }}>
            Nasıl devam etmek istersiniz?
          </h2>
          <p id="login-chooser-subtitle" style={{ fontSize: 13.5, color: "#666", margin: 0 }}>
            Size uygun giriş türünü seçin.
          </p>
        </div>

        <div className="otoiz-modal-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ border: "1.5px solid #EEEAE0", borderRadius: 14, padding: "22px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: navy,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}>
              <Icon name="car" color={gold} size={20} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: navy, margin: "0 0 6px" }}>Bireysel Kullanıcı</h3>
            <p style={{ fontSize: 12.5, color: "#667", lineHeight: 1.5, margin: "0 0 18px", flexGrow: 1 }}>
              Kendi aracınızı, bakım geçmişinizi ve dijital araç pasaportunuzu yönetin.
            </p>
            <a
              href="/bireysel/giris"
              style={{
                display: "block", textAlign: "center", padding: "12px 14px", background: navy, color: "#fff",
                borderRadius: 9, textDecoration: "none", fontWeight: 700, fontSize: 13.5, marginBottom: 10,
              }}
            >
              Bireysel Giriş
            </a>
            <a href="/bireysel/kayit" style={{ textAlign: "center", fontSize: 12, color: "#888", textDecoration: "underline" }}>
              Hesabım yok — Kayıt Ol
            </a>
          </div>

          <div style={{ border: "1.5px solid #EEEAE0", borderRadius: 14, padding: "22px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: navy,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}>
              <Icon name="tool" color={gold} size={20} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: navy, margin: "0 0 6px" }}>Servis / İşletme</h3>
            <p style={{ fontSize: 12.5, color: "#667", lineHeight: 1.5, margin: "0 0 18px", flexGrow: 1 }}>
              Müşteri araçlarını, servis kayıtlarını ve bakım süreçlerini yönetin.
            </p>
            <a
              href="/panel/login"
              style={{
                display: "block", textAlign: "center", padding: "12px 14px",
                background: `linear-gradient(135deg, ${gold}, #B8892F)`, color: navy,
                borderRadius: 9, textDecoration: "none", fontWeight: 700, fontSize: 13.5, marginBottom: 10,
              }}
            >
              Kurumsal Giriş
            </a>
            <a href="/panel/kayit" style={{ textAlign: "center", fontSize: 12, color: "#888", textDecoration: "underline" }}>
              İşletme hesabı oluştur
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
