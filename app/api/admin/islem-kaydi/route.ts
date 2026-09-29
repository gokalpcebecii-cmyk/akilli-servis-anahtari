import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";
const { decodeCursor, encodeCursor } = require("@/lib/pagination");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// P1 — İşlem kaydı (audit_log) akışı: en yeni önce, 50'lik cursor sayfa,
// isteğe bağlı işlem türü filtresi. Salt okuma; kayıt silinemez/değiştirilemez.
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const url = new URL(req.url);
  const action = (url.searchParams.get("action") || "").trim();
  const cur = decodeCursor(url.searchParams.get("cursor"));
  const { data, error } = await ctx.db.rpc("admin_audit_page", {
    p_action: /^[a-z_.]{2,60}$/.test(action) ? action : null,
    p_cursor_created: cur?.t ?? null,
    p_cursor_id: cur?.id ?? null,
    p_limit: 50,
  });
  if (error) return NextResponse.json({ error: "İşlem kaydı yüklenemedi." }, { status: 500 });
  const rows = data?.rows ?? [];
  const last = rows[rows.length - 1];
  return NextResponse.json({ rows, next_cursor: data?.has_more && last ? encodeCursor(last.created_at, last.id) : null });
}

export const GET = withApiLog("/api/admin/islem-kaydi", handleGET);
