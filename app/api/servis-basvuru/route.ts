// OTOİZ P0 — servis başvurusunu tamamla (e-posta doğrulandıktan sonra).
//
// Kimlik yalnız çağıranın kendi JWT'sinden gelir; başvuru veritabanında
// submit_service_application() ile, auth.uid() için ve auth.users
// .email_confirmed_at doluysa oluşturulur. Başka biri adına başvuru yapılamaz.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
const { LIMITS } = require("@/lib/rateLimitCore");
const { validateServiceFields, slugifyBusiness, applicationMessage } = require("@/lib/serviceSignup");
import { withApiLog } from "@/lib/appEvents";

async function handlePOST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Oturum bulunamadı. Lütfen giriş yapın." }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader }, fetch: (i: any, o?: any) => fetch(i, { ...(o || {}), cache: "no-store" }) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı. Lütfen giriş yapın." }, { status: 401 });
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: applicationMessage("email_not_confirmed"), code: "email_not_confirmed" }, { status: 403 });
  }

  if (await isRateLimited([{ scope: "svc-app-user-h", value: user.id, ...LIMITS.applicationUserHour }])) {
    return rateLimitedResponse();
  }

  const fields = validateServiceFields(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });

  const { data, error } = await userClient.rpc("submit_service_application", {
    p_business_name: fields.value.business_name,
    p_slug: slugifyBusiness(fields.value.business_name),
    p_phone: fields.value.phone || null,
    p_address: fields.value.address || null,
  });
  if (error || !data) {
    console.error("[otoiz] submit_service_application hatası:", error?.message);
    return NextResponse.json({ error: applicationMessage("error") }, { status: 500 });
  }
  const code = (data as any).code as string;
  if (!(data as any).ok) {
    const status = code === "email_not_confirmed" || code === "individual_account" ? 403 : 400;
    return NextResponse.json({ error: applicationMessage(code), code }, { status });
  }
  return NextResponse.json({ ok: true, code, approval_status: (data as any).approval_status, message: applicationMessage(code) });
}

export const POST = withApiLog("/api/servis-basvuru", handlePOST);
