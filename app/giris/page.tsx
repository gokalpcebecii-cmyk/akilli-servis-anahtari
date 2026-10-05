import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";

// OTOİZ Premium — giriş türü seçimi (onaylı referans görsel): logo, iki
// renkli rol kartı, altta araç görseli. Auth akışına dokunmuyor: kartlar
// mevcut /bireysel/giris ve /panel/login sayfalarına gider. QR'dan gelen
// ?next= bireysel girişe aynen aktarılır (yalnız site içi yol; açık
// yönlendirme yok — asıl kontrol giriş sayfasında).
function safeNext(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default function GirisSecimiPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const next = safeNext(searchParams?.next);
  const bireyselHref = next ? `/bireysel/giris?next=${encodeURIComponent(next)}` : "/bireysel/giris";

  return (
    <main className="oz-app">
      <div className="oz-wrap" style={{ maxWidth: 440, display: "flex", flexDirection: "column", minHeight: "100dvh", paddingTop: "calc(env(safe-area-inset-top) + 36px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
        <a href="/" aria-label="OTOİZ ana sayfa" style={{ display: "flex", justifyContent: "center" }}>
          <OtoizLogo variant="dark" size={170} />
        </a>
        <h1 className="oz-sr">OTOİZ giriş</h1>
        <p style={{ textAlign: "center", fontSize: 14.5, color: "#C3C9D1", margin: "12px 0 26px" }}>Aracınızın dijital geçmişi</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <a href={bireyselHref} className="oz-role" data-testid="giris-bireysel">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="oz-ico is-lg" data-tone="green-t" aria-hidden="true">
                <Icon name="user" color="#4ADE80" size={24} />
              </span>
              <span className="oz-role-title">Bireysel Kullanıcı</span>
              <span className="oz-role-desc">Aracınızı, bakım geçmişinizi ve belgelerinizi yönetin.</span>
            </span>
            <Icon name="chevron-right" color="#E8EBEF" size={22} />
          </a>

          <a href="/panel/login" className="oz-role" data-tone="blue" data-testid="giris-servis">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="oz-ico is-lg" data-tone="green-t" aria-hidden="true">
                <Icon name="wrench" color="#4ADE80" size={24} />
              </span>
              <span className="oz-role-title">Servis / İşletme</span>
              <span className="oz-role-desc">Müşteri araçlarını hızlıca yönetin ve bakım kaydı oluşturun.</span>
            </span>
            <Icon name="chevron-right" color="#E8EBEF" size={22} />
          </a>
        </div>

        <div className="oz-carstage" aria-hidden="true" style={{ marginTop: 22, height: 170 }} />
        <div className="oz-card" style={{ textAlign: "center", padding: "14px 18px", fontSize: 14, color: "#D5DAE1", lineHeight: 1.45 }}>
          Daha güvenli, daha değerli bir yarın için.
        </div>
      </div>
    </main>
  );
}
