// OTOİZ Aşama 1 — kalıcı QR host'u (go.<final-domain>).
// NEXT_PUBLIC_QR_BASE_URL yalnız host'tan oluşuyorsa (production:
// https://go.<alan-adı>) o host'a gelen istekler resolver'a bağlanır ve
// go-host'ta ana uygulamanın hiçbir sayfası servis edilmez. Değişken yoksa
// veya path içeriyorsa (staging: https://<staging>.vercel.app/r) hiçbir
// host kuralı eklenmez; mevcut davranış birebir korunur.
function permanentQrHost() {
  const raw = String(process.env.NEXT_PUBLIC_QR_BASE_URL || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.pathname === "/" ? u.hostname : null;
  } catch {
    return null;
  }
}

function appOrigin() {
  return String(process.env.OTOIZ_APP_ORIGIN || "").trim().replace(/\/+$/, "") || null;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    const rules = [
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
    const host = permanentQrHost();
    const app = appOrigin();
    if (host && app) {
      // go.<alan-adı>/ (token'sız) → ana site. Geçici (307).
      rules.push({ source: "/", has: [{ type: "host", value: host }], destination: `${app}/`, permanent: false });
    }
    return rules;
  },
  async rewrites() {
    const host = permanentQrHost();
    if (!host) return [];
    return {
      beforeFiles: [
        // go.<alan-adı>/<26 karakter> → resolver. Büyük harf de kabul edilir
        // (resolver normalize eder); format dışı her şey resolver'da 404 olur.
        { source: "/:token([A-Za-z0-9]{26})", has: [{ type: "host", value: host }], destination: "/r/:token" },
        // go-host'ta başka HİÇBİR yol ana uygulamaya düşmez → geçersiz kod (404).
        { source: "/:path*", has: [{ type: "host", value: host }], destination: "/r/-" },
      ],
    };
  },
};
module.exports = nextConfig;
