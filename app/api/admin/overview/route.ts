import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Yönetici genel bakışı — salt okuma. P1: sayılar veritabanında tek SQL
// özetiyle hesaplanır (admin_overview_counts). Eskiden tablolar istemciye
// çekilip JS'te sayılıyordu; 1.000 satırı aşınca sayılar sessizce yanlış
// çıkıyordu. Yalnız requireAdmin() (MFA'lı yönetici) çağırabilir.
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const { data, error } = await ctx.db.rpc("admin_overview_counts");
  if (error) return NextResponse.json({ error: "Genel bakış hesaplanamadı." }, { status: 500 });
  return NextResponse.json(data);
}

export const GET = withApiLog("/api/admin/overview", handleGET);
