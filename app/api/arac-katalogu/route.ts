import { NextResponse } from "next/server";
const { CATALOG_LIST } = require("@/lib/vehicleCatalog");

// OTOİZ Aşama E.1: araç marka → model listesi. Seçim paneli listeyi buradan
// yükler (yükleniyor / hata / boş durumlarıyla). Kişisel veri içermez; herkese
// açık ve önbelleğe alınabilir.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    { brands: CATALOG_LIST, count: CATALOG_LIST.length },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
  );
}
