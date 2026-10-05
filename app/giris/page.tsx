import { Icon } from "@/components/Icon";

// OTOİZ Premium — giriş türü seçimi: iki net seçenek. Auth akışına
// dokunmuyor: kartlar mevcut /bireysel/giris ve /panel/login sayfalarına
// gider. QR'dan gelen ?next= bireysel girişe aynen aktarılır (yalnız
// site içi yol; açık yönlendirme yok — asıl kontrol giriş sayfasında).
function safeNext(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default function GirisSecimiPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const next = safeNext(searchParams?.next);
  const bireyselHref = next ? `/bireysel/giris?next=${encodeURIComponent(next)}` : "/bireysel/giris";

  return (
    <main className="oz-app oz-landing-hero" style={{ minHeight: "100vh" }}>
      <div className="oz-hero-img" aria-hidden="true" />

      <div className="oz-wrap" style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: "calc(env(safe-area-inset-top) + 14px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" aria-label="Geri" className="oz-iconbtn">
            <Icon name="chevron-left" color="#F5F7FA" size={20} />
          </a>
          <span style={{ width: 44 }} aria-hidden="true" />
        </div>

        <div style={{ flex: 1, minHeight: 120 }} />

        <div style={{ maxWidth: 440, width: "100%", margin: "0 auto" }}>
          <h1 className="oz-landing-title" style={{ fontSize: 40, textAlign: "center" }}>
            OTO<em>İZ</em>
          </h1>
          <p className="oz-landing-sub" style={{ textAlign: "center", margin: "8px 0 26px" }}>
            Aracınızın dijital geçmişi
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <a href={bireyselHref} className="oz-choice" data-testid="giris-bireysel">
              <span className="oz-choice-icon" aria-hidden="true">
                <Icon name="user" color="#86EFAC" size={26} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="oz-choice-title">Bireysel Kullanıcı</span>
                <span className="oz-choice-desc">Aracınızı, bakım geçmişinizi ve belgelerinizi yönetin.</span>
              </span>
              <Icon name="chevron-right" color="#A3ABB7" size={20} />
            </a>

            <a href="/panel/login" className="oz-choice" data-testid="giris-servis">
              <span className="oz-choice-icon" aria-hidden="true">
                <Icon name="tool" color="#86EFAC" size={26} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="oz-choice-title">Servis / İşletme</span>
                <span className="oz-choice-desc">Müşteri araçlarını hızlıca yönetin ve bakım kaydı oluşturun.</span>
              </span>
              <Icon name="chevron-right" color="#A3ABB7" size={20} />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
