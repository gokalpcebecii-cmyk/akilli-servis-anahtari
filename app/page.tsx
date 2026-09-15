export default function HomePage() {
  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Akıllı Servis Anahtarı</h1>
      <p style={{ color: "#666", fontSize: 15, marginBottom: 32 }}>
        Servis işletmeniz için dijital araç takip ve müşteri sadakati sistemi.
      </p>

      <a href="/panel/login" style={{ display: "block", padding: "14px 24px", background: "#1E3A5F", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600, marginBottom: 12 }}>
        Giriş Yap
      </a>

      <a href="/panel/kayit" style={{ display: "block", padding: "14px 24px", background: "#fff", color: "#1E3A5F", border: "2px solid #1E3A5F", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
        Yeni misiniz? İşletmenizi Kaydedin
      </a>
    </main>
  );
}
