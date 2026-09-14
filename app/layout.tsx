export const metadata = {
  title: "Akıllı Servis Anahtarı",
  description: "Dijital araç servis kaydı ve müşteri sadakat sistemi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
