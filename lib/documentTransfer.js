"use strict";
// OTOİZ — Devirde seçimli belge aktarımı + belge erişim API'si için saf
// mantık. Gerçek yetki kontrolü veritabanındadır (RLS +
// initiate_ownership_transfer); buradaki kontroller yalnız girdiyi temizler
// ve sunucu uçlarının akışını (önce RLS'den oku, sonra imzala) sabitler.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TRANSFER_DOCUMENTS = 200;
const MAX_SIGN_BATCH = 50;
const SIGNED_URL_SECONDS = 900;

const TRANSFER_DOCS_TITLE = "Yeni sahibine aktarmak istediğiniz belgeler";
const TRANSFER_DOCS_HINT = "Belgeleriniz otomatik olarak aktarılmaz. Yalnızca seçtikleriniz yeni araç sahibine devredilir.";
const TRANSFER_DOCS_EMPTY = "Bu araç için aktarılabilir belge bulunmuyor.";

function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

// Varsayılan seçim her zaman BOŞ.
function initialDocumentSelection() {
  return [];
}

function toggleDocumentSelection(selected, id) {
  const cur = Array.isArray(selected) ? selected : [];
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

// Seçimi yalnız gerçekten listelenen belgelerle sınırlar (UI tarafı);
// sunucu yine de her kimliği kendisi doğrular.
function selectedDocumentIds(selected, docs) {
  const allowed = new Set((docs || []).map((d) => d.id));
  return Array.from(new Set((selected || []).filter((id) => allowed.has(id))));
}

// API girdisi: kimlik dizisi. Geçersiz biçim → null (istek 400 ile reddedilir).
function parseDocumentIds(input, max = MAX_TRANSFER_DOCUMENTS) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  if (input.length > max) return null;
  for (const v of input) if (!isUuid(v)) return null;
  return Array.from(new Set(input.map((v) => v.toLowerCase())));
}

// initiate_ownership_transfer hatası → kullanıcı mesajı.
function transferErrorMessage(err) {
  const m = String((err && err.message) || "");
  if (m.includes("invalid_document")) return "Seçilen belgelerden biri bu araca ait değil veya erişiminiz yok. Sayfayı yenileyip tekrar seçin.";
  if (m.includes("too_many_documents")) return "Tek seferde en fazla 200 belge aktarılabilir.";
  return "Devir başlatılamadı. Lütfen tekrar deneyin.";
}

// GET /api/belgeler yanıtı: yükleyen kimliği dışarı verilmez; yalnız
// kullanıcının kendi yüklediği belgede silme için dosya yolu döner.
function presentDocument(row, userId) {
  const own = row.uploaded_by === userId;
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    doc_type: row.doc_type,
    doc_date: row.doc_date,
    note: row.note,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    own,
    ...(own ? { storage_path: row.storage_path } : {}),
  };
}

// İmzalı bağlantı akışı. readVisible: KULLANICININ JWT'siyle (RLS altında)
// belge satırlarını okur; görünmeyen kimlik dönmez. sign: sunucuda
// (servis rolü) yalnız bu satırların yolu için imzalı URL üretir.
// Hiçbir yol istemciden alınmaz; görünmeyen belge için imza İSTENMEZ.
async function signVisibleDocuments({ ids, readVisible, sign, seconds = SIGNED_URL_SECONDS }) {
  if (!ids.length) return { status: 400, body: { error: "Belge seçilmedi." } };
  const rows = (await readVisible(ids)) || [];
  const visible = rows.filter(
    (r) => r && ids.includes(r.id) && typeof r.storage_path === "string" && r.storage_path.startsWith(`${r.vehicle_id}/`)
  );
  if (!visible.length) return { status: 404, body: { error: "Belge bulunamadı." } };
  const signed = (await sign(visible.map((r) => r.storage_path), seconds)) || [];
  const byPath = new Map();
  for (const s of signed) if (s && s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
  const urls = {};
  for (const r of visible) {
    const u = byPath.get(r.storage_path);
    if (u) urls[r.id] = u;
  }
  // Tek belge istenip görünmüyorsa 404 (varlığı da sızdırılmaz).
  if (ids.length === 1 && !urls[ids[0]]) return { status: 404, body: { error: "Belge bulunamadı." } };
  return { status: 200, body: { urls, expires_in: seconds } };
}

module.exports = {
  MAX_TRANSFER_DOCUMENTS,
  MAX_SIGN_BATCH,
  SIGNED_URL_SECONDS,
  TRANSFER_DOCS_TITLE,
  TRANSFER_DOCS_HINT,
  TRANSFER_DOCS_EMPTY,
  isUuid,
  initialDocumentSelection,
  toggleDocumentSelection,
  selectedDocumentIds,
  parseDocumentIds,
  transferErrorMessage,
  presentDocument,
  signVisibleDocuments,
};
