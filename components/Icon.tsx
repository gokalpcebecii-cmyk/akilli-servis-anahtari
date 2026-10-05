// OTOİZ paylaşılan ikon seti — tek aile: ince, yuvarlak uçlu çizgi (line)
// ikonlar, 24×24 ızgara. Dekoratif değil, işlevsel: her ikon bir
// kart/aksiyonu temsil eder. Harici ikon kütüphanesi eklenmez (bundle).
// Bazı çizimler Lucide (ISC lisansı) geometrisinden uyarlandı.
//
// Adım 3 (ikon sistemi, revizyon): ince, zarif çizgi. Çizgi kalınlığı tek
// kaynaktan gelir; ekranda her boyutta ≈1.25 px görünür (küçük ikon
// kalınlaşmaz, büyük ikon incelmez). `strokeWidth` eski çağrılarla uyum
// için kabul edilir ama yok sayılır.
export const ICON_STROKE_PX = 1.5;

export function iconStroke(size: number) {
  return Math.min(1.9, Math.max(1.1, (ICON_STROKE_PX * 24) / size));
}

export function Icon({
  name,
  color = "#fff",
  size = 22,
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
    strokeWidth: iconStroke(size),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    flex: "none",
  };
  switch (name) {
    case "wrench":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
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
    case "search":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "message":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
      );
    case "alert":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16.5v.01" />
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
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
        </svg>
      );
    case "shield-check":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
          <path d="m9.6 12.2 1.7 1.7 3.2-3.4" />
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
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
        </svg>
      );
    case "car":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4.1 15.5H3.2a.7.7 0 0 1-.7-.7v-1.6c0-.7.5-1.3 1.2-1.5l3.3-.9 2.6-2.7c.4-.4.9-.6 1.5-.6h3.8c.6 0 1.2.3 1.6.7l2.4 2.6 1.9.5c.8.2 1.3.9 1.3 1.7v1.8a.7.7 0 0 1-.7.7h-1" />
          <path d="M7.6 15.5h8" />
          <circle cx="5.85" cy="15.6" r="1.75" />
          <circle cx="17.35" cy="15.6" r="1.75" />
          <path d="M7.2 11.1h12.1" />
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
          <path d="M4 10.5 12 4.5l8 6" />
          <path d="M6.5 9.2v10.3h11V9.2" />
          <path d="M10.25 19.5v-4.25h3.5v4.25" />
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
    case "share":
      // iOS Safari "Paylaş" simgesi: yukarı ok + açık kutu.
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 3v12M8 7l4-4 4 4" />
          <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
        </svg>
      );
    case "plus-square":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "more-vertical":
      return (
        <svg viewBox="0 0 24 24" style={{ ...s, fill: color, stroke: "none" }}>
          <circle cx="12" cy="6" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="18" r="1" />
        </svg>
      );
    case "more-horizontal":
      return (
        <svg viewBox="0 0 24 24" style={{ ...s, fill: color, stroke: "none" }}>
          <circle cx="6" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="18" cy="12" r="1" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
      );
    case "compass":
      // Safari simgesi yerine sade pusula (marka logosu kullanılmaz).
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
          <path d="M4 19a2 2 0 0 1 2-2h13" />
        </svg>
      );
    case "tabs":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="4" y="8" width="12" height="12" rx="2" />
          <path d="M8 4h10a2 2 0 0 1 2 2v10" />
        </svg>
      );
    case "download":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 4v11M7 10l5 5 5-5" />
          <path d="M5 20h14" />
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
    case "document":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7Z" />
          <path d="M14 3v4h4" />
          <path d="M9 12.5h6M9 16h4" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8.5 3v4M15.5 3v4M4 10h16" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "upload":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
      );
    case "engine":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M7 8h7l2 2h2v2h2v-1h1v6h-1v-1h-2v2h-3l-2 2H8l-1-2H5v-3H3v-3h2V9h2z" />
          <path d="M9 5h5M11.5 5v3" />
        </svg>
      );
    case "menu":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    case "transfer":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <path d="M5 8.5h13.5" />
          <path d="m15.75 5.75 2.75 2.75-2.75 2.75" />
          <path d="M19 15.5H5.5" />
          <path d="m8.25 12.75-2.75 2.75 2.75 2.75" />
        </svg>
      );
    case "check-circle":
      return (
        <svg viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.5 2.5L16 9.5" />
        </svg>
      );
    default:
      return null;
  }
}
