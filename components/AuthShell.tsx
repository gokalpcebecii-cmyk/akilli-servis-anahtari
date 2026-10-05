// OTOİZ Aşama C — ortak premium giriş kabuğu.
//
// Bireysel, servis ve yönetim giriş/kayıt/şifre ekranları aynı tasarım
// ailesinden gelir: antrasit zemin + ince dijital ızgara, belirgin OTOİZ
// logosu, tek beyaz kart. Mobilde tam ekran uygulama hissi (üstten akan
// içerik, klavye açılınca kart yerinde kalır), masaüstünde solda marka
// paneli + sağda kart. Yalnız görünüm; auth mantığı sayfalarda kalır.
// Görsel dosya yok (desen CSS), animasyon yok. Stil sınıfları: globals.css
// "Aşama C — auth kabuğu" bölümü.
import { colors, font } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

export type AuthRole = "bireysel" | "servis" | "yonetim" | "hesap";

const ROLE: Record<AuthRole, { label: string; icon: string; points: string[] }> = {
  bireysel: {
    label: "Bireysel",
    icon: "user",
    points: ["Aracınızın bakım geçmişi tek yerde", "QR anahtarlıkla dijital servis pasaportu", "Yaklaşan bakım ve muayene hatırlatmaları"],
  },
  servis: {
    label: "Servis / İşletme",
    icon: "tool",
    points: ["Plaka veya QR ile saniyeler içinde kayıt", "Servis doğrulamalı bakım geçmişi", "Müşteri araçları tek panelde"],
  },
  yonetim: {
    label: "Yönetim",
    icon: "shield",
    points: ["Ürün partileri ve Baskı Merkezi", "Kullanıcı, servis ve QR yönetimi", "Yalnız OTOİZ platform yöneticileri"],
  },
  hesap: {
    label: "Hesap",
    icon: "shield-check",
    points: ["Bireysel ve işletme hesapları için geçerli", "Bağlantılar tek kullanımlıktır", "Şifreniz OTOİZ ekibi dahil kimseyle paylaşılmaz"],
  },
};

export function AuthShell({
  role,
  title,
  subtitle,
  children,
  footer,
  after,
  backHref = "/",
  backLabel = "Ana sayfa",
  testId,
}: {
  role: AuthRole;
  title?: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  // Kartın altında, koyu zeminde gösterilen bağlantılar.
  footer?: React.ReactNode;
  // Footer'ın altında (ör. "OTOİZ'i telefona ekle").
  after?: React.ReactNode;
  backHref?: string | null;
  backLabel?: string;
  testId?: string;
}) {
  const r = ROLE[role];
  return (
    <main className="otoiz-auth2" data-auth-role={role} style={{ fontFamily: font }}>
      <div className="otoiz-auth2-bg" aria-hidden="true" />
      <div className="oz-auth-car" aria-hidden="true" />
      <div className="otoiz-auth2-top">
        {backHref ? (
          <a href={backHref} className="otoiz-auth2-back">
            <span aria-hidden="true">←</span> {backLabel}
          </a>
        ) : (
          <span />
        )}
      </div>

      <div className="otoiz-auth2-grid">
        <div className="otoiz-auth2-brand">
          <a href="/" aria-label="OTOİZ ana sayfa" className="otoiz-auth2-logo">
            <OtoizLogo variant="dark" size={210} mark="primary" className="otoiz-auth2-logo-img" />
          </a>
          <p className="otoiz-auth2-tagline">Aracınızın dijital geçmişi</p>
          <ul className="otoiz-auth2-points">
            {r.points.map((p) => (
              <li key={p}>
                <span className="otoiz-auth2-point-dot" aria-hidden="true">
                  <Icon name="check" color={colors.green} size={14} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="otoiz-auth2-col">
          <section className="otoiz-auth2-card" data-testid={testId} aria-labelledby={title ? "otoiz-auth-title" : undefined}>
            <div className="otoiz-auth2-chip">
              <Icon name={r.icon} color={colors.greenDark} size={14} />
              <span>{r.label}</span>
            </div>
            {title && (
              <h1 id="otoiz-auth-title" className="otoiz-auth2-title">
                {title}
              </h1>
            )}
            {subtitle && <p className="otoiz-auth2-sub">{subtitle}</p>}
            {children}
          </section>
          {footer && <div className="otoiz-auth2-footer">{footer}</div>}
          {after}
        </div>
      </div>
    </main>
  );
}

// Oturum kontrolü sırasında beyaz sayfa yerine aynı koyu kabuk.
export function AuthShellLoading({ text = "Yükleniyor…" }: { text?: string }) {
  return (
    <main className="otoiz-auth2" style={{ fontFamily: font }} aria-busy="true">
      <div className="otoiz-auth2-bg" aria-hidden="true" />
      <div className="otoiz-auth2-loading">
        <OtoizLogo variant="dark" size={170} mark="primary" />
        <p role="status">{text}</p>
      </div>
    </main>
  );
}

// Koyu zemindeki kart dışı bağlantılar (≥ 44px dokunma alanı).
export function AuthFooterLink({ href, children, strong }: { href: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <a href={href} className={strong ? "otoiz-auth2-link otoiz-auth2-link-strong" : "otoiz-auth2-link"}>
      {children}
    </a>
  );
}
