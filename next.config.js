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
  // Aşama 1: resolver (/r/<token>/) hiçbir aşamada 301/308 üretmemeli.
  // Next'in otomatik trailing-slash 308'i kapatılır ve aşağıda /r/ hariç
  // tüm yollar için birebir aynı kurallarla (Next'in dahili kuralları)
  // geri eklenir; resolver'da sondaki "/" beforeFiles rewrite ile atılır.
  skipTrailingSlashRedirect: true,
  async redirects() {
    const rules = [
      {
        source: "/:file((?!\\.well-known(?:/.*)?)(?!r/)(?:[^/]+/)*[^/]+\\.\\w+)/",
        destination: "/:file",
        permanent: true,
      },
      {
        source: "/:notfile((?!\\.well-known(?:/.*)?)(?!r/)(?:[^/]+/)*[^/\\.]+)/",
        destination: "/:notfile",
        permanent: true,
      },
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
    // go-host'ta trailing-slash 308'i yok; /<token>/ doğrudan resolver'a gider.
    if (host) {
      for (const r of rules.slice(0, 2)) r.missing = [{ type: "host", value: host }];
    }
    if (host && app) {
      // go.<alan-adı>/ (token'sız) → ana site. Geçici (307).
      rules.push({ source: "/", has: [{ type: "host", value: host }], destination: `${app}/`, permanent: false });
    }
    return rules;
  },
  async rewrites() {
    const host = permanentQrHost();
    // /r/<token>/ → /r/<token> (redirect yok, doğrudan resolver).
    const resolverSlash = { source: "/r/:token/", destination: "/r/:token" };
    if (!host) return { beforeFiles: [resolverSlash] };
    return {
      beforeFiles: [
        resolverSlash,
        // go-host'ta token dışındaki HİÇBİR yol ana uygulamaya düşmez →
        // geçersiz kod (404). Token kuralından ÖNCE gelir ve token yollarını
        // hariç tutar: beforeFiles rewrite'ları zincirlenir, sonda olursa
        // /r/<token>'a yazılmış isteği de yakalayıp 404'e çeviriyordu.
        { source: "/:path((?![A-Za-z0-9]{26}/?$).*)", has: [{ type: "host", value: host }], destination: "/r/-" },
        // go.<alan-adı>/<26 karakter>[/] → resolver. Büyük harf de kabul
        // edilir (resolver normalize eder).
        { source: "/:token([A-Za-z0-9]{26})", has: [{ type: "host", value: host }], destination: "/r/:token" },
        { source: "/:token([A-Za-z0-9]{26})/", has: [{ type: "host", value: host }], destination: "/r/:token" },
      ],
    };
  },
};
module.exports = nextConfig;
