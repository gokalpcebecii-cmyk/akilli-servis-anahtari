// OTOİZ Final Visual System — tek kaynak (source of truth) renk/stil token'ları.
// Bütün sayfalar rengi burada tanımlı sabitlerden alır; hex kodları
// dosyalarda tekrar tekrar elle yazılmaz.

export const colors = {
  bg: "#061421",
  bgAlt: "#081B2A",
  surfaceDark: "#0C2032",
  surfaceLight: "#FFFFFF",
  surfaceSoft: "#F4F7F9",
  textDark: "#102033",
  textLight: "#FFFFFF",
  textMuted: "#6E7B88",
  border: "#E1E7EC",
  green: "#36E86D",
  greenDark: "#16B94E",
  greenSoft: "#E6FAEE",
  danger: "#C0392B",
  dangerSoft: "#FDECEA",
  warning: "#B8860B",
  warningSoft: "#FFF8E6",
  neutralSoft: "#EEF1F3",
} as const;

export const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  color: colors.textDark,
  background: colors.surfaceLight,
  fontFamily: font,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textMuted,
  display: "block",
  marginBottom: 6,
};

export function primaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 20px",
    borderRadius: radius.sm,
    border: "none",
    background: disabled ? "#A8EFC1" : colors.green,
    color: colors.textDark,
    fontWeight: 800,
    fontSize: 15,
    cursor: disabled ? "wait" : "pointer",
    fontFamily: font,
    minHeight: 48,
  };
}

export function secondaryButtonStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 20px",
    borderRadius: radius.sm,
    border: `1.5px solid ${colors.border}`,
    background: colors.surfaceLight,
    color: colors.textDark,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: font,
    minHeight: 48,
  };
}

export function dangerOutlineButtonStyle(disabled = false): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: radius.sm,
    border: `1.5px solid ${colors.danger}`,
    background: colors.surfaceLight,
    color: colors.danger,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: disabled ? "wait" : "pointer",
    fontFamily: font,
    minHeight: 44,
  };
}

export const cardStyle: React.CSSProperties = {
  background: colors.surfaceLight,
  borderRadius: radius.lg,
  border: `1px solid ${colors.border}`,
  padding: 18,
};

export function badgeStyle(kind: "success" | "warning" | "danger" | "neutral"): React.CSSProperties {
  const map = {
    success: { color: colors.greenDark, bg: colors.greenSoft },
    warning: { color: colors.warning, bg: colors.warningSoft },
    danger: { color: colors.danger, bg: colors.dangerSoft },
    neutral: { color: colors.textMuted, bg: colors.neutralSoft },
  } as const;
  const c = map[kind];
  return {
    display: "inline-block",
    fontSize: 11.5,
    fontWeight: 700,
    color: c.color,
    background: c.bg,
    padding: "4px 11px",
    borderRadius: radius.pill,
  };
}

export const pageShellDark: React.CSSProperties = {
  minHeight: "100vh",
  background: colors.bg,
  fontFamily: font,
};

export const pageShellLight: React.CSSProperties = {
  minHeight: "100vh",
  background: colors.surfaceSoft,
  fontFamily: font,
};
