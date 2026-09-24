import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Yönetici: tüm kullanıcılar + kullanım özeti (kim kayıt oldu, en son ne
// zaman girdi, kaç araç / bakım kaydı ekledi, en son ne yaptı).
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;

  const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
  const users = authData?.users ?? [];

  const [staffRes, tenantsRes, adminsRes, vehiclesRes, recordsRes] = await Promise.all([
    db.from("staff_users").select("id, tenant_id, role"),
    db.from("tenants").select("id, name"),
    db.from("platform_admins").select("user_id"),
    db.from("vehicles").select("id, owner_user_id, tenant_id, created_at"),
    db.from("maintenance_records").select("id, created_by, created_at, tenant_id"),
  ]);

  const tenantName: Record<string, string> = {};
  for (const t of tenantsRes.data ?? []) tenantName[t.id] = t.name;
  const staffById: Record<string, any> = {};
  for (const s of staffRes.data ?? []) staffById[s.id] = s;
  const adminIds = new Set((adminsRes.data ?? []).map((a: any) => a.user_id));
  const vehicles = vehiclesRes.data ?? [];
  const records = recordsRes.data ?? [];

  const rows = users.map((u: any) => {
    const staff = staffById[u.id];
    const type = adminIds.has(u.id) ? "yonetici" : staff ? "servis" : "bireysel";
    const myRecords = records.filter((r: any) => r.created_by === u.id);
    const lastRecord = myRecords.reduce((m: string | null, r: any) => (!m || r.created_at > m ? r.created_at : m), null);
    const myVehicles =
      type === "servis"
        ? vehicles.filter((v: any) => v.tenant_id === staff.tenant_id).length
        : vehicles.filter((v: any) => v.owner_user_id === u.id).length;
    return {
      id: u.id,
      email: u.email,
      type,
      tenant_name: staff ? tenantName[staff.tenant_id] ?? "—" : null,
      staff_role: staff ? staff.role : null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed: !!u.email_confirmed_at,
      vehicles: myVehicles,
      records_created: myRecords.length,
      last_record_at: lastRecord,
    };
  });

  rows.sort((a: any, b: any) => String(b.last_sign_in_at || b.created_at).localeCompare(String(a.last_sign_in_at || a.created_at)));

  return NextResponse.json({ users: rows });
}
