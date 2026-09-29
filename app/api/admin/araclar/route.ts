import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
import { withApiLog } from "@/lib/appEvents";
const { decodeCursor, keysetOrFilter, plateKeyQuery, splitPage, PAGE_SIZE } = require("@/lib/pagination");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/admin/araclar?q=06ABC&cursor=… — plaka ile araç arama (bireysel +
// tüm servisler). P1: arama veritabanında (plate_key), 50'lik cursor sayfa;
// eskiden son 1.000 araç çekilip JS'te filtreleniyordu (eski araç bulunamıyordu).
async function handleGET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;
  const url = new URL(req.url);
  const key = plateKeyQuery(url.searchParams.get("q"));
  const cur = decodeCursor(url.searchParams.get("cursor"));

  let query = db
    .from("vehicles")
    .select("id, plate, brand, model, year, current_km, next_service_km, next_service_date, tenant_id, owner_user_id, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (key) query = query.like("plate_key", `%${key}%`);
  if (cur) query = query.or(keysetOrFilter(cur));
  const { data: vehicles, error } = await query;
  if (error) return NextResponse.json({ error: "Araçlar yüklenemedi." }, { status: 500 });
  const page = splitPage(vehicles);
  const list = page.rows;

  let total: number | null = null;
  if (!cur) {
    let c = db.from("vehicles").select("id", { count: "exact", head: true });
    if (key) c = c.like("plate_key", `%${key}%`);
    const { count } = await c;
    total = count ?? null;
  }

  const tenantIds = Array.from(new Set(list.map((v: any) => v.tenant_id).filter(Boolean)));
  const tenantName: Record<string, string> = {};
  if (tenantIds.length > 0) {
    const { data: tenants } = await db.from("tenants").select("id, name").in("id", tenantIds);
    for (const t of tenants ?? []) tenantName[t.id] = t.name;
  }

  const ids = list.map((v: any) => v.id);
  const activeQr: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: qrs } = await db.from("qr_keys").select("code, vehicle_id").in("vehicle_id", ids).is("revoked_at", null);
    for (const r of qrs ?? []) activeQr[r.vehicle_id] = r.code;
  }

  const ownerEmail: Record<string, string> = {};
  const ownerIds = Array.from(new Set(list.map((v: any) => v.owner_user_id).filter(Boolean)));
  if (ownerIds.length > 0) {
    const { data: emails } = await db.rpc("admin_user_emails", { p_ids: ownerIds });
    for (const e of emails ?? []) if (e.email) ownerEmail[e.id] = e.email;
  }

  return NextResponse.json({
    total,
    next_cursor: page.nextCursor,
    vehicles: list.map((v: any) => ({
      id: v.id,
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      current_km: v.current_km,
      next_service_km: v.next_service_km,
      next_service_date: v.next_service_date,
      owner_type: v.tenant_id ? "servis" : "bireysel",
      tenant_name: v.tenant_id ? tenantName[v.tenant_id] ?? "—" : null,
      owner_email: v.owner_user_id ? ownerEmail[v.owner_user_id] ?? null : null,
      active_qr: activeQr[v.id] ?? null,
    })),
  });
}

export const GET = withApiLog("/api/admin/araclar", handleGET);
