// OTOİZ logo standardı — kullanıcının onayladığı referans görselden birebir
// çıkarılmış, project-owned marka asset'leri (bkz. public/brand/). Artık
// yeniden yorumlanmış bir SVG/font değil, referanstaki logonun kendisi
// (yüksek çözünürlüklü kırpma, koyu zemin şeffaflaştırılarak alpha ile
// çıkarıldı) kullanılıyor.
//
// İki varyant:
//  - mark="primary": araç tavan çizgisi + büyük OTOİZ. Landing / giriş
//    seçimi / login üst alanlarında, markanın ana odağı olarak kullanılır.
//  - mark="compact" (varsayılan): yalnızca wordmark. Dashboard/nav/dar alanlar.
//
// variant="dark" (varsayılan): koyu zeminler için beyaz+yeşil orijinal asset.
// variant="light": açık zeminler için, aynı şekil korunarak nötr kısmı koyu
// laciverte çevrilmiş asset (yeşil vurgu aynı kalır).
const ASSET: Record<"primary" | "compact", Record<"dark" | "light", string>> = {
  primary: {
    dark: "/brand/otoiz-primary-mark.webp",
    light: "/brand/otoiz-primary-mark-dark.webp",
  },
  compact: {
    dark: "/brand/otoiz-compact-mark.webp",
    light: "/brand/otoiz-compact-mark-dark.webp",
  },
};

const ASPECT: Record<"primary" | "compact", number> = {
  primary: 345 / 125,
  compact: 303 / 66,
};

export function OtoizLogo({
  variant = "dark",
  size = 100,
  mark = "compact",
  className,
}: {
  variant?: "dark" | "light";
  // Render genişliği (px). Yükseklik asset'in gerçek oranından otomatik hesaplanır.
  size?: number;
  mark?: "primary" | "compact";
  // Responsive genişlik override'ları (ör. desktop'ta daha büyük) için — bkz. globals.css.
  className?: string;
}) {
  const width = size;
  const height = Math.round(size / ASPECT[mark]);

  return (
    <img
      src={ASSET[mark][variant]}
      alt="OTOİZ"
      width={width}
      height={height}
      className={className}
      style={{ display: "block", width, height }}
    />
  );
}
