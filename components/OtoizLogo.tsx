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

  const markWidth = size * 5.6;
  const markHeight = size * 2.05;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.18 }}>
      <svg
        width={markWidth}
        height={markHeight}
        viewBox="0 0 120 44"
        fill="none"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        {/* Sade, tek çizgili spor sedan yan silüeti — soyut/jenerik bir araç
            ipucu; belirli hiçbir üçüncü taraf marka/logosunu taklit etmez. */}
        <path
          d="M6 30 C6 22.5 11 17.5 18.5 16.5 L33 15.5 C40 8.5 50.5 4 61 4 C71.5 4 80 8 85 15.5 L99 16.5 C107 17.3 114 22.5 114 30"
          stroke={colors.green}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M6 30 H26 M96 30 H114" stroke={colors.green} strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="32" cy="30.5" r="6.5" stroke={otoColor} strokeOpacity="0.55" strokeWidth="2" fill="none" />
        <circle cx="88" cy="30.5" r="6.5" stroke={otoColor} strokeOpacity="0.55" strokeWidth="2" fill="none" />
        <line x1="10" y1="37" x2="110" y2="37" stroke={otoColor} strokeOpacity="0.16" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {wordmark}
    </span>
  );
}
