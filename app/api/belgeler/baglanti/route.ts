// OTOİZ — Belge dosyası için kısa ömürlü (15 dk) imzalı bağlantı.
// 1) Belge satırı KULLANICININ JWT'siyle (RLS) okunur — görünmüyorsa 404.
// 2) Ancak görünen satırın yolu için, sunucuda servis rolüyle imza üretilir.
// Dosya yolu istemciden ALINMAZ; kova public değildir; servis rolü anahtarı
// istemciye hiç çıkmaz.
import { NextRequest, NextResponse } from "next/server";
import { withApiLog } from "@/lib/appEvents";
import { createServerSupabase } from "@/lib/supabase";
import { isRateLimited, rateLimitedResponse } from "@/lib/rateLimit";
import { userClientFrom } from "@/lib/documentApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { parseDocumentIds, signVisibleDocuments, MAX_SIGN_BATCH } = require("@/lib/documentTransfer");

async function handlePOST(req: NextRequest) {
  const auth = await userClientFrom(req);
  if (!auth) return NextResponse.json({ error: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const raw = body.document_id ? [body.document_id] : body.document_ids;
  const ids = parseDocumentIds(raw, MAX_SIGN_BATCH);
  if (!ids || !ids.length) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  if (await isRateLimited([{ scope: "doc-sign-10m", value: auth.user.id, windowSeconds: 600, max: 300 }])) return rateLimitedResponse();

  const result = await signVisibleDocuments({
    ids,
    readVisible: async (list: string[]) => {
      const { data, error } = await auth.client.from("vehicle_documents").select("id, vehicle_id, storage_path").in("id", list);
      if (error) throw error;
      return data ?? [];
    },
    sign: async (paths: string[], seconds: number) => {
      const { data } = await createServerSupabase().storage.from("vehicle-documents").createSignedUrls(paths, seconds);
      return data ?? [];
    },
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

export const POST = withApiLog("/api/belgeler/baglanti", handlePOST);
