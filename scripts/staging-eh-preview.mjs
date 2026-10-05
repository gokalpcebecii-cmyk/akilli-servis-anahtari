// OTOİZ E–H — PR staging ÖNİZLEMESİ üzerinde üç kapı: gerçek env build (deploy hazır),
// sunucu tarafı imzalı bağlantı (/api/belgeler/baglanti, servis rolüyle), devir ekranı UI.
// Yalnız staging. Kullanım:
//   PREVIEW=https://...vercel.app SUPABASE_URL=... ANON=... PW=... VERCEL_AUTOMATION_BYPASS_SECRET=... \
//   node scripts/staging-eh-preview.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";

const P = process.env.PREVIEW.replace(/\/$/, "");
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.ANON;
const PW = process.env.PW;
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const OUT = process.env.OUT || "/tmp/claude-0/eh/preview_results.json";
if (!URL_.includes("ctltjunojlaanzurxpzy")) throw new Error("yalnız staging");
if (!/akilli-servis-anahtari-staging-/.test(P)) throw new Error("yalnız staging önizlemesi");
const V = "0e0e0e0e-1111-4000-8000-0000000000e1";
const results = [];
const check = (id, ok, got) => { results.push({ id, ok: !!ok, got }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${got !== undefined ? " " + JSON.stringify(got) : ""}`); };

async function login(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { c, uid: data.user.id, jwt: data.session.access_token, email };
}
const H = { "x-vercel-protection-bypass": BYPASS };
const api = async (who, path, body) => {
  const headers = { ...H, ...(who ? { Authorization: `Bearer ${who.jwt}` } : {}) };
  const init = body ? { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) } : { headers };
  const r = await fetch(P + path, init);
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const sign = (who, id) => api(who, "/api/belgeler/baglanti", { document_id: id });
const pdf = (t) => new Blob([`%PDF-1.4\n% OTOIZ PREVIEW ${t}\n%%EOF\n`], { type: "application/pdf" });

const A = await login("eh-e2e-eski@example.test");
const B = await login("eh-e2e-alici@example.test");
const C = await login("eh-e2e-ucuncu@example.test");
check("AUTH üç test hesabı gerçek staging Auth ile giriş yaptı", A.uid && B.uid && C.uid);

async function upload(who, type, name) {
  const path = `${V}/${crypto.randomUUID()}.pdf`;
  const up = await who.c.storage.from("vehicle-documents").upload(path, pdf(name), { contentType: "application/pdf" });
  if (up.error) throw new Error("upload " + up.error.message);
  const ins = await who.c.from("vehicle_documents").insert({ vehicle_id: V, uploaded_by: who.uid, doc_type: type, storage_path: path, file_name: name, mime_type: "application/pdf", size_bytes: 40 }).select("id").single();
  if (ins.error) throw new Error("insert " + ins.error.message);
  return { id: ins.data.id, path, name };
}
const DA = await upload(A, "servis_fisi", "onizleme-servis-fisi.pdf");
const DB = await upload(A, "fatura", "onizleme-kisisel-fatura.pdf");
fs.writeFileSync("/tmp/claude-0/eh/preview_state.json", JSON.stringify({ DA, DB }));

// --- KAPI 2 (devir öncesi): sunucu imzası, gerçek sahip
let s = await sign(null, DA.id);
check("SIGN oturumsuz istek 401", s.status === 401, s.status);
s = await sign(A, DA.id);
const urlA = s.json?.urls?.[DA.id];
check("SIGN sahip kendi belgesi için önizleme uç noktasından 200 + imzalı URL", s.status === 200 && !!urlA && s.json.expires_in === 900, s.status);
check("SIGN URL Supabase Storage imzalı URL'si (servis rolüyle sunucuda üretildi)", !!urlA && urlA.startsWith(URL_ + "/storage/v1/object/sign/vehicle-documents/") && urlA.includes("token="));
if (urlA) { const d = await fetch(urlA); const t = await d.text(); check("SIGN imzalı URL ile dosya indirildi (200, doğru içerik)", d.status === 200 && t.includes("onizleme-servis-fisi.pdf"), d.status); }
s = await sign(C, DA.id);
check("SIGN üçüncü kişi 404", s.status === 404, s.status);
s = await api(A, "/api/belgeler/baglanti", { path: DA.path });
check("SIGN istemciden yol kabul edilmez (400)", s.status === 400, s.status);

// --- KAPI 3: devir ekranı UI (gerçek önizleme, gerçek tarayıcı)
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ extraHTTPHeaders: H, viewport: { width: 390, height: 844 } });
await ctx.route("**/*", async (r) => { try { await r.fulfill({ response: await r.fetch() }); } catch { await r.continue().catch(() => {}); } });
const page = await ctx.newPage();
await page.goto(P + "/", { waitUntil: "domcontentloaded" });
await page.goto(`${P}/bireysel/giris?next=${encodeURIComponent(`/bireysel/araclar/${V}/devret`)}`, { waitUntil: "domcontentloaded" });
await page.locator('input[inputmode="email"]').fill(A.email);
await page.locator('input[type="password"]').fill(PW);
await page.locator('button[type="submit"]').click();
await page.waitForURL(new RegExp(`/bireysel/araclar/${V}/devret`), { timeout: 30000 });
const section = page.getByTestId("devir-belgeler");
await section.waitFor({ timeout: 30000 });
await page.getByTestId("devir-belge-satir").first().waitFor({ timeout: 30000 });
const secText = await section.innerText();
check("UI başlık 'Yeni sahibine aktarmak istediğiniz belgeler'", secText.includes("Yeni sahibine aktarmak istediğiniz belgeler"));
check("UI açıklama 'Belgeleriniz otomatik olarak aktarılmaz…'", secText.includes("Belgeleriniz otomatik olarak aktarılmaz. Yalnızca seçtikleriniz yeni araç sahibine devredilir."));
const rows = await page.getByTestId("devir-belge-satir").allInnerTexts();
check("UI gerçek backend listesi: aracın 2 gerçek belgesi", rows.length === 2 && rows.some((t) => t.includes(DA.name)) && rows.some((t) => t.includes(DB.name)), rows.length);
const boxes = page.getByTestId("devir-belge-secim");
const checkedBefore = await boxes.evaluateAll((els) => els.filter((e) => e.checked).length);
check("UI varsayılan seçim 0", checkedBefore === 0, checkedBefore);
check("UI sayaç '0 belge seçildi'", (await page.getByTestId("devir-belge-sayac").innerText()).includes("0 belge seçildi"));
await page.getByTestId("devir-belge-satir").filter({ hasText: DA.name }).getByTestId("devir-belge-secim").check();
check("UI sayaç '1 belge seçildi'", (await page.getByTestId("devir-belge-sayac").innerText()).includes("1 belge seçildi"));
await page.screenshot({ path: "/tmp/claude-0/eh/onizleme_devir_ekrani.png", fullPage: true });

let rpcBody = null, rpcResp = null;
page.on("request", (r) => { if (r.url().includes("/rest/v1/rpc/initiate_ownership_transfer")) rpcBody = r.postDataJSON(); });
page.on("response", async (r) => { if (r.url().includes("/rest/v1/rpc/initiate_ownership_transfer")) { try { rpcResp = await r.json(); } catch {} } });
await page.locator('input[type="checkbox"]:not([data-testid])').check();
await page.getByRole("button", { name: "Devir İşlemini Başlat" }).click();
await page.waitForFunction(() => location.pathname && document.body.innerText.includes("/bireysel/devir-kabul/"), null, { timeout: 30000 });
check("UI RPC'ye yalnız seçilen belge kimliği gönderildi", rpcBody && Array.isArray(rpcBody.p_document_ids) && rpcBody.p_document_ids.length === 1 && rpcBody.p_document_ids[0] === DA.id && rpcBody.p_vehicle_id === V, rpcBody);
check("UI devir oluştu, sunucu 1 belge kaydetti", rpcResp && rpcResp.document_count === 1, rpcResp?.document_count);
await page.screenshot({ path: "/tmp/claude-0/eh/onizleme_devir_sonuc.png", fullPage: true });
await browser.close();

// --- KABUL (alıcı) ve KAPI 2 (devir sonrası)
const acc = await B.c.rpc("accept_ownership_transfer", { p_token: rpcResp.token });
check("ACCEPT alıcı devri kabul etti", !acc.error && acc.data?.ok, acc.error?.message);
const lb = await api(B, `/api/belgeler?vehicle_id=${V}`);
check("API yeni sahip listesinde yalnız seçilen belge (1), storage_path yok", lb.status === 200 && lb.json?.documents?.length === 1 && lb.json.documents[0].id === DA.id && !lb.json.documents[0].storage_path, lb.json?.documents?.length);
s = await sign(B, DA.id);
const urlB = s.json?.urls?.[DA.id];
check("SIGN yeni sahip seçilen belge için 200 + imzalı URL", s.status === 200 && !!urlB, s.status);
if (urlB) { const d = await fetch(urlB); const t = await d.text(); check("SIGN yeni sahip imzalı URL ile dosyayı indirdi (200)", d.status === 200 && t.includes("onizleme-servis-fisi.pdf"), d.status); }
s = await sign(B, DB.id);
check("SIGN yeni sahip seçilmeyen belge için 404", s.status === 404 && !s.json?.urls, s.status);
s = await api(B, "/api/belgeler/baglanti", { document_ids: [DA.id, DB.id] });
check("SIGN toplu istekte seçilmeyen belgeye URL verilmez", s.status === 200 && !!s.json?.urls?.[DA.id] && !s.json?.urls?.[DB.id], s.status);
s = await sign(A, DA.id);
check("SIGN eski sahip devirden sonra 404", s.status === 404, s.status);
s = await sign(C, DA.id);
check("SIGN üçüncü kişi 404", s.status === 404, s.status);
const g = await api(B, `/api/belgeler?id=${DB.id}`);
check("API yeni sahip seçilmeyen belgenin metadata'sı 404", g.status === 404, g.status);

// --- Geri alma: B aracı belgesiz A'ya geri devreder, A dosyaları siler
const back = await B.c.rpc("initiate_ownership_transfer", { p_vehicle_id: V, p_document_ids: [] });
const backAcc = back.error ? back : await A.c.rpc("accept_ownership_transfer", { p_token: back.data.token });
let cleaned = !back.error && !backAcc.error;
for (const d of [DA, DB]) {
  const r = await A.c.storage.from("vehicle-documents").remove([d.path]);
  const del = await A.c.from("vehicle_documents").delete().eq("id", d.id).select("id");
  cleaned = cleaned && !r.error && (r.data || []).length === 1 && (del.data || []).length === 1;
}
console.log("TEMIZLIK", cleaned ? "tamam" : "eksik", back.error?.message || backAcc.error?.message || "");

fs.writeFileSync(OUT, JSON.stringify({ preview: P, at: new Date().toISOString(), results }, null, 1));
const fail = results.filter((r) => !r.ok);
console.log(`TOPLAM ${results.length} PASS ${results.length - fail.length} FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
