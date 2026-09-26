"use strict";

// OTOİZ Aşama 1 — kalıcı QR resolver'ın saf (test edilebilir) karar mantığı.
// Route: app/r/[token]/route.ts. go.<final-domain>/<token> istekleri
// next.config.js host koşullu rewrite ile /r/<token>'a gelir.
//
// Kurallar:
//  - Token normalize edilir (büyük/küçük harf, sondaki "/", boşluk/tire
//    farkları kodu değiştirmez) ve 26 karakter/alfabe dışındaysa veritabanına
//    hiç gidilmeden "geçersiz" sayılır.
//  - Yönlendirme her zaman 307 (geçici) + no-store: hedef route ileride
//    değişebilir, basılı QR değişmez. 301/308 KULLANILMAZ (tarayıcı önbelleği).
//  - Yanıtta vehicle_id, plaka veya başka kişisel/iç veri yoktur; hata
//    sayfaları token'ı bile geri yazmaz.

const { normalizeQrCode } = require("./qrToken");
const { isQrToken } = require("./qrUrl");

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function normalizeResolverToken(raw) {
  let s = String(raw ?? "");
  try {
    s = decodeURIComponent(s);
  } catch {
    return null;
  }
  s = normalizeQrCode(s.replace(/\/+$/, ""));
  return isQrToken(s) ? s : null;
}

const MESSAGES = {
  not_found: {
    status: 404,
    title: "Geçersiz OTOİZ kodu",
    body: "Bu QR kod sistemde tanımlı değil. Kodu yeniden okutmayı deneyin; sorun devam ederse servisinizle veya OTOİZ ile iletişime geçin.",
  },
  revoked: {
    status: 410,
    title: "Bu OTOİZ anahtarı artık aktif değil.",
    body: "Bu anahtarlık iptal edilmiş veya yenisiyle değiştirilmiş. Aracınızın güncel OTOİZ anahtarlığını okutun; yeni anahtarlık için servisinizle veya OTOİZ ile iletişime geçin.",
  },
  error: {
    status: 503,
    title: "Şu anda doğrulanamadı",
    body: "OTOİZ kodu şu an kontrol edilemiyor. Lütfen birkaç saniye sonra yeniden deneyin.",
  },
};

// status: resolve_qr_token sonucu ('not_found'|'revoked'|'unassigned'|'active')
// veya RPC hatasında 'error'.
function decide(token, status, appOrigin) {
  if (!token) return { kind: "page", ...MESSAGES.not_found };
  if (status === "active" || status === "unassigned") {
    // Aşama 1: iki durum da mevcut pasaport ekranına gider (unassigned için
    // "Henüz Eşleştirilmemiş"). Aktivasyon ve oturum/rol bazlı yönlendirme
    // sonraki aşamalarda YALNIZ bu hedef değiştirilerek eklenir.
    const origin = String(appOrigin || "").replace(/\/+$/, "");
    return { kind: "redirect", status: 307, location: `${origin}/p/${token}` };
  }
  if (status === "revoked") return { kind: "page", ...MESSAGES.revoked };
  if (status === "not_found") return { kind: "page", ...MESSAGES.not_found };
  return { kind: "page", ...MESSAGES.error };
}

function renderMessagePage(title, body) {
  // İçerik sabittir; kullanıcı girdisi (token) sayfaya yazılmaz.
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>OTOİZ</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f8;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#10212b}
main{max-width:420px;padding:28px 20px;text-align:center}.b{font-weight:900;letter-spacing:.5px;color:#1f9d55;margin-bottom:14px}
h1{font-size:20px;margin:0 0 10px}p{color:#5b6b76;line-height:1.6;margin:0}</style></head>
<body><main><div class="b">OTOİZ</div><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

module.exports = { NO_STORE_HEADERS, MESSAGES, normalizeResolverToken, decide, renderMessagePage };
