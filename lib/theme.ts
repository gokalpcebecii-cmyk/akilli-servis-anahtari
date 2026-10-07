// OTOİZ Kapalı Tasarım Sistemi — tek kaynak renk/stil. 2026-10-05 Premium
// yeniden tasarım: zemin ve kart yüzeyleri daha koyu siyah/antrasit
// (globals.css --oz-* değişkenleriyle aynı değerler).
// Ağırlıklı koyu premium yüzeyler; hex kodları sayfalarda tekrar
// tekrar elle yazılmaz. Eski token adları (surfaceLight, textDark …) geriye
// dönük uyum için korunur ama artık koyu sistemin karşılığını taşır:
//   surfaceLight = kart yüzeyi, surfaceSoft = kart içi yükselti,
//   textDark = ana yazı, textMuted = ikincil yazı.

export const colors = {
  bg: "#07080A", // ana arka plan (premium siyah)
  bgAlt: "#0C0E11", // ikincil arka plan
  surfaceDark: "#111317", // kart yüzeyi (koyu başlık alanları)
  surface: "#111317", // kart yüzeyi
  surfaceRaised: "#171A1F", // kart iç yükselti yüzeyi
  surfaceLight: "#111317", // (eski ad) kart yüzeyi
  surfaceSoft: "#171A1F", // (eski ad) kart içi yükselti
  white: "#FFFFFF", // yalnız QR görseli gibi seçili açık yüzeyler
  textDark: "#F5F7FA", // (eski ad) ana yazı
  text: "#F5F7FA", // ana yazı
  textLight: "#F5F7FA",
  textMuted: "#A9B3C1", // ikincil yazı
  textFaint: "#7F8896", // soluk yazı
  border: "#24282F",
  green: "#22C55E", // ana vurgu / marka yeşili
  greenLight: "#86EFAC", // açık vurgu yeşili (koyu zeminde yazı/ikon)
  greenDark: "#86EFAC", // (eski ad) koyu zeminde yeşil yazı/ikon
  greenSoft: "rgba(34,197,94,0.14)",
  onAccent: "#04110A", // dolu yeşil/sarı üstündeki koyu metin
  danger: "#EF5350",
  dangerSoft: "rgba(239,83,80,0.14)",
  warning: "#F5C451",
  warningSoft: "rgba(245,196,81,0.14)",
  info: "#C3C9D1", // nötr bilgi (Adım 1: mavi kaldırıldı)
  infoSoft: "rgba(195,201,209,0.12)",
  gray: "#8B95A7",
  neutralSoft: "rgba(139,149,167,0.16)",
} as const;

// Adım 2: tek yazı sistemi — self-hosted Inter (app/globals.css @font-face).
export const font = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Ana kart 18 · küçük kart / buton / input 14.
export const radius = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 18,
  pill: 999,
};

export const shadow = {
  card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 28px rgba(0,0,0,0.28)",
  soft: "0 6px 18px rgba(0,0,0,0.22)",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  padding: "13px 16px",
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  color: colors.text,
  background: colors.bgAlt,
  fontFamily: font,
  colorScheme: "dark",
  outline: "none",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 600,
  color: colors.textMuted,
  display: "block",
  marginBottom: 8,
};

export const helperStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: colors.textFaint,
  margin: "6px 0 0",
  lineHeight: 1.45,
};

export const errorTextStyle: React.CSSProperties = {
  color: colors.danger,
  fontSize: 13,
  fontWeight: 600,
  margin: "6px 0 0",
  lineHeight: 1.4,
};

export function primaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 20px",
    borderRadius: radius.md,
    border: "none",
    background: disabled ? "rgba(34,197,94,0.45)" : colors.green,
    color: colors.onAccent,
    fontWeight: 800,
    fontSize: 16,
    cursor: disabled ? "wait" : "pointer",
    fontFamily: font,
    minHeight: 52,
  };
}

export function secondaryButtonStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 20px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceRaised,
    color: colors.text,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: font,
    minHeight: 52,
  };
}

export function dangerOutlineButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: radius.md,
    border: `1px solid ${colors.danger}`,
    background: "transparent",
    color: colors.danger,
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? "wait" : "pointer",
    fontFamily: font,
    minHeight: 48,
  };
}

export const cardStyle: React.CSSProperties = {
  background: colors.surface,
  borderRadius: radius.lg,
  border: `1px solid ${colors.border}`,
  padding: 18,
  boxShadow: shadow.card,
  color: colors.text,
};

// Durum rozetleri: Uygun yeşil dolu + koyu metin, Yaklaşıyor sarı dolu + koyu
// metin, Gecikti kırmızı dolu + beyaz metin, Veri yok gri tonlu.
export function badgeStyle(kind: "success" | "warning" | "danger" | "neutral" | "info"): React.CSSProperties {
  const map = {
    success: { color: colors.onAccent, bg: colors.green, border: colors.green },
    warning: { color: colors.onAccent, bg: colors.warning, border: colors.warning },
    danger: { color: "#FFFFFF", bg: colors.danger, border: colors.danger },
    neutral: { color: colors.textMuted, bg: colors.neutralSoft, border: "transparent" },
    info: { color: colors.info, bg: colors.infoSoft, border: "transparent" },
  } as const;
  const c = map[kind];
  return {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    color: c.color,
    background: c.bg,
    border: `1px solid ${c.border}`,
    padding: "3px 10px",
    borderRadius: radius.pill,
    whiteSpace: "nowrap",
  };
}

export const pageShellDark: React.CSSProperties = {
  minHeight: "100vh",
  background: colors.bg,
  fontFamily: font,
  color: colors.text,
};

export const pageShellLight = pageShellDark;

// Form düzeyindeki hata kutusu (alan hataları input altında kalır).
export const alertBoxStyle: React.CSSProperties = {
  background: colors.dangerSoft,
  border: "1px solid rgba(239,83,80,0.5)",
  color: colors.text,
  borderRadius: radius.md,
  padding: "12px 14px",
  fontSize: 14,
  lineHeight: 1.5,
  margin: "0 0 14px",
};
