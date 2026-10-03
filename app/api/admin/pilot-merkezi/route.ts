import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET: pilot kontrol merkezi — tek RPC ile kullanıcı satırları + özet.
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const { data, error } = await ctx.db.rpc("admin_pilot_board");
  if (error) return NextResponse.json({ error: "Pilot özeti yüklenemedi." }, { status: 500 });
  const rows = data?.rows ?? [];
  const ozet = {
    toplamPilot: rows.length,
    aktive: rows.filter((r: any) => r.qr_activated_by > 0 || r.qr_active > 0).length,
    aracEkleyen: rows.filter((r: any) => r.vehicle_count > 0).length,
    ilkKayitYapan: rows.filter((r: any) => r.record_count > 0).length,
    belgeEkleyen: rows.filter((r: any) => r.document_count > 0).length,
    aliciRaporuKullanan: rows.filter((r: any) => r.buyer_share_count > 0).length,
    geriBildirimGonderen: rows.filter((r: any) => r.feedback_count > 0).length,
    acikSorun: rows.reduce((a: number, r: any) => a + (r.feedback_open || 0), 0),
    yediGunGeriDonen: rows.filter((r: any) => r.returned_7d).length,
  };
  return NextResponse.json({ rows, ozet });
}

export const GET = withApiLog("/api/admin/pilot-merkezi", handleGET);
