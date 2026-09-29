import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// P1 — Sistem Sağlığı: yalnız veritabanında gerçekten ölçülen değerler
// (admin_system_health). Ölçülemeyenler "not_measured" listesinde açıkça yazılır.
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const { data, error } = await ctx.db.rpc("admin_system_health");
  if (error) return NextResponse.json({ error: "Sistem sağlığı ölçülemedi." }, { status: 500 });
  return NextResponse.json(data);
}

export const GET = withApiLog("/api/admin/saglik", handleGET);
