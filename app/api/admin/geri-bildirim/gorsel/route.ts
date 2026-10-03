import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET ?path=<user_id>/<dosya> → kısa ömürlü imzalı URL (yalnız yönetici).
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const p = (new URL(req.url).searchParams.get("path") || "").trim();
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/.test(p) || p.includes("..")) {
    return NextResponse.json({ error: "Geçersiz yol." }, { status: 400 });
  }
  const { data, error } = await ctx.db.storage.from("pilot-feedback").createSignedUrl(p, 900);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Görsel açılamadı." }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl });
}

export const GET = withApiLog("/api/admin/geri-bildirim/gorsel", handleGET);
