// OTOİZ — servis onay/red (yalnız platform yöneticisi). Yeni servis kaydı
// "pending" başlar; yalnız "approved" servis araç/bakım/QR işlemi yapabilir
// (RLS: public.approved_staff_tenant_ids()). Her karar audit_log'a yazılır.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
  const decision = body.decision;
  if (!tenantId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json({ error: "Servis ve karar (approve/reject) gerekli" }, { status: 400 });
  }
  const status = decision === "approve" ? "approved" : "rejected";

  const { data: t } = await db.from("tenants").select("id, name, approval_status").eq("id", tenantId).maybeSingle();
  if (!t) return NextResponse.json({ error: "Servis bulunamadı" }, { status: 404 });

  const { error } = await db
    .from("tenants")
    .update({ approval_status: status, approval_decided_at: new Date().toISOString(), approval_decided_by: ctx.userId })
    .eq("id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("audit_log").insert({
    tenant_id: tenantId,
    actor_staff_id: null,
    action: decision === "approve" ? "admin_service_approved" : "admin_service_rejected",
    target_table: "tenants",
    target_id: tenantId,
    detail: { previous_status: t.approval_status, new_status: status, actor_user_id: ctx.userId, via: "admin_panel" },
  });

  return NextResponse.json({ ok: true, status, name: t.name });
}
