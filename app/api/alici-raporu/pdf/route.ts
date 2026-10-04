import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { buildBuyerPdf } = require("@/lib/buyerPdf");

export async function GET(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get("token") || "").trim();
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const appOrigin = String(process.env.OTOIZ_APP_ORIGIN || req.nextUrl.origin || "").replace(/\/$/, "");
  const reportUrl = new URL(`/api/alici-raporu/rapor?token=${encodeURIComponent(token)}`, appOrigin);
  const reportRes = await fetch(reportUrl, { cache: "no-store" });

  if (!reportRes.ok) {
    const status = reportRes.status === 410 ? 410 : reportRes.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 410 ? "expired_or_revoked" : "not_found" }, { status });
  }

  const report = await reportRes.json();
  const shareUrl = `${appOrigin}/alici/${encodeURIComponent(token)}`;
  const bytes = await buildBuyerPdf({ report, shareUrl, assetOrigin: appOrigin });

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="OTOIZ-Alici-Raporu.pdf"`,
      "cache-control": "no-store",
    },
  });
}
