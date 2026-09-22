"use strict";

// OTOİZ 04A-S — /api/reminders CRON çağrısının yetkilendirme kararı.
//
// ÖNCEKİ HATA: `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` —
// CRON_SECRET tanımsızsa bu ifade "Bearer undefined" DİZESİNE eşit olur;
// istemci gerçekten "Authorization: Bearer undefined" gönderirse istek
// KABUL EDİLİRDİ. Fail-closed düzeltme: secret tanımlı/boş değilse
// header'la HİÇ karşılaştırma yapılmadan önce reddedilir (503 — "route
// yapılandırılmamış"), header karşılaştırması yalnızca gerçek bir secret
// varken çalışır (uyuşmazsa 401). Secret veya header İÇERİĞİ hiçbir
// zaman loglanmaz — yalnızca karar (ok/status) döner.
function authorizeCronRequest(authHeader, cronSecret) {
  if (typeof cronSecret !== "string" || cronSecret.trim().length === 0) {
    return { ok: false, status: 503, body: { error: "cron_not_configured" } };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, body: { error: "unauthorized" } };
  }

  return { ok: true, status: 200, body: null };
}

module.exports = { authorizeCronRequest };
