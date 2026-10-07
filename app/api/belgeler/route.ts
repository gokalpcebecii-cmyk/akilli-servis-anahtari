// OTOİZ — Araç belgeleri (metadata) API'si. Kullanıcının JWT'siyle RLS
// altında okur: yalnız yükleyen (aracı hâlâ elinde tutuyorsa) ya da KABUL
// EDİLMİŞ devirde belgesi açıkça aktarılan yeni sahip görür. Seçilmeyen
// belge hiç dönmez.
import { NextRequest, NextResponse } from "next/server";
import { withApiLog } from "@/lib/appEvents";
import { userClientFrom } from "@/lib/documentApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { isUuid, presentDocument } = require("@/lib/documentTransfer");

async function handleGET(req: NextRequest) {
  const auth = await userClientFrom(req);
  if (!auth) return NextResponse.json({ error: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." }, { status: 401 });

  const vehicleId = req.nextUrl.searchParams.get("vehicle_id") || "";
  const documentId = req.nextUrl.searchParams.get("id") || "";
  if (!isUuid(vehicleId) && !isUuid(documentId)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  let q = auth.client
    .from("vehicle_documents")
    .select("id, vehicle_id, uploaded_by, doc_type, doc_date, note, storage_path, file_name, mime_type, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (isUuid(vehicleId)) q = q.eq("vehicle_id", vehicleId);
  if (isUuid(documentId)) q = q.eq("id", documentId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Belgeler şu an yüklenemedi." }, { status: 500 });

  const documents = (data ?? []).map((r: any) => presentDocument(r, auth.user.id));
  if (isUuid(documentId) && !documents.length) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
  return NextResponse.json({ documents }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiLog("/api/belgeler", handleGET);
