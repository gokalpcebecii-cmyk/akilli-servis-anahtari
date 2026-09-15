export default function HomePage() {
  const primaryColor = "#1E3A5F";
  const bgColor = "#F4F1EA";

  const features = [
    { icon: "📱", title: "QR ile Anında Erişim", desc: "Müşterileriniz aracının bakım geçmişini tek dokunuşla görür." },
    { icon: "🔧", title: "Kolay Bakım Takibi", desc: "Personel plaka ile arar, km ve bakım kaydı ekler." },
    { icon: "🔔", title: "Otomatik Hatırlatma", desc: "Bakım zamanı yaklaşan araçlar için müşteriye hatırlatma gider." },
    { icon: "🔒", title: "KVKK Uyumlu", desc: "Müşteri verileri güvenle saklanır, talep halinde silinir." },
  ];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", color: "#222" }}>
      {/* Hero */}
      <section style={{ background: primaryColor, color: "#fff", padding: "64px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 30, marginBottom: 12, fontWeight: 700 }}>Akıllı Servis Anahtarı</h1>
        <p style={{ fontSize: 16, opacity: 0.9, maxWidth: 460, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Servis işletmeniz için dijital araç takip ve müşteri sadakati sistemi.
          Müşterileriniz her zaman aynı servise geri dönsün.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
          <a href="/panel/kayit" style={{ padding: "14px 24px", background: "#fff", color: primaryColor, borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
            Ücretsiz Başlayın
          </a>
          <a href="/panel/login" style={{ padding: "14px 24px", background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.6)", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 15 }}>
            Giriş Yap
          </a>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: bgColor, padding: "48px 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: 20, marginBottom: 32, color: primaryColor }}>
          Nasıl Çalışır?
        </h2>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e1d8" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, marginBottom: 6, color: primaryColor }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "48px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, marginBottom: 10, color: primaryColor }}>İşletmenizi Bugün Kaydedin</h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>Kurulum ücretsiz, birkaç dakika sürer.</p>
        <a href="/panel/kayit" style={{ display: "inline-block", padding: "14px 32px", background: primaryColor, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
          Hemen Kaydolun
        </a>
      </section>

      <footer style={{ textAlign: "center", padding: "24px 20px", color: "#999", fontSize: 12, borderTop: "1px solid #eee" }}>
        © 2026 Akıllı Servis Anahtarı — Ankara
      </footer>
    </main>
  );
}
