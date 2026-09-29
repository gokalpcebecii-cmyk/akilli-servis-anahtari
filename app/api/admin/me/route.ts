import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  return NextResponse.json({ ok: true, email: ctx.email });
}

export const GET = withApiLog("/api/admin/me", handleGET);
