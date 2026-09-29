"use strict";

// OTOİZ SEO — tek kaynak. robots.txt (app/robots.ts), sitemap.xml
// (app/sitemap.ts), ana sayfa metadata'sı (app/page.tsx) ve X-Robots-Tag
// başlıkları (next.config.js) buradaki kuralları kullanır.
//
// İlke "izin listesi": yalnız ana sayfa (/) indekslenebilir. Diğer her
// sayfa varsayılan olarak noindex'tir (root layout + X-Robots-Tag), özel
// alanlar ayrıca robots.txt'de Disallow edilir. Production dışındaki her
// ortam (staging, preview, yerel) tamamen noindex + Disallow: / olur.

// Kanonik adres her ortamda aynıdır: staging/preview kopyaları asla
// kendilerini kanonik göstermez.
const SITE_URL = "https://otoizgo.com";

const SITE_NAME = "OTOİZ";
const ALTERNATE_NAMES = ["OTOİZGO", "OtoizGo", "OTOIZ", "Otoiz"];

const HOME_TITLE = "OTOİZ | Aracınız İçin Dijital Servis Pasaportu";
const HOME_DESCRIPTION =
  "Bakım geçmişinizi, servis doğrulamalı kayıtları ve yaklaşan işlemleri OTOİZ ile tek yerde yönetin. QR tabanlı dijital servis pasaportu.";

// Mutlak adres: Next.js Vercel preview'larında göreli OG görselini preview
// adresine çözer; kanonik alan adı her ortamda aynı kalsın.
const OG_IMAGE = { url: `${SITE_URL}/og/otoiz-og-1200x630.jpg`, width: 1200, height: 630, alt: "OTOİZ — Dijital Servis Pasaportu" };
const LOGO_PATH = "/icons/otoiz-icon-512.png";

// Arama motorlarının hiç taramaması gereken özel alanlar (robots.txt).
// Sondaki "/" alt yolları, eşleşmeyen hali kök sayfayı kapsar.
const PRIVATE_PATHS = [
  "/yonetim",
  "/bireysel/",
  "/panel/",
  "/servis/",
  "/aktivasyon",
  "/hesap/",
  "/p/",
  "/r/",
  "/v/",
  "/api/",
];

const NOINDEX = "noindex, nofollow, noarchive";

// Yalnız production rolüyle ve Vercel production hedefinde build edilen
// dağıtım indekslenebilir. Rol staging ise, Vercel preview ise veya yerel
// build ise false.
function isIndexable(env) {
  const e = env || {};
  if (e.OTOIZ_DEPLOYMENT_ROLE !== "production") return false;
  if (e.VERCEL_ENV && e.VERCEL_ENV !== "production") return false;
  return true;
}

function robotsRules(env) {
  if (!isIndexable(env)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

function sitemapEntries() {
  return [{ url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 }];
}

// Next.js headers() kuralları. Kök (/) ve uzantılı dosyalar (görsel, ikon,
// robots.txt, sitemap.xml, manifest) dışında her yol X-Robots-Tag: noindex
// alır; bu, istemci tarafında render edilen sayfaları ve route handler'ları
// HTML'e bakmadan kapsar. Production dışında kök de noindex'tir.
// QR resolver'a dokunulmaz: /r/ yolları ve kalıcı QR host'u (go.<alan-adı>)
// kapsam dışıdır; resolver zaten kendi "X-Robots-Tag: noindex, nofollow"
// başlığını gönderir (lib/qrResolver.js).
function robotsHeaderRules(env, qrHost) {
  const header = [{ key: "X-Robots-Tag", value: NOINDEX }];
  const rules = [{ source: "/:path((?!r/)(?!.*\\.[A-Za-z0-9]+$).+)", headers: header }];
  if (!isIndexable(env)) rules.push({ source: "/", headers: header });
  if (qrHost) for (const r of rules) r.missing = [{ type: "host", value: qrHost }];
  return rules;
}

function structuredData() {
  const orgId = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: SITE_NAME,
        alternateName: ALTERNATE_NAMES,
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}${LOGO_PATH}`, width: 512, height: 512 },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: ALTERNATE_NAMES,
        url: `${SITE_URL}/`,
        inLanguage: "tr-TR",
        description: HOME_DESCRIPTION,
        publisher: { "@id": orgId },
      },
    ],
  };
}

module.exports = {
  SITE_URL,
  SITE_NAME,
  ALTERNATE_NAMES,
  HOME_TITLE,
  HOME_DESCRIPTION,
  OG_IMAGE,
  LOGO_PATH,
  PRIVATE_PATHS,
  NOINDEX,
  isIndexable,
  robotsRules,
  sitemapEntries,
  robotsHeaderRules,
  structuredData,
};
