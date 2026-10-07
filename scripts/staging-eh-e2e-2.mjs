// OTOİZ E–H — staging uçtan uca test, 2. aşama (EXPIRE sonrası → E2 → ACCEPT → F/G/OWNER/HISTORY).
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { signVisibleDocuments } = require("../lib/documentTransfer.js");
const URL_ = process.env.SUPABASE_URL, ANON = process.env.ANON, PW = process.env.PW;
if (!URL_.includes("ctltjunojlaanzurxpzy")) throw new Error("yalnız staging");
const V = "0e0e0e0e-1111-4000-8000-0000000000e1";
const { DA, DB } = JSON.parse(fs.readFileSync("/tmp/claude-0/eh/state.json", "utf8"));
const expired = JSON.parse(fs.readFileSync("/tmp/claude-0/eh/expire.json", "utf8"));
const results = JSON.parse(fs.readFileSync("/tmp/claude-0/eh/results1.json", "utf8"));
const check = (id, ok, got) => { results.push({ id, ok: !!ok, got }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${got !== undefined ? " " + JSON.stringify(got) : ""}`); };
async function login(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(error.message);
  return { c, uid: data.user.id };
}
const A = await login("eh-e2e-eski@example.test");
const B = await login("eh-e2e-alici@example.test");
const C = await login("eh-e2e-ucuncu@example.test");
const listDocs = async (who, f = {}) => { let q = who.c.from("vehicle_documents").select("id"); if (f.vehicle) q = q.eq("vehicle_id", f.vehicle); if (f.id) q = q.eq("id", f.id); const { data, error } = await q; if (error) throw error; return data; };
const endpoint = async (who, ids) => {
  const asked = [];
  const r = await signVisibleDocuments({ ids,
    readVisible: async (list) => { const { data, error } = await who.c.from("vehicle_documents").select("id, vehicle_id, storage_path").in("id", list); if (error) throw error; return data; },
    sign: async (paths) => { asked.push(...paths); return paths.map((p) => ({ path: p, signedUrl: "x://" + p })); } });
  return { status: r.status, asked, urls: r.body.urls };
};
const directSign = async (who, path) => { const { data, error } = await who.c.storage.from("vehicle-documents").createSignedUrl(path, 60); return error ? null : data?.signedUrl; };

// H4 EXPIRE
const acc4 = await B.c.rpc("accept_ownership_transfer", { p_token: expired.token });
const ep4 = await endpoint(B, [DA.id]);
check("H4 EXPIRE kabul edilemez, alıcı 0 belge, bağlantı 404", /expired/.test(acc4.error?.message || "") && (await listDocs(B, { vehicle: V })).length === 0 && ep4.status === 404, acc4.error?.message);
check("H4 eski sahip süresi dolan devirde belgeleri görmeye devam eder (2)", (await listDocs(A, { vehicle: V })).length === 2);
const c4 = await A.c.rpc("cancel_ownership_transfer", { p_transfer_id: expired.transfer_id });
check("H4 eski sahip iptalle aracı geri alır", !c4.error, c4.error?.message);

// E2 + ACCEPT
const t = await A.c.rpc("initiate_ownership_transfer", { p_vehicle_id: V, p_document_ids: [DA.id] });
check("E2 yalnız A seçili devir", !t.error && t.data.document_count === 1);
fs.writeFileSync("/tmp/claude-0/eh/accept_transfer.json", JSON.stringify({ transfer_id: t.data.transfer_id }));
const acc = await B.c.rpc("accept_ownership_transfer", { p_token: t.data.token });
check("ACCEPT", !acc.error && acc.data.ok, acc.error?.message);

check("F1 yeni sahip A metadata okur", (await listDocs(B, { id: DA.id })).length === 1);
check("G1 yeni sahip B metadata okuyamaz", (await listDocs(B, { id: DB.id })).length === 0);
check("F1 yeni sahibin listesinde yalnız A", (await listDocs(B, { vehicle: V })).length === 1);
const epA = await endpoint(B, [DA.id]);
check("F2 uç nokta akışı A için imza üretir (RLS okuması gerçek)", epA.status === 200 && epA.asked.length === 1 && epA.asked[0] === DA.path, epA.status);
const epB = await endpoint(B, [DB.id]);
check("G2 uç nokta akışı B için 404, imza istenmez", epB.status === 404 && epB.asked.length === 0, epB.status);
check("PATH yeni sahip A'nın dosya yolunu bilse de depolamadan doğrudan imza alamaz", (await directSign(B, DA.path)) === null);
check("PATH yeni sahip B'nin dosya yolunu bilse de depolamadan doğrudan imza alamaz", (await directSign(B, DB.path)) === null);
const del = await B.c.from("vehicle_documents").delete().eq("id", DA.id).select("id");
check("Yeni sahip devralınan belgeyi silemez", (del.data ?? []).length === 0 && (await listDocs(B, { id: DA.id })).length === 1);

const va = await A.c.from("vehicles").select("id").eq("id", V);
check("OWNER eski sahip araca erişemez", (va.data ?? []).length === 0);
const ma = await A.c.from("maintenance_records").select("id").eq("vehicle_id", V);
const ea = await endpoint(A, [DA.id, DB.id]);
check("OWNER eski sahip belge/bakım/bağlantı alamaz", (await listDocs(A, { vehicle: V })).length === 0 && (ma.data ?? []).length === 0 && ea.status === 404);
const mb = await B.c.from("maintenance_records").select("id").eq("vehicle_id", V);
check("HISTORY yeni sahip bakım geçmişini görür (2)", (mb.data ?? []).length === 2, (mb.data ?? []).length);
const tl = await B.c.rpc("vehicle_timeline", { p_vehicle_id: V });
check("HISTORY yeni sahip zaman çizelgesi açılır", !tl.error, tl.error?.message);
check("THIRD üçüncü kişi araç belgelerini göremez", (await listDocs(C, { vehicle: V })).length === 0);

fs.writeFileSync("/tmp/claude-0/eh/results.json", JSON.stringify(results, null, 1));
const fail = results.filter((r) => !r.ok);
console.log(`TOPLAM ${results.length} PASS ${results.length - fail.length} FAIL ${fail.length}`);
