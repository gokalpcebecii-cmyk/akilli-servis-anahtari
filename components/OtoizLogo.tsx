import { colors, font } from "@/lib/theme";

// OTOİZ logo standardı: metin daima "OTOİZ" (OTOiZ / OTOIZ / OTO İZ gibi
// yanlış yazımlar kullanılmaz). "OTO" bölümü arka plana göre beyaz/koyu,
// "İZ" bölümü (İ harfinin noktası dahil) daima marka yeşili.
export function OtoizLogo({
  variant = "dark",
  size = 16,
}: {
  variant?: "dark" | "light";
  size?: number;
}) {
  const otoColor = variant === "dark" ? colors.textLight : colors.textDark;
  return (
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
}
