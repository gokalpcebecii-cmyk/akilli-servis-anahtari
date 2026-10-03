import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const STATUS_SET = new Set(["yeni", "inceleniyor", "cozuldu"]);

// GET: pilot_feedback listesi (durum + kategori filtresi). Yalnızca MFA'lı
// platform yöneticisi (requireAdmin) — başka kullanıcı kayıtları görülemez.
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();
  let q = ctx.db.from("pilot_feedback").select("id,user_id,category,screen,message,screenshot_path,status,created_at,updated_at").order("created_at", { ascending: false }).limit(200);
  if (STATUS_SET.has(status)) q = q.eq("status", status);
  if (["hata", "istek", "kullanim_zorlugu", "diger"].includes(category)) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Geri bildirimler yüklenemedi." }, { status: 500 });
  const rows = data ?? [];
  const counts = { yeni: 0, inceleniyor: 0, cozuldu: 0, toplam: rows.length };
  for (const r of rows) counts[r.status as keyof typeof counts]++;
  return NextResponse.json({ rows, counts });
}

// PATCH: durum değiştir (yeni / inceleniyor / cozuldu).
async function handlePATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATUS_SET.has(status)) {
    return NextResponse.json({ error: "Geçersiz durum veya kayıt." }, { status: 400 });
  }
  const { error } = await ctx.db.from("pilot_feedback").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const GET = withApiLog("/api/admin/geri-bildirim", handleGET);
export const PATCH = withApiLog("/api/admin/geri-bildirim", handlePATCH);
