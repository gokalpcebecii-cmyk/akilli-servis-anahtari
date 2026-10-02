"use strict";

// OTOİZ — Alıcı Raporu PDF'i (istemci tarafında üretilir).
// Allowlist'ten gelen buyer-safe veriyle üretilir; private alan YOK.
// Kullanıcı notları render edilmez (rapor allowlist'ine girmez).
const { PDFDocument, rgb } = require("pdf-lib");
const fontkitModule = require("@pdf-lib/fontkit");
const fontkit = fontkitModule.default || fontkitModule;
const QRCode = require("qrcode");

const MM = 72 / 25.4;
const A4 = [210 * MM, 297 * MM];

async function getFonts() {
  const get = (f) => fetch(`/fonts/pdf/${f}`).then((r) => r.arrayBuffer());
  const [regular, bold, mono] = await Promise.all([
    get("DejaVuSans.ttf"),
    get("DejaVuSans-Bold.ttf"),
    get("DejaVuSansMono-Bold.ttf"),
  ]);
  return { regular, bold, mono };
}

function fmtDate(s) {
  if (!s) return "—";
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return d ? `${d}.${m}.${y}` : "—";
}

function drawText(page, text, font, size, x, y, color = rgb(0.08, 0.1, 0.14), maxWidth) {
  let t = String(text ?? "");
  // Basit taşma koruması: çok uzun satırlarda kırpılır (buyer-safe, statik).
  while (font.widthOfTextAtSize(t, size) > maxWidth && t.length > 1) {
    t = t.slice(0, -2);
  }
  if (t !== String(text ?? "")) t = t.slice(0, -1) + "…";
  page.drawText(t, { x, y, size, font, color });
}

function randomId() {
  try {
    return crypto.randomUUID().slice(0, 8).toUpperCase();
  } catch {
    return "OTO-" + Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase();
  }
}

async function buildBuyerPdf({ report, shareUrl }) {
  const fonts = await getFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle("OTOİZ Alıcı Raporu");
  doc.setCreator("OTOİZ");
  doc.setProducer("OTOİZ");

  const fLeg = async (docIt, fontsIt) => ({
    regular: await docIt.embedFont(fontsIt.regular, { subset: true }),
    bold: await docIt.embedFont(fontsIt.bold, { subset: true }),
    mono: await docIt.embedFont(fontsIt.mono, { subset: true }),
  });

  const f = await fLeg(doc, fonts);
  const page = doc.addPage(A4);
  const [w, h] = A4;
  const margin = 16 * MM;
  const ink = rgb(0.09, 0.11, 0.14);
  const muted = rgb(0.45, 0.5, 0.58);
  const green = rgb(0.13, 0.77, 0.37);

  let y = h - margin;

  // Başlık
  drawText(page, "OTOİZ", f.bold, 26, margin, y, ink, w - 2 * margin);
  y -= 8 * MM;
  drawText(page, "DİJİTAL SERVİS PASAPORTU — ALICI RAPORU", f.bold, 11, margin, y, green, w - 2 * margin);
  y -= 10 * MM;

  // Araç özeti
  const veh = report.vehicle || {};
  drawText(page, veh.plate || "—", f.bold, 20, margin, y, ink, w - 2 * margin);
  y -= 7 * MM;
  drawText(page, `${veh.brand || ""} ${veh.model || ""}${veh.year ? " · " + veh.year : ""}`.trim(), f.regular, 12, margin, y, muted, w - 2 * margin);
  y -= 9 * MM;

  // Kanıt özeti
  const s = report.stats || { total: 0, servis: 0, bireysel: 0 };
  drawText(page, `KANIT ÖZETİ`, f.bold, 10, margin, y, green, w - 2 * margin);
  y -= 6 * MM;
  drawText(page, `${s.total} kayıt · ${s.servis} servis doğrulamalı · ${s.bireysel} bireysel kayıt`, f.bold, 12, margin, y, ink, w - 2 * margin);
  y -= 8 * MM;

  const rows = [
    ["Güncel kayıtlı km", veh.current_km ? `${Number(veh.current_km).toLocaleString("tr-TR")} km` : "—"],
    ["Son bakım", report.last ? `${fmtDate(report.last.date)} · ${report.last.km ? `${Number(report.last.km).toLocaleString("tr-TR")} km` : "—"}` : "—"],
    ["Sonraki bakım hedefi", veh.next_service_km ? `${Number(veh.next_service_km).toLocaleString("tr-TR")} km · ${fmtDate(veh.next_service_date)}` : "Planlanmadı"],
    ["Muayene", fmtDate(veh.muayene_tarihi)],
    ["Kasko", fmtDate(veh.kasko_bitis)],
    ["Zorunlu Trafik Sigortası", fmtDate(veh.trafik_sigortasi_bitis)],
  ];
  for (const [k, v] of rows) {
    drawText(page, k, f.regular, 11, margin, y, muted, 80 * MM);
    drawText(page, v, f.bold, 11, margin + 80 * MM, y, ink, w - margin - (margin + 90 * MM));
    y -= 6 * MM;
  }
  y -= 6 * MM;

  drawText(page, "BAKIM GEÇMİŞİ", f.bold, 10, margin, y, green, w - 2 * margin);
  y -= 6 * MM;

  const history = Array.isArray(report.chronology) ? report.chronology : [];
  let current = page;
  for (const r of history) {
    if (y < margin + 70 * MM) {
      current = doc.addPage(A4);
      y = h - margin;
    }
    const dateLine = `${fmtDate(r.date)}${r.km ? ` · ${Number(r.km).toLocaleString("tr-TR")} km` : ""}`;
    drawText(current, dateLine, f.bold, 11, margin, y, ink, w - 2 * margin);
    y -= 5 * MM;
    drawText(current, r.items || "Bakım kaydı", f.regular, 10.5, margin, y, muted, w - 2 * margin);
    y -= 5 * MM;
    const badge = r.source === "servis" ? "SERVİS DOĞRULAMALI ✓" : "ARAÇ SAHİBİ KAYDI";
    drawText(current, badge, f.mono, 9, margin, y, green, w - 2 * margin);
    y -= 8 * MM;
  }

  // Footer: rapor ID + tarih + QR
  if (y < margin + 30 * MM) {
    current = doc.addPage(A4);
    y = h - margin - 10 * MM;
  }
  const reportId = randomId();
  const createdAt = new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  drawText(current, `RAPOR OLUŞTURMA TARİHİ: ${createdAt}`, f.regular, 9.5, margin, y, muted, w - 2 * margin);
  y -= 5 * MM;
  drawText(current, `RAPOR ID: ${reportId}`, f.mono, 9.5, margin, y, muted, w - 2 * margin);
  y -= 8 * MM;
  if (shareUrl) {
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, { width: 140 });
      const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
      const qrImage = await doc.embedPng(new Uint8Array(pngBytes));
      current.drawImage(qrImage, { x: margin, y: y - 26 * MM, width: 26 * MM, height: 26 * MM });
    } catch {}
  }
  drawText(current, "Güncel dijital kaydı görüntüle: QR yukarıdadır.", f.regular, 9, margin + 30 * MM, y - 10 * MM, muted, w - margin - (margin + 30 * MM));
  y -= 30 * MM;
  drawText(current, "OTOİZ Alıcı Raporu, sisteme kaydedilmiş bakım ve araç bilgilerini gösterir. Ekspertiz veya mekanik durum garantisi değildir.", f.regular, 8.5, margin, y, muted, w - 2 * margin);

  return await doc.save();
}

module.exports = { buildBuyerPdf };
