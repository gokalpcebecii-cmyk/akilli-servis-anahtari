// OTOİZ — Alıcı Raporu e-posta gönderimi. Sahip paylaşımının AKTİF olduğu
// aracın verisi için e-posta hazırlanır. Mail içeriğinde private veri YOK
// ( yalnızca kısa mesaj + paylaşım linki + isteğe bağlı PDF PDF linki notu).
// Email adresi kalıcı pazarlama listesine yazılmaz; yalnızca gönderim logu
// (audit_log) tutulur. Sağlayıcı anahtarı yoksa: audit log + bilgilendirme.
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { withApiLog } from "@/lib/appEvents";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
import { createServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { isBuyerEmail, isShareExpired } = require("@/lib/buyerReport");
const { LIMITS } = require("@/lib/rateLimitCore");

function emailHtml({ shareUrl, brand, model }: { shareUrl: string; brand: string; model: string }) {
  // Burada HTML injeksiyon riski yok: alıcı yalnızca allowlist alanları
  // (public share URL'i ve güvenli araç etiketi) kullanır.
  const label = `${brand} ${model}`.replace(/[<>"']/g, "").slice(0, 80);
  const safeUrl = String(shareUrl || "").replace(/"/g, "");
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0F1115;color:#F5F7FA;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#181D27;border-radius:16px;padding:28px">
    <h1 style="color:#22C55E;font-size:20px;margin:0 0 12px">OTOİZ Alıcı Raporu</h1>
    <p style="color:#A9B3C1;line-height:1.6;margin:0 0 16px"><strong>${label}</strong> için dijital servis pasaportu sizinle paylaşıldı.</p>
    <a href="${safeUrl}" style="display:inline-block;background:#22C55E;color:#0F1115;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px;margin:0 8px 8px 0">Raporu Görüntüle</a>
    <a href="${safeUrl}" style="display:inline-block;color:#86EFAC;text-decoration:none;font-weight:600;padding:14px 0">PDF'yi İndir</a>
    <p style="color:#7F8896;font-size:13px;line-height:1.5;margin:16px 0 0">OTOİZ Alıcı Raporu, sisteme kaydedilmiş bakım ve araç bilgilerini gösterir. Ekspertiz veya mekanik durum garantisi değildir.</p>
  </div></body></html>`;
}

async function handlePOST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." }, { status: 401 });
  }
  const userApp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await userApp.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const email = String(body.email || "").trim();
  const vehicleId = String(body.vehicle_id || "");
  if (!isBuyerEmail(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  if (!vehicleId) return NextResponse.json({ error: "Araç bulunamadı." }, { status: 400 });

  if (await isRateLimited([{ scope: "buyer-email-h", value: user.id, ...LIMITS.buyerEmailHour }])) return rateLimitedResponse();

  // Araç sahibi mi? (JWT ile doğrulanan kullanıcı)
  const { data: vehicle } = await userApp.from("vehicles").select("id, owner_user_id, plate, brand, model").eq("id", vehicleId).maybeSingle();
  if (!vehicle || vehicle.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Bu araca erişim yetkiniz yok." }, { status: 403 });
  }

  const db = createServerSupabase();
  const { data: shares } = await db
    .from("buyer_shares")
    .select("id, expires_at, revoked_at")
    .eq("vehicle_id", vehicleId)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const active = (shares ?? []).find((s: any) => !s.revoked_at && !isShareExpired(s));
  if (!active) {
    return NextResponse.json({ error: "Aktif paylaşımınız yok. Önce QR ile paylaşım oluşturun." }, { status: 400 });
  }

  // Paylaşım açık ise UI, create yanıtında bir kez gördüğü düz token'ı
  // (yalnızca /alici/<token> formatında) gönderebilir; sunucu e‑posta
  // içeriğine yalnızca bu güvenli /alici kökü altındaki linki koyar.
  const shareUrl = String(body.share_url || "");
  if (!/^\/alici\/[A-Za-z0-9_-]{20,120}$/.test(shareUrl)) {
    return NextResponse.json({ error: "Paylaşım linki geçerli değil veya süresi dolmuş." }, { status: 400 });
  }
  const payload = {
    to: email,
    subject: `${String(vehicle.brand || "")} ${String(vehicle.model || "")}`.replace(/[\r\n<>"']/g, " ").slice(0, 90) + " — OTOİZ Dijital Servis Pasaportu",
    html: emailHtml({ shareUrl, brand: vehicle.brand, model: vehicle.model }),
  };

  const webhook = String(process.env.OTOIZ_EMAIL_WEBHOOK_URL || "").trim();
  if (!webhook) {
    // Yapılandırma YOK: sahte başarı DÖNMEZ — Türkçe anlamlı durum döner.
    // Audit log yazılır ama "mail gönderildi" anlamına gelmez.
    await db.from("audit_log").insert({
      tenant_id: null,
      actor_staff_id: null,
      action: "buyer_report_email",
      target_table: "buyer_shares",
      target_id: active.id,
      detail: { vehicle_id: vehicleId, delivery: "unavailable", subject: payload.subject },
    }).then(() => null, () => null);
    return NextResponse.json(
      { error: "E-posta gönderimi şu anda kullanılamıyor. QR veya PDF ile paylaşabilirsiniz." },
      { status: 503 }
    );
  }

  try {
    const r = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) {
      await db.from("audit_log").insert({
        tenant_id: null,
        actor_staff_id: null,
        action: "buyer_report_email",
        target_table: "buyer_shares",
        target_id: active.id,
        detail: { vehicle_id: vehicleId, delivery: "failed", subject: payload.subject },
      }).then(() => null, () => null);
      return NextResponse.json(
        { error: "E-posta gönderilemedi. Lütfen biraz sonra tekrar deneyin." },
        { status: 502 }
      );
    }
    await db.from("audit_log").insert({
      tenant_id: null,
      actor_staff_id: null,
      action: "buyer_report_email",
      target_table: "buyer_shares",
      target_id: active.id,
      detail: { vehicle_id: vehicleId, delivery: "sent", subject: payload.subject },
    }).then(() => null, () => null);
    return NextResponse.json({ ok: true, delivery: "sent" });
  } catch {
    await db.from("audit_log").insert({
      tenant_id: null,
      actor_staff_id: null,
      action: "buyer_report_email",
      target_table: "buyer_shares",
      target_id: active.id,
      detail: { vehicle_id: vehicleId, delivery: "failed", subject: payload.subject },
    }).then(() => null, () => null);
    return NextResponse.json(
      { error: "E-posta gönderilemedi. Lütfen biraz sonra tekrar deneyin." },
      { status: 502 }
    );
  }
}

export const POST = withApiLog("/api/alici-raporu/email", handlePOST);
