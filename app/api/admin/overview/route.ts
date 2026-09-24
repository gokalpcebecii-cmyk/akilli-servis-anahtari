import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Yönetici genel bakışı — salt okuma. Tüm sorgular service_role ile, ama
// yalnız requireAdmin() geçen proje sahibi çağırabilir.
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;

  const [tenantsRes, vehiclesRes, recordsRes, qrRes, staffRes, recentRes] = await Promise.all([
    db.from("tenants").select("id, name, phone, is_active, created_at, approval_status").order("created_at", { ascending: true }),
    db.from("vehicles").select("id, tenant_id, owner_user_id"),
    db.from("maintenance_records").select("id, tenant_id"),
    db.from("qr_keys").select("id, vehicle_id, reserved_tenant_id, reserved_user_id, revoked_at"),
    db.from("staff_users").select("id, tenant_id"),
    db
      .from("maintenance_records")
      .select("id, vehicle_id, tenant_id, service_date, km_at_service, description, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const tenants = tenantsRes.data ?? [];
  const vehicles = vehiclesRes.data ?? [];
  const records = recordsRes.data ?? [];
  const qr = qrRes.data ?? [];
  const staff = staffRes.data ?? [];
  const recent = recentRes.data ?? [];

  let userCount: number | null = null;
  let activeUsers7d: number | null = null;
  let activeUsers30d: number | null = null;
  const emailById: Record<string, string> = {};
  try {
    const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = data?.users ?? [];
    userCount = users.length;
    const now = Date.now();
    const within = (d: string | null | undefined, days: number) => !!d && now - new Date(d).getTime() <= days * 86400000;
    activeUsers7d = users.filter((u: any) => within(u.last_sign_in_at, 7)).length;
    activeUsers30d = users.filter((u: any) => within(u.last_sign_in_at, 30)).length;
    for (const u of users) if (u.email) emailById[u.id] = u.email;
  } catch {
    userCount = null;
  }

  const tenantName: Record<string, string> = {};
  for (const t of tenants) tenantName[t.id] = t.name;

  const plateById: Record<string, string> = {};
  if (recent.length > 0) {
    const ids = Array.from(new Set(recent.map((r: any) => r.vehicle_id).filter(Boolean)));
    const { data: vs } = await db.from("vehicles").select("id, plate").in("id", ids);
    for (const v of vs ?? []) plateById[v.id] = v.plate;
  }

  const tenantRows = tenants.map((t: any) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    is_active: t.is_active,
    approval_status: t.approval_status,
    created_at: t.created_at,
    vehicles: vehicles.filter((v: any) => v.tenant_id === t.id).length,
    records: records.filter((r: any) => r.tenant_id === t.id).length,
    staff: staff.filter((s: any) => s.tenant_id === t.id).length,
    qr_reserved_free: qr.filter((q: any) => q.reserved_tenant_id === t.id && !q.vehicle_id && !q.revoked_at).length,
  }));

  return NextResponse.json({
    counts: {
      users: userCount,
      active_users_7d: activeUsers7d,
      active_users_30d: activeUsers30d,
      tenants: tenants.length,
      staff: staff.length,
      vehicles: vehicles.length,
      vehicles_individual: vehicles.filter((v: any) => !v.tenant_id).length,
      vehicles_service: vehicles.filter((v: any) => !!v.tenant_id).length,
      records: records.length,
      records_service: records.filter((r: any) => !!r.tenant_id).length,
      records_owner: records.filter((r: any) => !r.tenant_id).length,
      qr_total: qr.length,
      qr_assigned: qr.filter((q: any) => q.vehicle_id && !q.revoked_at).length,
      qr_reserved_free: qr.filter((q: any) => !q.vehicle_id && q.reserved_tenant_id && !q.revoked_at).length,
      qr_reserved_user: qr.filter((q: any) => !q.vehicle_id && q.reserved_user_id && !q.revoked_at).length,
      qr_free: qr.filter((q: any) => !q.vehicle_id && !q.reserved_tenant_id && !q.reserved_user_id && !q.revoked_at).length,
      qr_revoked: qr.filter((q: any) => !!q.revoked_at).length,
    },
    tenants: tenantRows,
    recent_records: recent.map((r: any) => ({
      id: r.id,
      plate: plateById[r.vehicle_id] ?? "—",
      source: r.tenant_id ? tenantName[r.tenant_id] ?? "Servis" : "Araç sahibi",
      created_by_email: r.created_by ? emailById[r.created_by] ?? null : null,
      created_at: r.created_at,
      service_date: r.service_date,
      km_at_service: r.km_at_service,
      description: r.description,
    })),
  });
}
