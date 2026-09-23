import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
const { plateSearchKey } = require("@/lib/logic");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/admin/araclar?q=06ABC — plaka ile araç arama (bireysel + tüm servisler)
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  const { data: vehicles, error } = await db
    .from("vehicles")
    .select("id, plate, brand, model, year, current_km, next_service_km, next_service_date, tenant_id, owner_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const key = plateSearchKey(q);
  const list = (vehicles ?? []).filter((v: any) => !key || plateSearchKey(v.plate || "").includes(key)).slice(0, 100);

  const { data: tenants } = await db.from("tenants").select("id, name");
  const tenantName: Record<string, string> = {};
  for (const t of tenants ?? []) tenantName[t.id] = t.name;

  const ids = list.map((v: any) => v.id);
  const activeQr: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: qrs } = await db.from("qr_keys").select("code, vehicle_id").in("vehicle_id", ids).is("revoked_at", null);
    for (const r of qrs ?? []) activeQr[r.vehicle_id] = r.code;
  }

  const ownerEmail: Record<string, string> = {};
  const ownerIds = Array.from(new Set(list.map((v: any) => v.owner_user_id).filter(Boolean))) as string[];
  for (const uid of ownerIds.slice(0, 50)) {
    try {
      const { data } = await db.auth.admin.getUserById(uid);
      if (data?.user?.email) ownerEmail[uid] = data.user.email;
    } catch {
      /* yoksay */
    }
  }

  return NextResponse.json({
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
