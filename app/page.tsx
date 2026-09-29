import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";
import { HOME_TITLE, HOME_DESCRIPTION, OG_IMAGE, SITE_NAME, SITE_URL, isIndexable, structuredData } from "@/lib/seo";

// Ana sayfa sitenin indekslenebilir tek sayfasıdır. Görünüm istemci
// bileşeninde (components/LandingPage.tsx); bu sunucu bileşeni yalnız
// metadata ve structured data (JSON-LD) ekler.
const indexable = isIndexable(process.env);

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  robots: indexable
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
    : { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: `${SITE_URL}/`,
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />
      <LandingPage />
    </>
  );
}
