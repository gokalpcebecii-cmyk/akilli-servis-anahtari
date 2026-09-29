import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo";

// robots.txt build sırasında üretilir: production'da özel alanlar Disallow,
// staging/preview'da tüm site Disallow (bkz. lib/seo.js).
export default function robots(): MetadataRoute.Robots {
  return robotsRules(process.env) as MetadataRoute.Robots;
}
