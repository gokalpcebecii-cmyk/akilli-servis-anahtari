#!/usr/bin/env node
"use strict";

// OTOİZ 04A-S — build zincirine bağlı fail-closed environment kapısı.
// `npm run build` → `next build`'den ÖNCE çalışır (package.json). Hata
// varsa build hiç başlamadan process.exit(1) ile durur. Hiçbir anahtar/
// secret DEĞERİ konsola yazdırılmaz — yalnızca isim + karşılaştırma sonucu.

const { validateDeploymentEnv } = require("../lib/envCheck");

const result = validateDeploymentEnv(process.env);

for (const notice of result.notices) {
  console.log(`[otoiz-env-check] BİLGİ: ${notice}`);
}

if (result.testMode) {
  console.log("[otoiz-env-check] Test modu — doğrulama atlandı (yalnızca yerel, VERCEL algılanmadı).");
  process.exit(0);
}

if (!result.ok) {
  console.error("[otoiz-env-check] Ortam doğrulaması BAŞARISIZ — build durduruldu:");
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`[otoiz-env-check] Ortam doğrulaması geçti (rol: ${process.env.OTOIZ_DEPLOYMENT_ROLE}).`);
process.exit(0);
