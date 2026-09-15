export default function HomePage() {
  const navy = "#0F2540";
  const navyLight = "#1E3A5F";
  const accent = "#3B82C4";
  const bg = "#F4F1EA";

  const steps = [
    { n: "1", title: "Servis kayıt ekler", desc: "Yetkili servis, yapılan bakım ve parça değişimini sisteme kaydeder." },
    { n: "2", title: "Araç sahibi görüntüler", desc: "Müşteri tüm servis geçmişini QR üzerinden kolayca görür." },
    { n: "3", title: "QR ile anında erişim", desc: "Anahtarlıktaki QR kod ile pasaporta hızlıca ulaşılır." },
    { n: "4", title: "Araç satıldığında devredilir", desc: "Teknik geçmiş korunur, kişisel bilgiler devredilmez." },
  ];

  const features = [
    { icon: "🔧", title: "Bakım ve onarım geçmişi" },
    { icon: "🚗", title: "Kilometre takibi" },
    { icon: "🔔", title: "Sonraki bakım hatırlatması" },
    { icon: "📋", title: "Servis doğrulamalı kayıtlar" },
    { icon: "🔐", title: "KVKK uyumlu veri yönetimi" },
    { icon: "🔗", title: "Araçla birlikte yaşayan dijital geçmiş" },
  ];

  const audience = [
    { icon: "🔧", title: "Özel servisler", desc: "Müşteri bağlılığını artırmak isteyen servis işletmeleri." },
    { icon: "🚙", title: "Araç sahipleri", desc: "Aracının geçmişini düzenli tutmak isteyenler." },
    { icon: "🛒", title: "İkinci el alıcıları", desc: "Daha güvenli bir satın alma deneyimi isteyenler." },
  ];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", color: "#222" }}>
      {/* Hero */}
      <section style={{ background: navy, color: "#fff", padding: "64px 20px 56px", textAlign: "center" }}>
        <p style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7, marginBottom: 12, textTransform: "uppercase" }}>
          Daha Şeffaf · Daha Güvenli · Daha Değerli
        </p>
        <h1 style={{ fontSize: 32, marginBottom: 14, fontWeight: 700, lineHeight: 1.2 }}>Akıllı Servis Anahtarı</h1>
        <p style={{ fontSize: 16, opacity: 0.9, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Aracın bakım, onarım ve kilometre geçmişini tek dijital pasaportta toplayan sistem.
          Araç satılsa bile teknik geçmiş araçla yaşamaya devam eder.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
          <a href="/panel/kayit" style={{ padding: "14px 24px", background: "#fff", color: navy, borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
            Ücretsiz Başlayın
          </a>
          <a href="/panel/login" style={{ padding: "14px 24px", background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.5)", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>
            Giriş Yap
          </a>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section style={{ background: bg, padding: "48px 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, marginBottom: 6, color: navy }}>Sistem Nasıl Çalışır?</h2>
        <p style={{ textAlign: "center", fontSize: 13, color: "#888", marginBottom: 32 }}>4 adımda dijital güvence</p>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e1d8", textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: navyLight, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontWeight: 700 }}>
                {s.n}
              </div>
              <h3 style={{ fontSize: 15, marginBottom: 6, color: navy }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Temel Özellikler */}
      <section style={{ padding: "48px 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, marginBottom: 32, color: navy }}>Temel Özellikler</h2>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {features.map((f) => (
            <div key={f.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: bg, borderRadius: 10 }}>
              <span style={{ fontSize: 22 }}>{f.icon}</span>
              <span style={{ fontSize: 14, color: "#333" }}>{f.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Kimler İçin */}
      <section style={{ background: bg, padding: "48px 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, marginBottom: 32, color: navy }}>Kimler İçin?</h2>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {audience.map((a) => (
            <div key={a.title} style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e5e1d8", textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{a.icon}</div>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: navy }}>{a.title}</h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: 0 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "56px 20px", textAlign: "center", background: navy, color: "#fff" }}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>Bugünü kaydet. Yarın satarken güven oluştur.</h2>
        <p style={{ opacity: 0.85, fontSize: 14, marginBottom: 28, maxWidth: 440, margin: "0 auto 28px" }}>
          Akıllı Servis Anahtarı, aracın teknik geçmişini düzenli, taşınabilir ve değerli hale getirir.
        </p>
        <a href="/panel/kayit" style={{ display: "inline-block", padding: "14px 32px", background: "#fff", color: navy, borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
          Hemen Kaydolun
        </a>
      </section>

      <footer style={{ textAlign: "center", padding: "24px 20px", color: "#999", fontSize: 12 }}>
        © 2026 Akıllı Servis Anahtarı — Ankara
      </footer>
    </main>
  );
     }
