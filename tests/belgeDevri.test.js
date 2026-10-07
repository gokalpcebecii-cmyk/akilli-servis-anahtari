"use strict";
// OTOİZ — E–H seçimli belge devri.
// 1) Saf mantık: varsayılan seçim 0, kimlik doğrulama, imzalı bağlantı akışı.
// 2) Gerçek PostgreSQL (16) üzerinde: tüm migration'lar + Supabase iskeleti
//    kurulur; supabase/tests/belge_devri_eh.sql (E1, E2, SECURITY, F1, G1,
//    H1–H4, OWNER, HISTORY) çalıştırılır; ardından imzalı bağlantı uç
//    noktasının akışı (signVisibleDocuments) gerçek RLS okumasıyla (F2/G2,
//    PENDING) sınanır. PostgreSQL ikilileri yoksa DB testleri açıkça SKIP olur.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  TRANSFER_DOCS_TITLE,
  TRANSFER_DOCS_HINT,
  TRANSFER_DOCS_EMPTY,
  initialDocumentSelection,
  toggleDocumentSelection,
  selectedDocumentIds,
  parseDocumentIds,
  transferErrorMessage,
  presentDocument,
  signVisibleDocuments,
} = require("../lib/documentTransfer");

const ROOT = path.join(__dirname, "..");
const DA = "0e0e0e0e-0000-4000-8000-0000000000d1";
const DB = "0e0e0e0e-0000-4000-8000-0000000000d2";
const V = "0e0e0e0e-0000-4000-8000-0000000000e1";

// ---------------------------------------------------------------------------
// Saf mantık
// ---------------------------------------------------------------------------
test("E1-UI: varsayılan seçim 0; metinler brifteki gibi", () => {
  assert.deepEqual(initialDocumentSelection(), []);
  assert.equal(TRANSFER_DOCS_TITLE, "Yeni sahibine aktarmak istediğiniz belgeler");
  assert.equal(TRANSFER_DOCS_HINT, "Belgeleriniz otomatik olarak aktarılmaz. Yalnızca seçtikleriniz yeni araç sahibine devredilir.");
  assert.equal(TRANSFER_DOCS_EMPTY, "Bu araç için aktarılabilir belge bulunmuyor.");
  const page = fs.readFileSync(path.join(ROOT, "app/bireysel/araclar/[id]/devret/page.tsx"), "utf8");
  assert.match(page, /useState<string\[\]>\(initialDocumentSelection\(\)\)/);
  assert.match(page, /\/api\/belgeler\?vehicle_id=/, "devir ekranı gerçek belge API'sini kullanır (mock yok)");
  assert.match(page, /p_document_ids: selectedDocumentIds\(selected, docs\)/);
});

test("E2-UI: seçim aç/kapa ve yalnız listelenen belgeler gönderilir", () => {
  let s = initialDocumentSelection();
  s = toggleDocumentSelection(s, DA);
  assert.deepEqual(s, [DA]);
  s = toggleDocumentSelection(s, DB);
  s = toggleDocumentSelection(s, DB);
  assert.deepEqual(s, [DA]);
  assert.deepEqual(selectedDocumentIds([DA, "yabanci"], [{ id: DA }, { id: DB }]), [DA]);
  assert.deepEqual(selectedDocumentIds([], [{ id: DA }]), []);
});

test("SECURITY-API: belge kimliği girdisi sıkı doğrulanır", () => {
  assert.deepEqual(parseDocumentIds(undefined), []);
  assert.deepEqual(parseDocumentIds([DA, DA.toUpperCase()]), [DA]);
  assert.equal(parseDocumentIds("x"), null);
  assert.equal(parseDocumentIds([DA, "../etc/passwd"]), null);
  assert.equal(parseDocumentIds([DA, null]), null);
  assert.equal(parseDocumentIds(new Array(51).fill(DA), 50), null);
  assert.match(transferErrorMessage({ message: "invalid_document" }), /erişiminiz yok/);
  assert.equal(transferErrorMessage({ message: "x" }), "Devir başlatılamadı. Lütfen tekrar deneyin.");
});

test("API: yükleyen kimliği dışarı verilmez; dosya yolu yalnız kendi belgende", () => {
  const row = { id: DA, vehicle_id: V, uploaded_by: "u-eski", storage_path: `${V}/a.pdf`, doc_type: "fatura" };
  const forNew = presentDocument(row, "u-yeni");
  assert.equal(forNew.own, false);
  assert.equal("uploaded_by" in forNew, false);
  assert.equal("storage_path" in forNew, false);
  const forOwn = presentDocument(row, "u-eski");
  assert.equal(forOwn.own, true);
  assert.equal(forOwn.storage_path, `${V}/a.pdf`);
});

test("İmzalı bağlantı: görünmeyen belge için imza istenmez, 404 döner", async () => {
  const signed = [];
  const sign = async (paths) => { signed.push(...paths); return paths.map((p) => ({ path: p, signedUrl: `https://x/${p}?t=1` })); };
  const r404 = await signVisibleDocuments({ ids: [DB], readVisible: async () => [], sign });
  assert.equal(r404.status, 404);
  assert.deepEqual(signed, []);
  // Yol vehicle_id klasöründe değilse imzalanmaz.
  const bad = await signVisibleDocuments({ ids: [DA], readVisible: async () => [{ id: DA, vehicle_id: V, storage_path: "baska/a.pdf" }], sign });
  assert.equal(bad.status, 404);
  assert.deepEqual(signed, []);
  // İstenmeyen satır dönse bile imzalanmaz.
  const ok = await signVisibleDocuments({
    ids: [DA],
    readVisible: async () => [{ id: DA, vehicle_id: V, storage_path: `${V}/a.pdf` }, { id: DB, vehicle_id: V, storage_path: `${V}/b.pdf` }],
    sign,
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(ok.body.urls), [DA]);
  assert.deepEqual(signed, [`${V}/a.pdf`]);
  assert.equal(ok.body.expires_in, 900);
  const empty = await signVisibleDocuments({ ids: [], readVisible: async () => [], sign });
  assert.equal(empty.status, 400);
});

test("Uç noktalar: servis rolü yalnız RLS okumasından SONRA, yol istemciden alınmaz", () => {
  const route = fs.readFileSync(path.join(ROOT, "app/api/belgeler/baglanti/route.ts"), "utf8");
  assert.match(route, /auth\.client\.from\("vehicle_documents"\)/);
  assert.doesNotMatch(route, /body\.(storage_path|path)/);
  const list = fs.readFileSync(path.join(ROOT, "app/api/belgeler/route.ts"), "utf8");
  assert.doesNotMatch(list, /createServerSupabase|SERVICE_ROLE/);
  const hub = fs.readFileSync(path.join(ROOT, "components/QuickActionHub.tsx"), "utf8");
  assert.doesNotMatch(hub, /createSignedUrls/);
  assert.match(hub, /\/api\/belgeler\/baglanti/);
});

test("Migration: kova public yapılmaz, storage politikaları genişletilmez", () => {
  const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261007120000_vehicle_docs_expedition.sql"), "utf8");
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /storage\.objects/);
  assert.doesNotMatch(code, /storage\.buckets/);
  assert.doesNotMatch(code, /public\s*=\s*true/);
  assert.match(code, /primary key \(transfer_id, document_id\)/);
  assert.match(code, /revoke all on table public\.ownership_transfer_documents from public, anon, authenticated/);
  assert.ok(fs.existsSync(path.join(ROOT, "supabase/migrations/20261004120000_legal_acceptance.sql")), "legal_acceptance migration korunur");
});

// ---------------------------------------------------------------------------
// Gerçek PostgreSQL
// ---------------------------------------------------------------------------
function findPgBin() {
  const base = "/usr/lib/postgresql";
  if (!fs.existsSync(base)) return null;
  for (const v of fs.readdirSync(base).sort().reverse()) {
    const bin = path.join(base, v, "bin");
    if (fs.existsSync(path.join(bin, "initdb")) && fs.existsSync(path.join(bin, "psql"))) return bin;
  }
  return null;
}

const PG_BIN = findPgBin();
const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

function startCluster() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "otoiz-eh-"));
  fs.chmodSync(dir, 0o777);
  const port = String(56000 + Math.floor(Math.random() * 3000));
  const asPg = (cmd, args) => {
    if (isRoot) return execFileSync("runuser", ["-u", "postgres", "--", cmd, ...args], { stdio: "pipe" });
    return execFileSync(cmd, args, { stdio: "pipe" });
  };
  asPg(path.join(PG_BIN, "initdb"), ["-D", path.join(dir, "data"), "-A", "trust", "-U", "postgres", "-E", "UTF8"]);
  asPg(path.join(PG_BIN, "pg_ctl"), ["-D", path.join(dir, "data"), "-o", `-p ${port} -k ${dir} -c listen_addresses=`, "-l", path.join(dir, "log"), "-w", "start"]);
  const stop = () => {
    try { asPg(path.join(PG_BIN, "pg_ctl"), ["-D", path.join(dir, "data"), "-m", "immediate", "stop"]); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  };
  const psql = (args, input) =>
    spawnSync(path.join(PG_BIN, "psql"), ["-h", dir, "-p", port, "-U", "postgres", "-d", "postgres", "-X", "-q", ...args], { input, encoding: "utf8" });
  return { psql, stop };
}

test("DB: E–H kabul senaryoları gerçek PostgreSQL üzerinde", { skip: PG_BIN ? false : "PostgreSQL ikilileri bulunamadı (DB testleri SKIP — PASS sayılmaz)" }, async (t) => {
  const pg = startCluster();
  t.after(pg.stop);
  const run = (file) => {
    const r = pg.psql(["-v", "ON_ERROR_STOP=1", "-f", file]);
    assert.equal(r.status, 0, `${path.basename(file)}: ${r.stderr}`);
  };
  run(path.join(__dirname, "db/supabase_bootstrap.sql"));
  const migDir = path.join(ROOT, "supabase/migrations");
  for (const f of fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) run(path.join(migDir, f));
  // İkinci uygulama da hatasız olmalı (idempotent).
  run(path.join(migDir, "20261007120000_vehicle_docs_expedition.sql"));

  const r = pg.psql(["-f", path.join(ROOT, "supabase/tests/belge_devri_eh.sql")]);
  const m = /OTOIZ_TEST_RESULTS (\[.*\])/s.exec(r.stderr);
  assert.ok(m, `sonuç bulunamadı: ${r.stderr}`);
  const results = JSON.parse(m[1].split("\nCONTEXT")[0]);
  const ids = results.map((x) => x.id);
  for (const need of ["E1", "E2", "SEC-1", "F1", "G1", "H1", "H2", "H3", "H4", "OWNER", "HISTORY"]) assert.ok(ids.includes(need), need);
  for (const res of results) {
    await t.test(`${res.id}: ${res.desc}`, () => {
      assert.equal(res.ok, true, JSON.stringify(res));
    });
  }

  // İmzalı bağlantı akışı (F2 / G2 / PENDING) — gerçek RLS okuması, sahte imzalayıcı.
  const sh = (sql) => {
    const out = pg.psql(["-v", "ON_ERROR_STOP=1", "-tA"], sql);
    assert.equal(out.status, 0, out.stderr);
    return out.stdout.trim();
  };
  const A = "0e0e0e0e-0000-4000-8000-0000000000a1";
  const B = "0e0e0e0e-0000-4000-8000-0000000000b1";
  const asUser = (uid, sql) =>
    sh(`begin; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true) \\g /dev/null
set local role authenticated;
${sql};
commit;`);
  sh(`insert into auth.users (id, email, email_confirmed_at) values ('${A}', 'a@example.test', now()), ('${B}', 'b@example.test', now());
insert into public.vehicles (id, plate, current_km, owner_user_id) values ('${V}', '99 EH 001', 1000, '${A}');
insert into public.vehicle_documents (id, vehicle_id, uploaded_by, doc_type, storage_path, file_name, mime_type, size_bytes) values
 ('${DA}', '${V}', '${A}', 'servis_fisi', '${V}/a.pdf', 'a.pdf', 'application/pdf', 10),
 ('${DB}', '${V}', '${A}', 'fatura', '${V}/b.pdf', 'b.pdf', 'application/pdf', 10);`);
  const readAs = (uid) => async (list) => {
    const out = asUser(uid, `select coalesce(json_agg(json_build_object('id', id, 'vehicle_id', vehicle_id, 'storage_path', storage_path)), '[]') from public.vehicle_documents where id in (${list.map((x) => `'${x}'`).join(",")})`);
    return JSON.parse(out.split("\n").filter(Boolean).pop());
  };
  const signedPaths = [];
  const sign = async (paths) => { signedPaths.push(...paths); return paths.map((p) => ({ path: p, signedUrl: `https://imzali/${p}` })); };
  const tokenLine = asUser(A, `select public.initiate_ownership_transfer('${V}'::uuid, array['${DA}'::uuid])->>'token'`);
  const token = tokenLine.split("\n").filter(Boolean).pop();

  await t.test("H1-URL: PENDING — alıcı A için imzalı bağlantı alamaz (404)", async () => {
    const r1 = await signVisibleDocuments({ ids: [DA], readVisible: readAs(B), sign });
    assert.equal(r1.status, 404);
    assert.deepEqual(signedPaths, []);
  });
  await t.test("H1-URL-OWNER: PENDING — eski sahip kendi belgesine imzalı bağlantı almaya devam eder", async () => {
    const r1 = await signVisibleDocuments({ ids: [DB], readVisible: readAs(A), sign });
    assert.equal(r1.status, 200);
    signedPaths.length = 0;
  });
  asUser(B, `select public.accept_ownership_transfer('${token}')`);
  await t.test("F2: ACCEPT sonrası yeni sahip A için imzalı bağlantı alır", async () => {
    const r1 = await signVisibleDocuments({ ids: [DA], readVisible: readAs(B), sign });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.urls[DA], `https://imzali/${V}/a.pdf`);
  });
  await t.test("G2: ACCEPT sonrası yeni sahip B için imzalı bağlantı ALAMAZ (404, imza istenmez)", async () => {
    signedPaths.length = 0;
    const r1 = await signVisibleDocuments({ ids: [DB], readVisible: readAs(B), sign });
    assert.equal(r1.status, 404);
    assert.deepEqual(signedPaths, []);
    const r2 = await signVisibleDocuments({ ids: [DA, DB], readVisible: readAs(B), sign });
    assert.deepEqual(Object.keys(r2.body.urls), [DA]);
    assert.deepEqual(signedPaths, [`${V}/a.pdf`]);
  });
  await t.test("OWNER-URL: ACCEPT sonrası eski sahip hiçbir belge için bağlantı alamaz", async () => {
    signedPaths.length = 0;
    const r1 = await signVisibleDocuments({ ids: [DA, DB], readVisible: readAs(A), sign });
    assert.equal(r1.status, 404);
    assert.deepEqual(signedPaths, []);
  });
});
