"use strict";
// OTOİZ Aşama B — Baskı Merkezi dosyaları ve tarayıcı doğrulaması.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { inflateSync, unzipSync, strFromU8 } = require("fflate");
const pc = require("../lib/printCenter");
const { generateQrCode } = require("../lib/qrToken");
const { generateActivationCode } = require("../lib/activationCodeGen");

const fonts = {
  regular: fs.readFileSync(path.join(__dirname, "../public/fonts/pdf/DejaVuSans.ttf")),
  bold: fs.readFileSync(path.join(__dirname, "../public/fonts/pdf/DejaVuSans-Bold.ttf")),
  mono: fs.readFileSync(path.join(__dirname, "../public/fonts/pdf/DejaVuSansMono-Bold.ttf")),
};
const PROD = "https://go.otoizgo.com";
const urlFor = (base) => (t) => (/^[abcdefghjkmnpqrstuvwxyz23456789]{26}$/.test(t) ? `${base}/${t}` : null);
function batch(n, start = 2) {
  return Array.from({ length: n }, (_, i) => ({
    serial_no: `OTZ-${String(start + i).padStart(6, "0")}`,
    token: generateQrCode(),
    activation_code: generateActivationCode(),
  }));
}

test("QR matrisi geri okunur (jsQR)", () => {
  const url = `${PROD}/${generateQrCode()}`;
  assert.strictEqual(pc.decodeMatrix(pc.qrMatrix(url)), url);
});

test("production: 100 ürün tüm kontroller PASS", () => {
  const items = batch(100);
  const r = pc.checkItems(items, urlFor(PROD), PROD, 100);
  assert.strictEqual(r.ok, true, JSON.stringify(r.problems));
  assert.strictEqual(r.checks.qr_decode.passed, 100);
  assert.strictEqual(r.checks.url_format.passed, 100);
});

test("staging tabanı: BASKIYA HAZIR DEĞİL (environment)", () => {
  const base = "https://go-staging.otoizgo.com";
  const r = pc.checkItems(batch(5), urlFor(base), base, 5);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.checks.environment.ok, false);
  assert.strictEqual(r.checks.url_format.ok, true);
  assert.strictEqual(r.checks.qr_decode.ok, true);
});

test("yanlış adres, eksik, duplicate yakalanır", () => {
  const items = batch(4);
  items[1].token = items[0].token; // duplicate
  const bad = (t) => `https://x.vercel.app/p/${t}`;
  const r = pc.checkItems(items, bad, PROD, 5);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.checks.count.ok, false);
  assert.strictEqual(r.checks.duplicates.count, 1);
  assert.strictEqual(r.checks.url_format.passed, 0);
  assert.strictEqual(r.checks.forbidden_content.count, 4);
});

test("bozuk aktivasyon kodu biçimi yakalanır", () => {
  const items = batch(3);
  items[2].activation_code = "abc";
  const r = pc.checkItems(items, urlFor(PROD), PROD, 3);
  assert.strictEqual(r.checks.code_format.ok, false);
});

test("7 dosya üretilir; baskı dosyalarında kod yok, paketlemede token yok", async () => {
  const items = batch(23);
  const ctx = { label: "OTOİZ Şubat Partisi", items, qrUrlFor: urlFor(PROD), fonts, staging: false, appOrigin: "https://otoizgo.com" };
  const all = [...pc.PRINT_FILES, ...pc.SECRET_FILES];
  const res = await pc.checkFiles(all, ctx);
  assert.strictEqual(res.ok, true, JSON.stringify(res.files));
  const code = items[0].activation_code, token = items[0].token;
  for (const k of pc.PRINT_FILES) {
    const f = await pc.buildFile(k, ctx);
    const text = k === "svg_zip" ? Object.values(unzipSync(f.data)).map(strFromU8).join("") : Buffer.from(f.data).toString("latin1");
    assert.ok(!text.includes(code), `${k} kod içermemeli`);
    assert.ok(!/staging|vercel\.app|\/p\//i.test(text), `${k} yasak içerik`);
  }
  const pcsv = strFromU8((await pc.buildFile("packing_csv", ctx)).data);
  assert.ok(!pcsv.includes(token));
  const zip = unzipSync((await pc.buildFile("svg_zip", ctx)).data);
  assert.strictEqual(Object.keys(zip).length, 23);
  assert.ok(strFromU8(zip["OTZ-000002.svg"]).startsWith("<?xml"));
  const pdf = (await pc.buildFile("qr_pdf", ctx)).data;
  assert.strictEqual(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  const txt = strFromU8((await pc.buildFile("serial_txt", ctx)).data);
  assert.ok(txt.includes("OTZ-000002 – OTZ-000024 (23 adet)"));
});

test("staging dosya adları STAGING_ önekli", async () => {
  const f = await pc.buildFile("qr_pdf", { label: "x", items: batch(2), qrUrlFor: urlFor("https://go-staging.otoizgo.com"), fonts, staging: true });
  assert.ok(f.name.startsWith("STAGING_"));
});

test("200 ürün: PDF + ZIP makul sürede", async () => {
  const items = batch(200);
  const t0 = Date.now();
  const ctx = { label: "200", items, qrUrlFor: urlFor(PROD), fonts, staging: false };
  const z = await pc.buildZip([...pc.PRINT_FILES, ...pc.SECRET_FILES], ctx);
  assert.ok(z.length > 1000);
  const r = pc.checkItems(items, urlFor(PROD), PROD, 200);
  assert.strictEqual(r.ok, true);
  assert.ok(Date.now() - t0 < 30000);
});
