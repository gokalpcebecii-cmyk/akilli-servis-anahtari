import { colors, font } from "@/lib/theme";

// OTOİZ logo standardı: metin daima "OTOİZ" (OTOiZ / OTOIZ / OTO İZ gibi
// yanlış yazımlar kullanılmaz). "OTO" bölümü arka plana göre beyaz/koyu,
// "İZ" bölümü (İ harfinin noktası dahil) daima marka yeşili.
//
// İki varyant:
//  - mark="primary": wordmark'ın üzerinde sade, tek çizgili bir otomobil
//    tavan/kaput silüeti (inline SVG, raster değil). Üçüncü taraf marka
//    şekli taklit edilmiyor — yalnızca soyut, geometrik bir "araç" ipucu.
//    Landing / login / kayıt / public passport üst alanlarında kullanılır.
//  - mark="compact" (varsayılan): yalnızca metin. Dashboard/nav/dar alanlar.
export function OtoizLogo({
  variant = "dark",
  size = 16,
  mark = "compact",
}: {
  variant?: "dark" | "light";
  size?: number;
  mark?: "primary" | "compact";
}) {
  const otoColor = variant === "dark" ? colors.textLight : colors.textDark;

  const wordmark = (
    <span
      style={{
        fontSize: size,
        fontWeight: 900,
        letterSpacing: 0.5,
        fontFamily: font,
        color: otoColor,
        whiteSpace: "nowrap",
      }}
    >
      OTO<span style={{ color: colors.green }}>İZ</span>
    </span>
  );

  if (mark !== "primary") return wordmark;

  const markWidth = size * 3.6;
  const markHeight = size * 1.1;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.22 }}>
      <svg
        width={markWidth}
        height={markHeight}
        viewBox="0 0 72 22"
        fill="none"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        {/* sade tavan/kaput çizgisi — soyut sedan silüeti, üçüncü taraf marka değil */}
        <path
          d="M2 17 C10 17 13 6 24 4 C30 3 42 3 48 4 C59 6 62 17 70 17"
          stroke={colors.green}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <line x1="6" y1="19.5" x2="66" y2="19.5" stroke={otoColor} strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round" />
      </svg>
      {wordmark}
    </span>
  );
}
