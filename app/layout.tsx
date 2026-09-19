import "./globals.css";

export const metadata = {
  title: "OTOİZ — Dijital Araç Servis Pasaportu",
  description: "Dijital araç servis kaydı ve müşteri sadakat sistemi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OTOİZ",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
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
      <head>
        {/* Referanstaki "imza" hissi için tek, hafif script font — yalnızca
            desktop landing'in premium slogan alanında kullanılıyor. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
