// OTOİZ paylaşılan ikon seti — sade, tek çizgili (stroke) otomotiv/ürün
// ikonografisi. Dekoratif değil, işlevsel: her ikon bir kart/aksiyonu temsil
// eder. Harici ikon kütüphanesi eklenmez (performans/bundle boyutu).
export function Icon({
  name,
  color = "#fff",
  size = 22,
  strokeWidth = 2,
}: {
  name: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const s = {
    width: size,
    height: size,
    stroke: color,
    fill: "none",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "wrench":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M14.7 6.3a4 4 0 1 1-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 1 5.4-5.4l-3 3-2-2 3-3Z" />
        </svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 20a8 8 0 1 1 8-8" />
          <path d="M12 12l4-4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
        </svg>
      );
    case "shield-check":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "link":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M9 15 15 9" />
          <path d="M14 4h3a4 4 0 0 1 0 8h-2" />
          <path d="M10 20H7a4 4 0 0 1 0-8h2" />
        </svg>
      );
    case "tool":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 20l6-6" />
          <path d="M14.7 6.3a4 4 0 1 1-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 1 5.4-5.4l-3 3-2-2 3-3Z" />
        </svg>
      );
    case "car":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 16v-4l2-5h12l2 5v4" />
          <path d="M4 16h16" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
      );
    case "cart":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="9" cy="20" r="1.2" />
          <circle cx="17" cy="20" r="1.2" />
          <path d="M3 4h2l2.4 11h9.2L19 8H6.2" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 11 12 4l8 7" />
          <path d="M6 10v9h12v-9" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevron-up":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="m6 15 6-6 6 6" />
        </svg>
      );
    case "qr":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2v2" />
        </svg>
      );
    case "handover":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="6" cy="7" r="2.5" />
          <path d="M2 19c.6-3 2-4.5 4-4.5s3.4 1.5 4 4.5" />
          <circle cx="18" cy="7" r="2.5" />
          <path d="M14 19c.6-3 2-4.5 4-4.5s3.4 1.5 4 4.5" />
          <path d="M9.5 11h5M12.5 8.5 15 11l-2.5 2.5" />
        </svg>
      );
    case "swap":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 8h13l-3-3" />
          <path d="M20 16H7l3 3" />
        </svg>
      );
    case "history":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "clipboard":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="M9 11h6M9 15h6" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "smartphone":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 9h16l-8 12L4 9Z" />
          <path d="M8 4h8l3 5H5l3-5Z" />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5v7l6-3.5-6-3.5Z" fill={color} stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}
