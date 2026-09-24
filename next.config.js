/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // İkinci düzeltme turu, madde 5: erişilemez/ölü app/panel/araclar
      // sayfası kaldırılmıştı (statik route, [id] segmenti yok, hiçbir
      // yerden linklenmiyordu) ama doğrudan bu adrese gidenler artık
      // markalı 404 yerine gerçek panel giriş noktasına yönlendirilsin.
      {
        source: "/panel/araclar",
        destination: "/panel/dashboard",
        permanent: false,
      },
    ];
  },
};
module.exports = nextConfig;
