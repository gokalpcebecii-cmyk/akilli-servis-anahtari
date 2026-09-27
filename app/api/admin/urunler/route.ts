// OTOİZ Faz 3 — fiziksel ürün partileri (yalnız platform yöneticisi).
//
// Ürün = qr_keys satırı (tek gerçek kaynak). Parti üretimi tek işlemde
// admin_create_product_batch() ile yapılır: seri no, 26 karakter QR token'ı,
// tek kullanımlık aktivasyon kodu (yalnız bcrypt özeti saklanır) ve aynı
// batch_id. Aktivasyon kodlarının düz metni YALNIZ üretim yanıtında bir kez
// döner; sonradan okunamaz (kayıp kartta "yeni kod ver" kullanılır).
//
// Normal satışta yönetici ürünü müşteriye/araca ATAMAZ: müşteri kendisi
// etkinleştirir (/aktivasyon). Servis yalnız dağıtım kanalıdır
// (distributor_tenant_id); ürünü sahiplenmez, eşleştiremez.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminContext } from "@/lib/adminAuth";
const { generateQrCode } = require("@/lib/qrToken");
const { generateActivationCode } = require("@/lib/activationCodeGen");
const { qrIssuanceLocked, QR_LOCK_MESSAGE } = require("@/lib/qrUrl");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_BATCH = 500;
const CHANNELS = ["internet", "servis", "bayi", "merkez", "bireysel"];
const PRE_ACTIVATION = ["created", "in_stock", "distributed"];

async function audit(db: any, adminId: string, action: string, targetTable: string, targetId: string | null, detail: Record<string, any>, tenantId: string | null = null) {
  await db.from("audit_log").insert({
    tenant_id: tenantId,
    actor_staff_id: null,
    action,
    target_table: targetTable,
    target_id: targetId,
    detail: { ...detail, actor_user_id: adminId, via: "admin_panel" },
  });
}

// Tarayıcı doğrulama raporu: yalnız beklenen alanlar, boyut sınırlı. Kod veya
// token içermez (problem satırları yalnız seri no taşır).
function sanitizeClientReport(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const bool = (v: any) => v === true;
  const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const checks: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw.checks ?? {}).slice(0, 12)) {
    const c: any = v ?? {};
    checks[String(k).slice(0, 32)] = {
      ok: bool(c.ok), passed: num(c.passed), total: num(c.total), count: num(c.count),
      expected: num(c.expected), actual: num(c.actual),
    };
  }
  const files: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw.files ?? {}).slice(0, 10)) {
    const f: any = v ?? {};
    files[String(k).slice(0, 32)] = { ok: bool(f.ok), size: num(f.size) };
  }
  const problems = Array.isArray(raw.problems)
    ? raw.problems.slice(0, 20).map((p: any) => String(p).replace(/[a-z0-9]{26}/g, "…").slice(0, 160))
    : [];
  return {
    ok: bool(raw.ok) && Object.values(checks).every((c: any) => c.ok) && Object.values(files).every((f: any) => f.ok),
    scope: raw.scope === "generation" ? "generation" : "reverify",
    base: typeof raw.base === "string" ? raw.base.slice(0, 80) : null,
    printable: num(raw.printable),
    checks, files, problems,
    measured_at: new Date().toISOString(),
  };
}

// GET                      → partiler + durum sayıları
// GET ?batch_id=<uuid>     → partinin ürünleri (aktivasyon kodu YOK)
// GET ?serial=OTZ-000123   → tek ürün
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!isAdminContext(ctx)) return ctx;
  const db = ctx.db;
  const url = new URL(req.url);
  const batchId = url.searchParams.get("batch_id");
  const serial = url.searchParams.get("serial");

  const productCols =
    "id, serial_no, code, status, distribution_channel, distributor_tenant_id, batch_id, created_at, assigned_at, revoked_at, activation_locked_until, replaces_qr_key_id";

  if (batchId || serial) {
    let q = db.from("qr_keys").select(productCols).order("serial_no", { ascending: true }).limit(MAX_BATCH);
    q = batchId ? q.eq("batch_id", batchId) : q.eq("serial_no", String(serial).trim().toUpperCase());
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: tenants } = await db.from("tenants").select("id, name");
    const tName: Record<string, string> = {};
    for (const t of tenants ?? []) tName[t.id] = t.name;
    let batch = null;
    if (batchId) {
      const { data: b } = await db.from("product_batches").select("id, label, quantity, default_channel, created_at, verification, verified_at").eq("id", batchId).maybeSingle();
      batch = b;
    }
    return NextResponse.json({
      batch,
      products: (data ?? []).map((p: any) => ({
        id: p.id,
        serial_no: p.serial_no,
        token: p.code,
        status: p.status,
        channel: p.distribution_channel,
        distributor: p.distributor_tenant_id ? tName[p.distributor_tenant_id] ?? "—" : null,
        batch_id: p.batch_id,
        created_at: p.created_at,
        activated_at: p.assigned_at,
        revoked_at: p.revoked_at,
        locked: !!(p.activation_locked_until && new Date(p.activation_locked_until) > new Date()),
        replaces: p.replaces_qr_key_id,
      })),
    });
  }

  const { data: batches, error } = await db
    .from("product_batches")
    .select("id, label, quantity, default_channel, created_at, verification, verified_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (batches ?? []).map((b: any) => b.id);
  const counts: Record<string, Record<string, number>> = {};
  const range: Record<string, { first: string; last: string; channels: Set<string> }> = {};
  if (ids.length > 0) {
    const { data: rows } = await db.from("qr_keys").select("batch_id, status, serial_no, distribution_channel").in("batch_id", ids);
    for (const r of rows ?? []) {
      counts[r.batch_id] = counts[r.batch_id] || {};
      counts[r.batch_id][r.status] = (counts[r.batch_id][r.status] || 0) + 1;
      const g = (range[r.batch_id] = range[r.batch_id] || { first: r.serial_no, last: r.serial_no, channels: new Set() });
      if (r.serial_no && r.serial_no < g.first) g.first = r.serial_no;
      if (r.serial_no && r.serial_no > g.last) g.last = r.serial_no;
      if (r.distribution_channel) g.channels.add(r.distribution_channel);
    }
  }
  return NextResponse.json({
    batches: (batches ?? []).map((b: any) => ({
      ...b,
      counts: counts[b.id] || {},
      serial_first: range[b.id]?.first ?? null,
      serial_last: range[b.id]?.last ?? null,
      channels: range[b.id] ? Array.from(range[b.id].channels) : [],
    })),
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

  // ---- Parti üretimi ----
  if (action === "generate") {
    if (qrIssuanceLocked()) {
      return NextResponse.json({ error: QR_LOCK_MESSAGE, code: "qr_issuance_locked" }, { status: 423 });
    }
    const count = Math.floor(Number(body.count));
    if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH) {
      return NextResponse.json({ error: `Adet 1 ile ${MAX_BATCH} arasında olmalı` }, { status: 400 });
    }
    const channel = body.channel ? String(body.channel) : null;
    if (channel && !CHANNELS.includes(channel)) return NextResponse.json({ error: "Geçersiz dağıtım kanalı" }, { status: 400 });
    const stamp = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(new Date());
    const label = (typeof body.label === "string" && body.label.trim().slice(0, 80)) || `Ürün partisi ${stamp} (${count} adet)`;

    // Token'lar mevcut kodlarla çakışmasın (128 bit; pratikte hiç olmaz).
    // Yine de çakışma olursa tüm parti geri alınır ve bir kez yeniden denenir.
    for (let attempt = 0; attempt < 2; attempt++) {
      const tokens = new Set<string>();
      while (tokens.size < count) tokens.add(generateQrCode());
      const codes = new Set<string>();
      while (codes.size < count) codes.add(generateActivationCode());
      const tokenList = Array.from(tokens);
      const codeList = Array.from(codes);
      const { data: existing } = await db.from("qr_keys").select("code").in("code", tokenList);
      if ((existing ?? []).length > 0) continue;

      const { data, error } = await db.rpc("admin_create_product_batch", {
        p_label: label,
        p_channel: channel,
        p_actor: ctx.userId,
        p_tokens: tokenList,
        p_codes: codeList,
      });
      if (error) {
        if (error.code === "23505" && attempt === 0) continue;
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const codeByToken: Record<string, string> = {};
      tokenList.forEach((t, i) => (codeByToken[t] = codeList[i]));
      // Aşama B: üretim biter bitmez veritabanı doğrulaması (adet, benzersizlik,
      // seri ↔ token ↔ aktivasyon kodu eşleşmesi). Kodlar yalnız bu anda var.
      const { data: verification, error: vErr } = await db.rpc("admin_verify_product_batch", {
        p_batch_id: data?.batch_id,
        p_tokens: tokenList,
        p_codes: codeList,
        p_actor: ctx.userId,
        p_client: null,
      });
      const items = (data?.items ?? []).map((it: any) => ({
        id: it.id,
        serial_no: it.serial_no,
        token: it.token,
        activation_code: codeByToken[it.token],
      }));
      return NextResponse.json({
        ok: true, batch_id: data?.batch_id, label, channel, items,
        verification: vErr ? null : verification,
        verification_error: vErr ? vErr.message : null,
      });
    }
    return NextResponse.json({ error: "Benzersiz kod üretilemedi, tekrar deneyin" }, { status: 500 });
  }

  // ---- Stok / dağıtım durumu (yalnız henüz aktive edilmemiş ürünler) ----
  if (action === "set_status") {
    const status = String(body.status || "");
    if (!["in_stock", "distributed"].includes(status)) return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
    const batchId = typeof body.batch_id === "string" ? body.batch_id : "";
    if (!batchId && ids.length === 0) return NextResponse.json({ error: "Parti ya da ürün seçin" }, { status: 400 });

    const patch: Record<string, any> = { status };
    let tenantId: string | null = null;
    if (status === "distributed") {
      const channel = String(body.channel || "");
      if (!CHANNELS.includes(channel)) return NextResponse.json({ error: "Dağıtım kanalı seçin" }, { status: 400 });
      patch.distribution_channel = channel;
      if (channel === "servis") {
        tenantId = typeof body.tenant_id === "string" && body.tenant_id ? body.tenant_id : null;
        if (!tenantId) return NextResponse.json({ error: "Servis seçin" }, { status: 400 });
        const { data: t } = await db.from("tenants").select("id, approval_status").eq("id", tenantId).maybeSingle();
        if (!t || t.approval_status !== "approved") return NextResponse.json({ error: "Servis bulunamadı ya da onaylı değil" }, { status: 400 });
      }
      patch.distributor_tenant_id = tenantId;
    }
    let q = db.from("qr_keys").update(patch).in("status", PRE_ACTIVATION).is("vehicle_id", null).is("revoked_at", null);
    q = batchId ? q.eq("batch_id", batchId) : q.in("id", ids);
    const { data: updated, error } = await q.select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(db, ctx.userId, "product_status_changed", batchId ? "product_batches" : "qr_keys", batchId || null, {
      status, channel: patch.distribution_channel ?? null, distributor_tenant_id: tenantId, count: (updated ?? []).length, ids: batchId ? undefined : ids,
    }, tenantId);
    return NextResponse.json({ ok: true, updated: (updated ?? []).length });
  }

  // ---- Aşama B: tarayıcı doğrulama sonucunu kaydet + veritabanı kontrollerini yeniden çalıştır ----
  if (action === "verify") {
    const batchId = typeof body.batch_id === "string" ? body.batch_id : "";
    if (!batchId) return NextResponse.json({ error: "Parti gerekli" }, { status: 400 });
    const client = sanitizeClientReport(body.client);
    const { data, error } = await db.rpc("admin_verify_product_batch", {
      p_batch_id: batchId, p_tokens: null, p_codes: null, p_actor: ctx.userId, p_client: client,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, verification: data });
  }

  // ---- Aşama B: paketleme dosyası kaybolduysa partiye yeni kodlar ----
  // Yalnız partideki TÜM ürünler hâlâ "created" iken (stoğa alınmamış,
  // dağıtılmamış, kart basılıp pakete girmemiş) izin verilir; eski kodlar
  // geçersiz olur. Yeni kodlar yalnız bu yanıtta döner.
  if (action === "reissue_batch_codes") {
    const batchId = typeof body.batch_id === "string" ? body.batch_id : "";
    if (!batchId) return NextResponse.json({ error: "Parti gerekli" }, { status: 400 });
    const { data: rows, error } = await db
      .from("qr_keys")
      .select("id, serial_no, code, status")
      .eq("batch_id", batchId)
      .order("serial_no", { ascending: true })
      .limit(MAX_BATCH);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows || rows.length === 0) return NextResponse.json({ error: "Parti bulunamadı" }, { status: 404 });
    if (rows.some((r: any) => r.status !== "created")) {
      return NextResponse.json({ error: "Partide stoğa alınmış, dağıtılmış ya da etkinleştirilmiş ürün var. Yeni kod yalnız tek tek (ürün satırından) verilebilir." }, { status: 409 });
    }
    const codes = new Set<string>();
    while (codes.size < rows.length) codes.add(generateActivationCode());
    const codeList = Array.from(codes);
    const items: any[] = [];
    for (let i = 0; i < rows.length; i += 10) {
      const chunk = rows.slice(i, i + 10);
      const results = await Promise.all(
        chunk.map((r: any, k: number) => db.rpc("admin_reissue_activation_code", { p_id: r.id, p_code: codeList[i + k], p_actor: ctx.userId }))
      );
      for (let k = 0; k < chunk.length; k++) {
        const { data, error: e } = results[k];
        if (e || !data?.ok) return NextResponse.json({ error: `Yeni kod verilemedi (${chunk[k].serial_no}). İşlemi tekrar başlatın.` }, { status: 500 });
        items.push({ id: chunk[k].id, serial_no: chunk[k].serial_no, token: chunk[k].code, activation_code: codeList[i + k] });
      }
    }
    await audit(db, ctx.userId, "product_batch_codes_reissued", "product_batches", batchId, { count: items.length });
    const { data: verification } = await db.rpc("admin_verify_product_batch", {
      p_batch_id: batchId, p_tokens: items.map((x) => x.token), p_codes: codeList, p_actor: ctx.userId, p_client: null,
    });
    return NextResponse.json({ ok: true, batch_id: batchId, items, verification });
  }

  const id = typeof body.id === "string" ? body.id : "";

  // ---- Arşivle: satılmamış/hasarlı ürün dolaşımdan çıkar (geri alınamaz) ----
  if (action === "archive") {
    if (!id) return NextResponse.json({ error: "Ürün gerekli" }, { status: 400 });
    const { data: updated, error } = await db
      .from("qr_keys")
      .update({ status: "archived", revoked_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", PRE_ACTIVATION)
      .is("vehicle_id", null)
      .select("id, serial_no");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) return NextResponse.json({ error: "Yalnız henüz etkinleştirilmemiş ürün arşivlenebilir" }, { status: 400 });
    await audit(db, ctx.userId, "product_archived", "qr_keys", id, { serial_no: updated[0].serial_no });
    return NextResponse.json({ ok: true });
  }

  // ---- Destek: kayıp kart → yeni aktivasyon kodu (yalnız bir kez gösterilir) ----
  if (action === "reissue_code") {
    if (!id) return NextResponse.json({ error: "Ürün gerekli" }, { status: 400 });
    const code = generateActivationCode();
    const { data, error } = await db.rpc("admin_reissue_activation_code", { p_id: id, p_code: code, p_actor: ctx.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ error: "Yalnız henüz etkinleştirilmemiş ürüne yeni kod verilebilir" }, { status: 400 });
    return NextResponse.json({ ok: true, serial_no: data.serial_no, activation_code: code });
  }

  return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
}
