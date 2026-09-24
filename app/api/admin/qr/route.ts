import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
const { generateQrCode, normalizeQrCode } = require("@/lib/qrToken");
const { accountCodeFromUserId } = require("@/lib/passwordPolicy");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_BATCH = 500;

async function audit(db: any, adminId: string, action: string, targetId: string | null, detail: Record<string, any>, tenantId: string | null = null) {
  await db.from("audit_log").insert({
    tenant_id: tenantId,
    actor_staff_id: null,
    action,
    target_table: "qr_keys",
    target_id: targetId,
    detail: { ...detail, actor_user_id: adminId, via: "admin_panel" },
  });
}

// GET /api/admin/qr?filter=all|free|reserved|assigned|revoked&batch=...
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "all";
  const batch = url.searchParams.get("batch") || "";

  let q = db
    .from("qr_keys")
    .select("id, code, batch_label, created_at, assigned_at, revoked_at, vehicle_id, reserved_tenant_id, reserved_user_id")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (batch) q = q.eq("batch_label", batch);
  if (filter === "free") q = q.is("vehicle_id", null).is("reserved_tenant_id", null).is("reserved_user_id", null).is("revoked_at", null);
  if (filter === "reserved") q = q.is("vehicle_id", null).not("reserved_tenant_id", "is", null).is("revoked_at", null);
  if (filter === "reserved_user") q = q.is("vehicle_id", null).not("reserved_user_id", "is", null).is("revoked_at", null);
  if (filter === "assigned") q = q.not("vehicle_id", "is", null).is("revoked_at", null);
  if (filter === "revoked") q = q.not("revoked_at", "is", null);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const vehicleIds = Array.from(new Set((rows ?? []).map((r: any) => r.vehicle_id).filter(Boolean)));
  const vehicleMap: Record<string, any> = {};
  if (vehicleIds.length > 0) {
    const { data: vs } = await db.from("vehicles").select("id, plate, brand, model, tenant_id, owner_user_id").in("id", vehicleIds);
    for (const v of vs ?? []) vehicleMap[v.id] = v;
  }
  const { data: tenants } = await db.from("tenants").select("id, name");
  const tenantName: Record<string, string> = {};
  for (const t of tenants ?? []) tenantName[t.id] = t.name;

  // Bireysel kullanıcıya tanımlı kodlar için e-posta (yalnız yönetici görür).
  const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.reserved_user_id).filter(Boolean))) as string[];
  const userEmail: Record<string, string> = {};
  for (const uid of userIds) {
    const { data } = await db.auth.admin.getUserById(uid);
    if (data?.user) userEmail[uid] = data.user.email ?? "—";
  }

  const { data: batchRows } = await db.from("qr_keys").select("batch_label").not("batch_label", "is", null);
  const batches = Array.from(new Set((batchRows ?? []).map((b: any) => b.batch_label))).sort().reverse();

  return NextResponse.json({
    batches,
    codes: (rows ?? []).map((r: any) => {
      const v = r.vehicle_id ? vehicleMap[r.vehicle_id] : null;
      const status = r.revoked_at ? "revoked" : r.vehicle_id ? "assigned" : r.reserved_tenant_id ? "reserved" : r.reserved_user_id ? "reserved_user" : "free";
      return {
        id: r.id,
        code: r.code,
        batch_label: r.batch_label,
        created_at: r.created_at,
        assigned_at: r.assigned_at,
        revoked_at: r.revoked_at,
        status,
        reserved_tenant: r.reserved_tenant_id ? { id: r.reserved_tenant_id, name: tenantName[r.reserved_tenant_id] ?? "—" } : null,
        reserved_user: r.reserved_user_id ? { id: r.reserved_user_id, email: userEmail[r.reserved_user_id] ?? "—" } : null,
        vehicle: v
          ? {
              id: v.id,
              plate: v.plate,
              brand: v.brand,
              model: v.model,
              owner_type: v.tenant_id ? "servis" : "bireysel",
              tenant_name: v.tenant_id ? tenantName[v.tenant_id] ?? "—" : null,
            }
          : null,
      };
    }),
  });
}

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
  const action = body.action;

  // ---- Toplu QR üretimi (yalnız yönetici) ----
  if (action === "generate") {
    const count = Math.floor(Number(body.count));
    if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH) {
      return NextResponse.json({ error: `Adet 1 ile ${MAX_BATCH} arasında olmalı` }, { status: 400 });
    }
    const reservedTenantId = body.reserved_tenant_id || null;
    if (reservedTenantId) {
      const { data: t } = await db.from("tenants").select("id, approval_status").eq("id", reservedTenantId).maybeSingle();
      if (!t) return NextResponse.json({ error: "Servis bulunamadı" }, { status: 400 });
      if (t.approval_status !== "approved") return NextResponse.json({ error: "Servis henüz onaylanmadı" }, { status: 400 });
    }
    const now = new Date();
    const stamp = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(now);
    const batchLabel = (typeof body.batch_label === "string" && body.batch_label.trim()) || `Parti ${stamp} (${count} adet)`;

    // Benzersizlik: üret → veritabanında var olanları ele → eksikleri yeniden üret.
    const codes = new Set<string>();
    for (let attempt = 0; attempt < 6 && codes.size < count; attempt++) {
      const candidates: string[] = [];
      while (candidates.length + codes.size < count) {
        const c = generateQrCode();
        if (!codes.has(c) && !candidates.includes(c)) candidates.push(c);
      }
      const { data: existing } = await db.from("qr_keys").select("code").in("code", candidates);
      const taken = new Set((existing ?? []).map((e: any) => e.code));
      for (const c of candidates) if (!taken.has(c)) codes.add(c);
    }
    if (codes.size < count) return NextResponse.json({ error: "Benzersiz kod üretilemedi, tekrar deneyin" }, { status: 500 });

    const rows = Array.from(codes).map((code) => ({
      code,
      batch_label: batchLabel,
      created_by: ctx.userId,
      reserved_tenant_id: reservedTenantId,
    }));
    const { data: inserted, error } = await db.from("qr_keys").insert(rows).select("id, code");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(db, ctx.userId, "admin_qr_generated", null, { count: rows.length, batch_label: batchLabel, reserved_tenant_id: reservedTenantId }, reservedTenantId);
    return NextResponse.json({ ok: true, batch_label: batchLabel, codes: (inserted ?? []).map((r: any) => r.code) });
  }

  const code = typeof body.code === "string" ? normalizeQrCode(body.code) : "";

  // ---- QR'ı doğrudan bir araca bağla (bireysel ya da servis aracı) ----
  if (action === "assign") {
    const vehicleId = body.vehicle_id;
    if (!code || !vehicleId) return NextResponse.json({ error: "Kod ve araç gerekli" }, { status: 400 });
    const { data: qr } = await db.from("qr_keys").select("id, vehicle_id, revoked_at, reserved_tenant_id").eq("code", code).maybeSingle();
    if (!qr) return NextResponse.json({ error: "Kod bulunamadı" }, { status: 404 });
    if (qr.revoked_at) return NextResponse.json({ error: "Bu kod iptal edilmiş" }, { status: 400 });
    if (qr.vehicle_id) return NextResponse.json({ error: "Bu kod zaten bir araca bağlı" }, { status: 400 });
    const { data: v } = await db.from("vehicles").select("id, tenant_id, plate").eq("id", vehicleId).maybeSingle();
    if (!v) return NextResponse.json({ error: "Araç bulunamadı" }, { status: 404 });
    const { data: active } = await db.from("qr_keys").select("code").eq("vehicle_id", vehicleId).is("revoked_at", null).maybeSingle();
    if (active) return NextResponse.json({ error: `Bu aracın zaten aktif bir QR'ı var (${active.code}). Önce onu iptal edin.` }, { status: 400 });
    const { error } = await db
      .from("qr_keys")
      .update({ vehicle_id: vehicleId, assigned_at: new Date().toISOString() })
      .eq("id", qr.id)
      .is("vehicle_id", null)
      .is("revoked_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(db, ctx.userId, "admin_qr_assigned", qr.id, { code, vehicle_id: vehicleId, plate: v.plate }, v.tenant_id);
    return NextResponse.json({ ok: true });
  }

  // ---- Boştaki kodları bir servise ayır ----
  if (action === "reserve") {
    const tenantId = body.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Servis seçin" }, { status: 400 });
    const { data: t } = await db.from("tenants").select("id, name, approval_status").eq("id", tenantId).maybeSingle();
    if (!t) return NextResponse.json({ error: "Servis bulunamadı" }, { status: 404 });
    if (t.approval_status !== "approved") return NextResponse.json({ error: "Servis henüz onaylanmadı; önce Servisler sekmesinden onaylayın" }, { status: 400 });
    let targetCodes: string[] = Array.isArray(body.codes) ? body.codes.map((c: any) => normalizeQrCode(c)).filter(Boolean) : [];
    if (targetCodes.length === 0) {
      const n = Math.floor(Number(body.count));
      if (!Number.isFinite(n) || n < 1 || n > MAX_BATCH) return NextResponse.json({ error: "Adet geçersiz" }, { status: 400 });
      const { data: free } = await db
        .from("qr_keys")
        .select("code")
        .is("vehicle_id", null)
        .is("reserved_tenant_id", null)
        .is("reserved_user_id", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: true })
        .limit(n);
      targetCodes = (free ?? []).map((f: any) => f.code);
      if (targetCodes.length < n) return NextResponse.json({ error: `Boşta yalnız ${targetCodes.length} kod var. Önce yeni QR üretin.` }, { status: 400 });
    }
    const { data: updated, error } = await db
      .from("qr_keys")
      .update({ reserved_tenant_id: tenantId })
      .in("code", targetCodes)
      .is("vehicle_id", null)
      .is("reserved_user_id", null)
      .is("revoked_at", null)
      .select("code");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(db, ctx.userId, "admin_qr_reserved", null, { tenant_id: tenantId, count: (updated ?? []).length }, tenantId);
    return NextResponse.json({ ok: true, reserved: (updated ?? []).length, tenant: t.name });
  }

  // ---- Bireysel satış: boştaki kod(lar)ı bir bireysel kullanıcıya tanımla ----
  // Kullanıcı önce OTOİZ'e bireysel olarak kayıt olmuş olmalı (e-posta ile
  // bulunur). Servis personeli hesabına tanımlanamaz. Kullanıcı kodu kendi
  // aracına "Anahtarlığımı bağla" ekranından bağlar.
  if (action === "reserve_user") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return NextResponse.json({ error: "Geçerli bir e-posta girin" }, { status: 400 });
    let found: any = null;
    for (let page = 1; page <= 20 && !found; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      found = (data?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email) ?? null;
      if (!data?.users || data.users.length < 1000) break;
    }
    if (!found) {
      return NextResponse.json({ error: "Bu e-postayla kayıtlı kullanıcı yok. Müşteri önce OTOİZ'e bireysel kayıt olmalı." }, { status: 404 });
    }
    const accountCode = typeof body.account_code === "string" ? body.account_code.trim().toUpperCase().replace(/\s+/g, "") : "";
    if (!accountCode || accountCode !== accountCodeFromUserId(found.id)) {
      return NextResponse.json({ error: "Hesap kodu bu e-postayla eşleşmiyor. Müşterinin uygulamasındaki Profil sayfasında yazan kodu girin." }, { status: 400 });
    }
    if (!found.email_confirmed_at) {
      return NextResponse.json({ error: "Müşterinin e-posta adresi henüz doğrulanmamış. Doğrulandıktan sonra tanımlayın." }, { status: 400 });
    }
    const { data: staffRow } = await db.from("staff_users").select("id").eq("id", found.id).maybeSingle();
    if (staffRow) return NextResponse.json({ error: "Bu e-posta bir servis personeline ait. Servis kodları 'servise ayır' ile verilir." }, { status: 400 });

    let targetCodes: string[] = code ? [code] : [];
    if (targetCodes.length === 0) {
      const n = Math.floor(Number(body.count ?? 1));
      if (!Number.isFinite(n) || n < 1 || n > 20) return NextResponse.json({ error: "Adet 1 ile 20 arasında olmalı" }, { status: 400 });
      const { data: free } = await db
        .from("qr_keys")
        .select("code")
        .is("vehicle_id", null)
        .is("reserved_tenant_id", null)
        .is("reserved_user_id", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: true })
        .limit(n);
      targetCodes = (free ?? []).map((f: any) => f.code);
      if (targetCodes.length < n) return NextResponse.json({ error: `Boşta yalnız ${targetCodes.length} kod var. Önce yeni QR üretin.` }, { status: 400 });
    }
    // Açıkça verilen tek kod başka bir müşteriye ayrılmış olsa bile yeniden
    // atanabilir (yönetici kararı); servise ayrılmış, bağlı ya da iptal
    // edilmiş kod ise değiştirilemez.
    const { data: updated, error } = await db
      .from("qr_keys")
      .update({ reserved_user_id: found.id, reserved_tenant_id: null })
      .in("code", targetCodes)
      .is("vehicle_id", null)
      .is("reserved_tenant_id", null)
      .is("revoked_at", null)
      .select("id, code");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) return NextResponse.json({ error: "Kod boşta değil (servise ayrılmış, bağlı ya da iptal)" }, { status: 400 });
    await audit(db, ctx.userId, "admin_qr_reserved_user", null, { email, codes: updated.map((u: any) => u.code) });
    return NextResponse.json({ ok: true, reserved: updated.length, codes: updated.map((u: any) => u.code), email });
  }

  // ---- Servis / kullanıcı ayırmasını kaldır ----
  if (action === "unreserve") {
    if (!code) return NextResponse.json({ error: "Kod gerekli" }, { status: 400 });
    const { error } = await db.from("qr_keys").update({ reserved_tenant_id: null, reserved_user_id: null }).eq("code", code).is("vehicle_id", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(db, ctx.userId, "admin_qr_unreserved", null, { code });
    return NextResponse.json({ ok: true });
  }

  // ---- İptal (geri alınamaz; araç geçmişi korunur) ----
  if (action === "revoke") {
    if (!code) return NextResponse.json({ error: "Kod gerekli" }, { status: 400 });
    const { data: qr } = await db.from("qr_keys").select("id, revoked_at").eq("code", code).maybeSingle();
    if (!qr) return NextResponse.json({ error: "Kod bulunamadı" }, { status: 404 });
    if (qr.revoked_at) return NextResponse.json({ error: "Zaten iptal edilmiş" }, { status: 400 });
    const { error } = await db.from("qr_keys").update({ revoked_at: new Date().toISOString() }).eq("id", qr.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(db, ctx.userId, "admin_qr_revoked", qr.id, { code });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
}
