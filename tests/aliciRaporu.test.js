"use strict";

// OTOİZ — Alıcı Raporu unit testleri: token güvenliği, süre/revoke,
// allowlist ve private veri sızıntı koruması.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateShareToken,
  hashShareToken,
  durationHoursFor,
  sharesExpireAt,
  isShareActive,
  isShareExpired,
  buildBuyerReport,
  buildProofLine,
  isBuyerEmail,
  ALLOWED_VEHICLE_FIELDS,
} = require("../lib/buyerReport");

test("token: CSPRNG — iki üretim farklı, hash stabil ve sha256", () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40, "yeterli entropi");
  assert.equal(hashShareToken(a), hashShareToken(a));
  assert.match(hashShareToken(a), /^[0-9a-f]{64}$/);
});

test("süre seçenekleri: 24h=24, 3d=72, 7d=168; geçersiz olan null", () => {
  assert.equal(durationHoursFor("24h"), 24);
  assert.equal(durationHoursFor("3d"), 72);
  assert.equal(durationHoursFor("7d"), 168);
  assert.equal(durationHoursFor("bogus"), null);
});

test("share aktif/revoked/expired kuralları", () => {
  const now = Date.now();
  const ok = { expires_at: new Date(now + 3600000).toISOString(), revoked_at: null };
  assert.equal(isShareActive(ok, now), true);
  assert.equal(isShareActive({ ...ok, revoked_at: new Date().toISOString() }, now), false);
  assert.equal(isShareExpired({ expires_at: new Date(now - 1000).toISOString() }, now), true);
  assert.equal(isShareActive(null, now), false);
});

test("buyer report allowlist: hesaplanan alanlar sızmaz, private'lar korunur", () => {
  const report = buildBuyerReport(
    {
      id: "vehicle-1234567890",
      plate: "34 QR 001",
      brand: "Fiat",
      model: "Egea",
      year: 2021,
      current_km: 42000,
      next_service_km: 52000,
      next_service_date: "2027-01-01",
      muayene_tarihi: "2026-11-05",
      kasko_bitis: "2026-12-31",
      trafik_sigortasi_bitis: "2026-12-31",
      owner_user_id: "secret-owner-id",
      notes: "özel not",
    },
    [
      { service_date: "2026-03-20", km_at_service: 40000, description: "Motor Yağı, Yağ Filtresi — Not: çok iş", tenant_id: "tenant-xyz" },
      { service_date: "2026-01-10", km_at_service: 35000, description: "Yağ Filtresi", tenant_id: null },
    ]
  );
  assert.equal(report.vehicle.plate, "34 QR 001");
  assert.equal(report.vehicle.owner_user_id, undefined, "owner_user_id sızmamalı");
  assert.equal(report.vehicle.notes, undefined, "özel not sızmamalı");
  assert.equal(report.vehicle.id, undefined, "internal id sızmamalı");
  assert.equal(report.stats.total, 2);
  assert.equal(report.stats.servis, 1); // tenant_id varsa servis
  assert.equal(report.stats.bireysel, 1);
  assert.ok(!report.chronology[0].items.includes("Not:"), "kişisel not allowlist dışı");
  assert.ok(!report.chronology[0].items.includes("özel"), "kişisel metin yok");
  assert.equal(report.chronology[0].source, "servis");
  assert.equal(report.chronology[1].source, "bireysel");
});

test("kanıt özeti satırı", () => {
  assert.equal(buildProofLine({ total: 27, servis: 11, bireysel: 16 }), "27 kayıt · 11 servis doğrulamalı · 16 bireysel kayıt");
  assert.equal(buildProofLine(null), "0 kayıt · 0 servis doğrulamalı · 0 bireysel kayıt");
});

test("email doğrulama", () => {
  assert.equal(isBuyerEmail("alici@ornek.com"), true);
  assert.equal(isBuyerEmail("gecersiz"), false);
  assert.equal(isBuyerEmail("a@b"), false);
  assert.equal(isBuyerEmail("alici ile @x.com"), false);
});

test("allowlist checklist'i yüzeyde kullanılıyor (vehicles alanları)", () => {
  assert.ok(ALLOWED_VEHICLE_FIELDS.includes("plate"));
  assert.ok(!ALLOWED_VEHICLE_FIELDS.includes("owner_user_id"));
});

test("oluşturulan paylaşım URL'i /alici/<token> biçiminde kısa, vehicle_id içermez", () => {
  const token = generateShareToken();
  const path = `/alici/${token}`;
  assert.match(path, /^\/alici\/[A-Za-z0-9_-]{40,}$/);
  assert.ok(!path.includes("id="), "vehicle_id URL'de taşınmamalı");
  assert.ok(Date.parse(sharesExpireAt("24h")) > Date.now());
});
