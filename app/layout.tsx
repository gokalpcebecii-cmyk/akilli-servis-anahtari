import "./globals.css";
import SessionWatch from "@/components/SessionWatch";
import { SITE_URL } from "@/lib/seo";

// Aşama C: iOS "Ana Ekrana Ekle" açılış ekranları (portre). [dosya, CSS
// genişlik, CSS yükseklik, piksel oranı] — görseller public/splash/ altında,
// antrasit zemin + OTOİZ logosu.
const IOS_SPLASH: [string, number, number, number][] = [
  ["1290x2796", 430, 932, 3],
  ["1179x2556", 393, 852, 3],
  ["1284x2778", 428, 926, 3],
  ["1170x2532", 390, 844, 3],
  ["1125x2436", 375, 812, 3],
  ["1242x2688", 414, 896, 3],
  ["828x1792", 414, 896, 2],
  ["1080x2340", 360, 780, 3],
  ["750x1334", 375, 667, 2],
  ["1640x2360", 820, 1180, 2],
  ["1668x2388", 834, 1194, 2],
  ["2048x2732", 1024, 1366, 2],
  ["1620x2160", 810, 1080, 2],
  ["1488x2266", 744, 1133, 2],
];

export const metadata = {
  // SEO: göreli OG/canonical adresleri kanonik alan adına çözülür. Varsayılan
  // noindex: yalnız ana sayfa (app/page.tsx) kendi metadata'sıyla
  // indekslenebilir olur; giriş, kullanıcı, servis, yönetim ve QR/pasaport
  // sayfaları bu varsayılanı miras alır (bkz. lib/seo.js).
  metadataBase: new URL(SITE_URL),
  robots: { index: false, follow: false },
  title: "OTOİZ — Dijital Araç Servis Pasaportu",
  description: "Dijital araç servis kaydı ve müşteri sadakat sistemi",
  applicationName: "OTOİZ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OTOİZ",
    startupImage: IOS_SPLASH.map(([file, w, h, dpr]) => ({
      url: `/splash/otoiz-splash-${file}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
  // Aşama C: eski anahtar simgesi ve önceki ikon dosyaları kaldırıldı; yeni
  // dosya adları (public/icons/) iOS/Android önbelleğindeki eski simgenin
  // yenilenmesini sağlar.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/otoiz-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/otoiz-favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/otoiz-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/otoiz-apple-touch-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#0F1115",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <SessionWatch />
        {children}
      </body>
    </html>
  );
}
