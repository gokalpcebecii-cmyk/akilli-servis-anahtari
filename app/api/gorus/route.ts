// OTOİZ — Görüş Bildir. Oturumlu kullanıcının kısa görüşünü pilot_feedback
// tablosuna yazar. Kimlik kullanıcının kendi JWT'siyle doğrulanır; yazma
// sunucu istemcisiyle yapılır. Kullanıcı başına saatlik sınır vardır.
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { withApiLog } from "@/lib/appEvents";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
const { normalizeFeedback } = require("@/lib/feedback");
const { LIMITS } = require("@/lib/rateLimitCore");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function currentUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader }, fetch: (i: any, o?: any) => fetch(i, { ...(o || {}), cache: "no-store" }) },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  return data?.user ?? null;
}

async function handlePOST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Gönderilemedi. Lütfen tekrar deneyin." }, { status: 400 });
  }
  const { valid, errors, value } = normalizeFeedback(body);
  if (!valid) return NextResponse.json({ errors }, { status: 400 });

  if (await isRateLimited([{ scope: "feedback-user-hour", value: user.id, ...LIMITS.feedbackUserHour }])) {
    return rateLimitedResponse();
  }

  const db = createServerSupabase();
  const { error } = await db.from("pilot_feedback").insert({
    user_id: user.id,
    category: value.category,
    screen: value.screen,
    message: value.message,
    screenshot_path: value.screenshot_path,
  });
  if (error) return NextResponse.json({ error: "Gönderilemedi. Lütfen biraz sonra tekrar deneyin." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const POST = withApiLog("/api/gorus", handlePOST);
