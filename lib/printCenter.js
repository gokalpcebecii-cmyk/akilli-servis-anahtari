"use strict";

// OTOİZ Aşama B — Baskı Merkezi: parti dosyaları + tarayıcı tarafı doğrulama.
//
// Tüm dosyalar yöneticinin tarayıcısında üretilir; aktivasyon kodları
// sunucuya geri gönderilmez ve hiçbir yerde saklanmaz. Aynı fonksiyonlar
// Node testlerinde de çalışır (canvas gerekmez: QR matrisi doğrudan
// piksel tamponuna çizilip jsQR ile geri okunur).
//
// Dosyalar:
//   1. QR baskı PDF        (kod yok)        4. Paketleme CSV   (KOD VAR)
//   2. Paketleme kartı PDF (KOD VAR, QR yok) 5. Seri listesi TXT
//   3. Baskı CSV           (kod yok)        6. QR SVG ZIP      7. Gizli arşiv CSV (KOD VAR)
//
// Kural: basılan QR içeriği YALNIZ printableQrUrl() = <kalıcı taban>/<token>.
// Production tabanı https://go.otoizgo.com; başka bir tabanla (staging)
// üretilen dosyalar "TEST — BASMAYIN" filigranı taşır ve doğrulama
// "BASKIYA HAZIR DEĞİL" der.

const QRCode = require("qrcode");
const jsQRModule = require("jsqr");
const jsQR = typeof jsQRModule === "function" ? jsQRModule : jsQRModule.default;
const { zipSync, strToU8 } = require("fflate");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkitModule = require("@pdf-lib/fontkit");
// webpack istemci paketinde ESM varsayılan dışa aktarımı .default altında gelir.
const fontkit = fontkitModule.default || fontkitModule;
const { isQrToken } = require("./qrUrl");
const { formatActivationCode, isActivationCode } = require("./activationCode");
const { printCsv, packingCsv, masterCsv } = require("./productExport");

const PRODUCTION_QR_BASE = "https://go.otoizgo.com";
const QR_EC_LEVEL = "M";

// ---------------------------------------------------------------------------
// QR matrisi
// ---------------------------------------------------------------------------
function qrMatrix(text) {
  const q = QRCode.create(text, { errorCorrectionLevel: QR_EC_LEVEL });
  const size = q.modules.size;
  const data = q.modules.data;
  return { size, dark: (r, c) => data[r * size + c] === 1 };
}

// Matris → RGBA tampon (quiet zone 4 modül) → jsQR. Basılan PDF/SVG aynı
// matristen çizildiği için bu, basılacak görüntünün okunabilirliğini ölçer.
function decodeMatrix(m, scale = 4, quiet = 4) {
  const n = (m.size + quiet * 2) * scale;
  const px = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.dark(r, c)) continue;
      for (let y = 0; y < scale; y++) {
        const row = (r + quiet) * scale + y;
        for (let x = 0; x < scale; x++) {
          const i = (row * n + (c + quiet) * scale + x) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
      }
    }
  }
  const res = jsQR(px, n, n, { inversionAttempts: "dontInvert" });
  return res ? res.data : null;
}

// Aynı satırdaki bitişik koyu modülleri tek dikdörtgende birleştirir.
function darkRuns(m) {
  const runs = [];
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!m.dark(r, c)) { c++; continue; }
      const start = c;
      while (c < m.size && m.dark(r, c)) c++;
      runs.push({ r, c: start, w: c - start });
    }
  }
  return runs;
}

function qrSvg(url, serial) {
  const m = qrMatrix(url);
  const q = 4;
  const n = m.size + q * 2;
  const d = darkRuns(m).map((u) => `M${u.c + q} ${u.r + q}h${u.w}v1h-${u.w}z`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 8}" height="${n * 8}" shape-rendering="crispEdges">` +
    `<title>${serial}</title><rect width="${n}" height="${n}" fill="#ffffff"/><path fill="#000000" d="${d}"/></svg>\n`
  );
}

// ---------------------------------------------------------------------------
// Doğrulama (tarayıcı tarafı)
// ---------------------------------------------------------------------------
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const PLATE_RE = /\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/;

function isProductionBase(base) {
  return base === PRODUCTION_QR_BASE;
}

// items: [{ serial_no, token, activation_code? }]
function checkItems(items, qrUrlFor, base, expectedCount) {
  const problems = [];
  let urlOk = 0, forbidden = 0, decoded = 0, codeFormat = 0;
  const seenTokens = new Set(), seenSerials = new Set(), seenCodes = new Set();
  let dupTokens = 0, dupSerials = 0, dupCodes = 0;
  const withCodes = items.some((i) => i.activation_code);
  for (const it of items) {
    if (seenTokens.has(it.token)) dupTokens++; else seenTokens.add(it.token);
    if (seenSerials.has(it.serial_no)) dupSerials++; else seenSerials.add(it.serial_no);
    if (withCodes) {
      if (seenCodes.has(it.activation_code)) dupCodes++; else seenCodes.add(it.activation_code);
      if (isActivationCode(it.activation_code)) codeFormat++;
      else problems.push(`${it.serial_no}: aktivasyon kodu biçimi hatalı`);
    }
    const url = qrUrlFor(it.token);
    const exact = !!url && isQrToken(it.token) && url === `${base}/${it.token}`;
    if (exact) urlOk++; else problems.push(`${it.serial_no}: QR adresi beklenen biçimde değil`);
    const bad = !url || /vercel\.app|\/p\/|@/i.test(url) || UUID_RE.test(url) || PLATE_RE.test(url.toUpperCase()) ||
      (isProductionBase(base) && /staging/i.test(url));
    if (bad) { forbidden++; problems.push(`${it.serial_no}: QR adresinde yasak içerik`); }
    if (url) {
      const got = decodeMatrix(qrMatrix(url));
      if (got === url) decoded++; else problems.push(`${it.serial_no}: QR geri okunamadı`);
    }
  }
  const n = items.length;
  const production = isProductionBase(base);
  const checks = {
    count: { ok: n === expectedCount, expected: expectedCount, actual: n },
    url_format: { ok: urlOk === n, passed: urlOk, total: n },
    forbidden_content: { ok: forbidden === 0, count: forbidden },
    qr_decode: { ok: decoded === n, passed: decoded, total: n },
    duplicates: { ok: dupTokens + dupSerials + dupCodes === 0, count: dupTokens + dupSerials + dupCodes },
    environment: { ok: production, base },
  };
  if (withCodes) checks.code_format = { ok: codeFormat === n, passed: codeFormat, total: n };
  if (!production) problems.unshift("Test ortamı: QR adresi production (go.otoizgo.com) değil. Bu dosyalar basılamaz.");
  const ok = Object.values(checks).every((c) => c.ok);
  return { ok, checks, problems: problems.slice(0, 20) };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
const MM = 72 / 25.4;
const A4 = [210 * MM, 297 * MM];

async function newDoc(fonts, title) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setCreator("OTOİZ Baskı Merkezi");
  doc.setProducer("OTOİZ");
  const f = {
    regular: await doc.embedFont(fonts.regular, { subset: true }),
    bold: await doc.embedFont(fonts.bold, { subset: true }),
    mono: await doc.embedFont(fonts.mono, { subset: true }),
  };
  return { doc, f };
}

function watermark(page, f, text) {
  const [w, h] = [page.getWidth(), page.getHeight()];
  page.drawText(text, {
    x: w * 0.12, y: h * 0.3, size: 54, font: f.bold, color: rgb(0.85, 0.1, 0.1), opacity: 0.18,
    rotate: { type: "degrees", angle: 50 },
  });
}

function centerText(page, text, font, size, cx, y, color = rgb(0, 0, 0)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

// A4, 4×5 = 20 QR / sayfa. Her hücre 40 mm QR + altında seri no.
async function qrPrintPdf({ label, items, qrUrlFor, fonts, staging }) {
  const { doc, f } = await newDoc(fonts, `${label} — QR baskı`);
  const cols = 4, rows = 5, perPage = cols * rows;
  const cellW = 47 * MM, cellH = 54 * MM, qrSize = 38 * MM;
  const left = (A4[0] - cols * cellW) / 2, top = A4[1] - 12 * MM;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage(A4);
    page.drawText(`${staging ? "TEST — BASMAYIN · " : ""}${label} · Sayfa ${p + 1}/${pages}`, {
      x: left, y: A4[1] - 8 * MM, size: 7.5, font: f.regular, color: rgb(0.45, 0.45, 0.45),
    });
    items.slice(p * perPage, (p + 1) * perPage).forEach((it, i) => {
      const cx = left + (i % cols) * cellW + cellW / 2;
      const cy = top - Math.floor(i / cols) * cellH;
      const url = qrUrlFor(it.token);
      const m = qrMatrix(url);
      const mod = qrSize / m.size;
      const x0 = cx - qrSize / 2, y0 = cy - 4 * MM;
      // kesim çizgisi (ince, gri)
      page.drawRectangle({
        x: cx - cellW / 2 + 1.5 * MM, y: cy - cellH + 3 * MM, width: cellW - 3 * MM, height: cellH - 3 * MM,
        borderColor: rgb(0.8, 0.83, 0.86), borderWidth: 0.4, borderDashArray: [2, 2],
      });
      for (const u of darkRuns(m)) {
        page.drawRectangle({ x: x0 + u.c * mod, y: y0 - (u.r + 1) * mod, width: u.w * mod + 0.01, height: mod + 0.01, color: rgb(0, 0, 0) });
      }
      centerText(page, it.serial_no, f.mono, 10, cx, y0 - qrSize - 5 * MM);
      centerText(page, "OTOİZ", f.regular, 6.5, cx, y0 - qrSize - 8.5 * MM, rgb(0.4, 0.4, 0.4));
    });
    if (staging) watermark(page, f, "TEST — BASMAYIN");
  }
  return doc.save();
}

// A4, 2×5 = 10 kart / sayfa (85×54 mm kartvizit). QR YOK; seri + kod + adımlar.
async function packingCardsPdf({ label, items, fonts, staging, appOrigin }) {
  const { doc, f } = await newDoc(fonts, `${label} — Paketleme kartları (GİZLİ)`);
  const cols = 2, rows = 5, perPage = cols * rows;
  const cardW = 85 * MM, cardH = 54 * MM, gap = 3 * MM;
  const left = (A4[0] - cols * cardW - gap) / 2, top = A4[1] - 10 * MM;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const site = (appOrigin || "https://otoizgo.com").replace(/^https?:\/\//, "");
  const navy = rgb(0.047, 0.125, 0.196);
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage(A4);
    page.drawText(`${staging ? "TEST — BASMAYIN · " : ""}${label} · Paketleme kartları · GİZLİ · Sayfa ${p + 1}/${pages}`, {
      x: left, y: A4[1] - 7 * MM, size: 7.5, font: f.regular, color: rgb(0.45, 0.45, 0.45),
    });
    items.slice(p * perPage, (p + 1) * perPage).forEach((it, i) => {
      const x = left + (i % cols) * (cardW + gap);
      const yTop = top - Math.floor(i / cols) * (cardH + gap);
      const y = yTop - cardH;
      page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: rgb(0.75, 0.78, 0.82), borderWidth: 0.6 });
      page.drawRectangle({ x, y: yTop - 11 * MM, width: cardW, height: 11 * MM, color: navy });
      page.drawText("OTOİZ", { x: x + 5 * MM, y: yTop - 7.5 * MM, size: 13, font: f.bold, color: rgb(1, 1, 1) });
      const sw = f.mono.widthOfTextAtSize(it.serial_no, 9);
      page.drawText(it.serial_no, { x: x + cardW - 5 * MM - sw, y: yTop - 7.2 * MM, size: 9, font: f.mono, color: rgb(1, 1, 1) });
      page.drawText("Aktivasyon kodu", { x: x + 5 * MM, y: yTop - 17 * MM, size: 7.5, font: f.regular, color: rgb(0.35, 0.35, 0.35) });
      page.drawText(formatActivationCode(it.activation_code), { x: x + 5 * MM, y: yTop - 24.5 * MM, size: 17, font: f.mono, color: navy });
      const steps = [
        "1. Anahtarlıktaki QR kodu telefonla okutun.",
        "2. Giriş yapın ya da ücretsiz hesap açın.",
        "3. Bu kodu girin ve aracınızı seçin.",
        `QR okunmazsa: ${site}/aktivasyon`,
      ];
      steps.forEach((s, k) => page.drawText(s, { x: x + 5 * MM, y: yTop - (31 + k * 4.6) * MM, size: 7.2, font: k === 3 ? f.bold : f.regular, color: rgb(0.15, 0.15, 0.15) }));
      page.drawText("Kod tek kullanımlıktır. Kimseyle paylaşmayın.", { x: x + 5 * MM, y: y + 2.6 * MM, size: 6, font: f.regular, color: rgb(0.45, 0.45, 0.45) });
    });
    if (staging) watermark(page, f, "TEST — BASMAYIN");
  }
  return doc.save();
}

// ---------------------------------------------------------------------------
// Dosya seti
// ---------------------------------------------------------------------------
function fileSafe(s) {
  return String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "parti";
}

function serialList(items, label) {
  const first = items[0]?.serial_no ?? "", last = items[items.length - 1]?.serial_no ?? "";
  return `${label}\n${first} – ${last} (${items.length} adet)\n\n${items.map((i) => i.serial_no).join("\n")}\n`;
}

function svgZip(items, qrUrlFor) {
  const files = {};
  for (const it of items) files[`${it.serial_no}.svg`] = strToU8(qrSvg(qrUrlFor(it.token), it.serial_no));
  return zipSync(files, { level: 6 });
}

// kind: "print" (kod yok, her zaman indirilebilir) | "secret" (kod var)
async function buildFile(key, ctx) {
  const { label, items, qrUrlFor, fonts, staging, appOrigin } = ctx;
  const pre = `${staging ? "STAGING_" : ""}${fileSafe(label)}`;
  switch (key) {
    case "qr_pdf": return { name: `${pre}_1_QR_baski.pdf`, mime: "application/pdf", data: await qrPrintPdf({ label, items, qrUrlFor, fonts, staging }) };
    case "packing_pdf": return { name: `${pre}_2_paketleme_kartlari_GIZLI.pdf`, mime: "application/pdf", data: await packingCardsPdf({ label, items, fonts, staging, appOrigin }) };
    case "print_csv": return { name: `${pre}_3_baski_listesi.csv`, mime: "text/csv;charset=utf-8", data: strToU8(printCsv(items, qrUrlFor, label)) };
    case "packing_csv": return { name: `${pre}_4_paketleme_GIZLI.csv`, mime: "text/csv;charset=utf-8", data: strToU8(packingCsv(items, label)) };
    case "serial_txt": return { name: `${pre}_5_seri_listesi.txt`, mime: "text/plain;charset=utf-8", data: strToU8(serialList(items, label)) };
    case "svg_zip": return { name: `${pre}_6_QR_SVG.zip`, mime: "application/zip", data: svgZip(items, qrUrlFor) };
    case "secret_csv": return { name: `${pre}_7_yonetici_arsivi_GIZLI.csv`, mime: "text/csv;charset=utf-8", data: strToU8(masterCsv(items, qrUrlFor, label)) };
    default: throw new Error(`unknown file ${key}`);
  }
}

const PRINT_FILES = ["qr_pdf", "print_csv", "serial_txt", "svg_zip"];
const SECRET_FILES = ["packing_pdf", "packing_csv", "secret_csv"];

async function buildZip(keys, ctx) {
  const files = {};
  for (const k of keys) {
    const f = await buildFile(k, ctx);
    files[f.name] = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
  }
  return zipSync(files, { level: 6 });
}

// Tüm dosyaları üretip boyutlarını ölçer (dosya üretimi doğrulaması).
async function checkFiles(keys, ctx) {
  const out = {};
  let ok = true;
  for (const k of keys) {
    try {
      const f = await buildFile(k, ctx);
      const size = f.data.length ?? f.data.byteLength;
      out[k] = { ok: size > 0, size };
      if (!(size > 0)) ok = false;
    } catch (e) {
      out[k] = { ok: false, error: String(e && e.message || e) };
      ok = false;
    }
  }
  return { ok, files: out };
}

module.exports = {
  PRODUCTION_QR_BASE, PRINT_FILES, SECRET_FILES,
  qrMatrix, decodeMatrix, qrSvg, checkItems, isProductionBase,
  qrPrintPdf, packingCardsPdf, buildFile, buildZip, checkFiles, serialList, fileSafe,
};
