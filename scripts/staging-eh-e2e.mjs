// OTOİZ E–H — GERÇEK staging Supabase (Auth + PostgREST + Storage) üzerinde uçtan uca test.
// Yalnız staging için. Kullanıcılar/araçlar önceden SQL ile oluşturulur (bkz. rapor).
// Kullanım: SUPABASE_URL=... ANON=... PW=... node scripts/staging-eh-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { signVisibleDocuments } = require("../lib/documentTransfer.js");

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.ANON;
const PW = process.env.PW;
if (!URL_.includes("ctltjunojlaanzurxpzy")) throw new Error("yalnız staging");
const V = "0e0e0e0e-1111-4000-8000-0000000000e1";
const W = "0e0e0e0e-1111-4000-8000-0000000000e2";
const results = [];
const check = (id, ok, got) => { results.push({ id, ok: !!ok, got }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${got !== undefined ? " " + JSON.stringify(got) : ""}`); };

async function login(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { c, uid: data.user.id };
}
const pdf = (t) => new Blob([`%PDF-1.4\n% OTOIZ E2E ${t}\n%%EOF\n`], { type: "application/pdf" });

const A = await login("eh-e2e-eski@example.test");
const B = await login("eh-e2e-alici@example.test");
const C = await login("eh-e2e-ucuncu@example.test");
check("AUTH", A.uid && B.uid && C.uid);

// Gerçek dosya yükleme (storage RLS) + metadata
async function upload(who, vid, type, name) {
  const path = `${vid}/${crypto.randomUUID()}.pdf`;
  const up = await who.c.storage.from("vehicle-documents").upload(path, pdf(name), { contentType: "application/pdf" });
  if (up.error) throw new Error("upload " + up.error.message);
  const ins = await who.c.from("vehicle_documents").insert({ vehicle_id: vid, uploaded_by: who.uid, doc_type: type, storage_path: path, file_name: name, mime_type: "application/pdf", size_bytes: 40 }).select("id").single();
  if (ins.error) throw new Error("insert " + ins.error.message);
  return { id: ins.data.id, path };
}
const DA = await upload(A, V, "servis_fisi", "servis-fisi.pdf");
const DB = await upload(A, V, "fatura", "kisisel-fatura.pdf");
const DX = await upload(C, W, "fatura", "baskasinin.pdf");

const listDocs = async (who, filter = {}) => {
  let q = who.c.from("vehicle_documents").select("id, vehicle_id, storage_path");
  if (filter.vehicle) q = q.eq("vehicle_id", filter.vehicle);
  if (filter.id) q = q.eq("id", filter.id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};
// Uç noktanın akışı: RLS okuması gerçek kullanıcı JWT'siyle (PostgREST); imza adımı
// burada servis rolü yerine "imza istendi mi" kaydıyla ölçülür.
const endpoint = async (who, ids) => {
  const asked = [];
  const r = await signVisibleDocuments({
    ids,
    readVisible: async (list) => { const { data, error } = await who.c.from("vehicle_documents").select("id, vehicle_id, storage_path").in("id", list); if (error) throw error; return data; },
    sign: async (paths) => { asked.push(...paths); return paths.map((p) => ({ path: p, signedUrl: "x://" + p })); },
  });
  return { status: r.status, asked };
};
const directSign = async (who, path) => {
  const { data, error } = await who.c.storage.from("vehicle-documents").createSignedUrl(path, 60);
  return error ? null : data?.signedUrl;
};

// E1: devir ekranının kaynağı
const e1 = await listDocs(A, { vehicle: V });
check("E1 eski sahip aracın 2 gerçek belgesini görür", e1.length === 2, e1.length);
const ownUrl = await directSign(A, DA.path);
let ownFetch = null;
if (ownUrl) ownFetch = (await fetch(ownUrl)).status;
check("E1 eski sahip kendi dosyasını gerçek imzalı bağlantıyla indirir (200)", ownFetch === 200, ownFetch);

// SECURITY: başkasının belgesi
const inj = await A.c.rpc("initiate_ownership_transfer", { p_vehicle_id: V, p_document_ids: [DX.id] });
check("SEC başkasının document_id'si reddedilir", inj.error && /invalid_document/.test(inj.error.message), inj.error?.message);
const v0 = await A.c.from("vehicles").select("id").eq("id", V);
check("SEC reddedilen denemeden sonra araç hâlâ eski sahipte", v0.data?.length === 1);

// H1 PENDING → H3 CANCEL
let t = await A.c.rpc("initiate_ownership_transfer", { p_vehicle_id: V, p_document_ids: [DA.id] });
check("H1 devir başlatıldı (yalnız A, 1 belge)", !t.error && t.data.document_count === 1, t.error?.message ?? t.data.document_count);
check("H1 PENDING alıcı metadata 0", (await listDocs(B, { vehicle: V })).length === 0);
let ep = await endpoint(B, [DA.id]);
check("H1 PENDING alıcı imzalı bağlantı 404", ep.status === 404 && ep.asked.length === 0, ep.status);
check("H1 PENDING alıcı depolamadan doğrudan imza alamaz", (await directSign(B, DA.path)) === null);
check("H1 PENDING eski sahip belgeleri görür (2)", (await listDocs(A, { vehicle: V })).length === 2);
const pv = await B.c.rpc("preview_ownership_transfer", { p_token: t.data.token });
check("H1 alıcı önizlemede yalnız sayı görür (1)", pv.data?.document_count === 1 && !("documents" in (pv.data || {})), pv.data?.document_count);
const cancel = await A.c.rpc("cancel_ownership_transfer", { p_transfer_id: t.data.transfer_id });
check("H3 iptal", !cancel.error, cancel.error?.message);
const acc3 = await B.c.rpc("accept_ownership_transfer", { p_token: t.data.token });
check("H3 CANCEL sonrası kabul edilemez, alıcı 0 belge", !!acc3.error && (await listDocs(B, { vehicle: V })).length === 0, acc3.error?.message);
check("H3 eski sahip aracı ve 2 belgeyi geri aldı", (await listDocs(A, { vehicle: V })).length === 2);

// H2 REJECT
t = await A.c.rpc("initiate_ownership_transfer", { p_vehicle_id: V, p_document_ids: [DA.id] });
const rej = await B.c.rpc("reject_ownership_transfer", { p_token: t.data.token });
check("H2 alıcı reddetti", !rej.error, rej.error?.message);
const acc2 = await B.c.rpc("accept_ownership_transfer", { p_token: t.data.token });
ep = await endpoint(B, [DA.id]);
check("H2 REJECT sonrası kabul yok, alıcı 0 belge, bağlantı 404", !!acc2.error && (await listDocs(B, { vehicle: V })).length === 0 && ep.status === 404);
check("H2 eski sahip aracı ve 2 belgeyi geri aldı", (await listDocs(A, { vehicle: V })).length === 2);

// H4 EXPIRE — süre dolumu, staging SQL ile önceden ayarlanan devir yerine burada
// kabul denemesi süresi geçmiş jetonla yapılır: SQL adımı ayrı (bkz. rapor).
t = await A.c.rpc("initiate_ownership_transfer", { p_vehicle_id: V, p_document_ids: [DA.id] });
console.log("EXPIRE_TRANSFER_ID", t.data.transfer_id);
globalThis.__expire = t.data;
const fs = await import("node:fs");
fs.writeFileSync("/tmp/claude-0/eh/expire.json", JSON.stringify(t.data));
fs.writeFileSync("/tmp/claude-0/eh/state.json", JSON.stringify({ DA, DB, DX }));
fs.writeFileSync("/tmp/claude-0/eh/results1.json", JSON.stringify(results));
console.log("PHASE1_DONE");
