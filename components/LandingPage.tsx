import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

// OTOİZ Premium landing (2026-10-05 kapalı tasarım). İlk 5 saniyede ürün:
// karanlıktan öne çıkan imza araç görseli + tek cümle + iki net giriş yolu.
// Altında 4 değer kartı ve kısa "Nasıl Çalışır?". Yalnız bugün çalışan
// özellikler anlatılır (desteklenmeyen iddia yok).
const VALUES = [
  { title: "Bakım Geçmişi", desc: "Servis ve kendi kayıtlarınız tarih ve kilometresiyle.", icon: "history" },
  { title: "Belgeler", desc: "Fatura ve servis fişleriniz güvenle saklanır.", icon: "document" },
  { title: "Yaklaşan Bakımlar", desc: "Sıradaki bakım ve muayene zamanını önceden görün.", icon: "calendar" },
  { title: "Güvenli Devir", desc: "Araç satılınca teknik geçmiş araçla birlikte geçer.", icon: "shield-check" },
];

const STEPS = [
  { n: "1", title: "QR'ı okutun", desc: "Anahtarlıktaki QR kodu telefon kamerasıyla okutun." },
  { n: "2", title: "Giriş yapın", desc: "Bireysel hesabınızla giriş yapın ya da ücretsiz kayıt olun." },
  { n: "3", title: "Aracınızı yönetin", desc: "Bakım, belge ve tarihler tek ekranda." },
];

export default function LandingPage() {
  return (
    <main className="oz-app">
      <section className="oz-landing-hero" aria-labelledby="landing-baslik">
        <div className="oz-hero-img" aria-hidden="true" />

        <div className="oz-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <OtoizLogo variant="dark" size={118} />
          <a href="/giris" className="oz-glass-btn" style={{ minHeight: 44 }}>
            Giriş Yap
          </a>
        </div>

        <div style={{ flex: 1, minHeight: 140 }} />

        <div className="oz-wrap" style={{ paddingBottom: 28 }}>
          <div style={{ maxWidth: 560 }}>
            <div className="oz-eyebrow" style={{ color: "#86EFAC", marginBottom: 12 }}>OTOİZ</div>
            <h1 id="landing-baslik" className="oz-landing-title">
              Aracınızın geçmişi <em>kaybolmaz.</em>
            </h1>
            <p className="oz-landing-sub">Bakımlar, belgeler ve araç geçmişi tek yerde.</p>
          </div>

          <div className="oz-landing-ctas" style={{ display: "grid", gap: 12, marginTop: 28, maxWidth: 760 }}>
            <a href="/bireysel/giris" className="oz-choice" data-testid="landing-bireysel">
              <span className="oz-choice-icon" aria-hidden="true">
                <Icon name="user" color="#86EFAC" size={24} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="oz-choice-title">Bireysel Kullanıcı</span>
                <span className="oz-choice-desc">Aracım, bakımlarım ve belgelerim</span>
              </span>
              <Icon name="chevron-right" color="#A3ABB7" size={20} />
            </a>
            <a href="/panel/login" className="oz-choice" data-testid="landing-servis">
              <span className="oz-choice-icon" aria-hidden="true">
                <Icon name="tool" color="#86EFAC" size={24} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="oz-choice-title">Servis / İşletme</span>
                <span className="oz-choice-desc">Müşteri araçları ve bakım kaydı</span>
              </span>
              <Icon name="chevron-right" color="#A3ABB7" size={20} />
            </a>
          </div>
        </div>
      </section>

      <section className="oz-wrap" aria-label="OTOİZ ile neler var" style={{ paddingTop: 8, paddingBottom: 40 }}>
        <div className="oz-values">
          {VALUES.map((v) => (
            <div key={v.title} className="oz-value">
              <span className="oz-tile-icon" aria-hidden="true">
                <Icon name={v.icon} color="#86EFAC" size={20} />
              </span>
              <h2 className="oz-value-title">{v.title}</h2>
              <p className="oz-value-desc">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="nasil-calisir" className="oz-wrap" aria-labelledby="nasil-baslik" style={{ paddingBottom: 48, scrollMarginTop: 24 }}>
        <h2 id="nasil-baslik" className="oz-h2" style={{ fontSize: 22, marginBottom: 16 }}>
          Nasıl Çalışır?
        </h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {STEPS.map((s) => (
            <li key={s.n} className="oz-card" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 16 }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", border: "1px solid rgba(34,197,94,0.45)", color: "#86EFAC", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                {s.n}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 800 }}>{s.title}</span>
                <span style={{ display: "block", fontSize: 13.5, color: "#A3ABB7", marginTop: 3, lineHeight: 1.45 }}>{s.desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="oz-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <OtoizLogo variant="dark" size={96} />
        </div>
        <p style={{ fontSize: 13, color: "#6F7783", margin: "0 0 14px" }}>Aracınız için dijital servis pasaportu.</p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 18px" }}>
          <a href="/bireysel/kayit" className="oz-link" style={{ color: "#A3ABB7" }}>Bireysel Kayıt</a>
          <a href="/panel/kayit" className="oz-link" style={{ color: "#A3ABB7" }}>İşletme Kaydı</a>
          <a href="/aktivasyon" className="oz-link" style={{ color: "#A3ABB7" }}>Anahtarlık Etkinleştir</a>
        </div>
      </footer>
    </main>
  );
}
