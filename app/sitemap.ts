import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo";

// Yalnız gerçekten herkese açık sayfalar. Giriş/kayıt, kullanıcı, servis,
// yönetim ve QR/pasaport adresleri bilerek listelenmez.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries() as MetadataRoute.Sitemap;
}
