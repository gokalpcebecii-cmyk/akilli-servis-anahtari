"use strict";

// OTOİZ Faz 3 — parti çıktıları (CSV). Yönetim paneli ve baskı betiği aynı
// fonksiyonları kullanır.
//
// Kural: fiziksel baskıya giden dosyada plaka, vehicle_id veya kişisel veri
// YOKTUR. QR içeriği yalnız printableQrUrl() (https://go.<alan-adı>/<token>).
// Aktivasyon kodu QR baskı dosyasında YOKTUR; yalnız paketleme listesinde.

const { formatActivationCode } = require("./activationCode");

function csvCell(v) {
  const s = String(v ?? "");
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  // Excel'in Türkçe karakterleri doğru açması için UTF-8 BOM.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Baskı evi: yalnız seri + QR içeriği.
function printCsv(items, qrUrlFor, batchLabel) {
  return toCsv(
    ["batch", "serial_no", "qr_url"],
    items.map((i) => [batchLabel, i.serial_no, qrUrlFor(i.token) ?? ""])
  );
}

// Paketleme: seri + aktivasyon kodu (kart). QR token'ı yok.
function packingCsv(items, batchLabel) {
  return toCsv(
    ["batch", "serial_no", "activation_code"],
    items.map((i) => [batchLabel, i.serial_no, formatActivationCode(i.activation_code)])
  );
}

// Arşiv (gizli, yalnız yönetici): hepsi bir arada.
function masterCsv(items, qrUrlFor, batchLabel) {
  return toCsv(
    ["batch", "serial_no", "qr_token", "qr_url", "activation_code"],
    items.map((i) => [batchLabel, i.serial_no, i.token, qrUrlFor(i.token) ?? "", formatActivationCode(i.activation_code)])
  );
}

module.exports = { toCsv, printCsv, packingCsv, masterCsv };
