import "./globals.css";
import SessionWatch from "@/components/SessionWatch";

export const metadata = {
  title: "OTOİZ — Dijital Araç Servis Pasaportu",
  description: "Dijital araç servis kaydı ve müşteri sadakat sistemi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OTOİZ",
  },
  // 2026-09-24: eski anahtar simgesi yerine OTOİZ marka logosu (yeni dosya
  // adları iOS/Android önbelleğindeki eski simgenin yenilenmesi için).
  icons: {
    icon: [
      { url: "/favicon-otoiz-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-otoiz-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#0C2032",
  width: "device-width",
  initialScale: 1,
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
