import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";
const { decodeCursor, encodeCursor } = require("@/lib/pagination");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Yönetici: kullanıcılar + kullanım özeti. P1: sayfalı (en yeni kayıt önce,
// 50'lik cursor) ve e-posta araması veritabanında; toplam sayı ayrıca döner.
// GET ?q=<e-posta parçası>&cursor=<önceki yanıttaki next_cursor>
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const cur = decodeCursor(url.searchParams.get("cursor"));
  const { data, error } = await ctx.db.rpc("admin_users_page", {
    p_search: q || null,
    p_cursor_created: cur?.t ?? null,
    p_cursor_id: cur?.id ?? null,
    p_limit: 50,
  });
  if (error) return NextResponse.json({ error: "Kullanıcılar yüklenemedi." }, { status: 500 });
  const rows = data?.rows ?? [];
  const last = rows[rows.length - 1];
  return NextResponse.json({
    users: rows,
    total: data?.total ?? null,
    active_7d: data?.active_7d ?? null,
    next_cursor: data?.has_more && last ? encodeCursor(last.created_at, last.id) : null,
  });
}

export const GET = withApiLog("/api/admin/kullanicilar", handleGET);
