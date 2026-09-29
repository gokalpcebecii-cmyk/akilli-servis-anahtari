// OTOİZ — iPhone kurulum sihirbazı: iOS tarayıcı ortamını sınıflandırır.
//
// Apple, web sitesinin ana ekrana programla kurulmasına izin vermez; kurulum
// kullanıcının Safari'de Paylaş → Ana Ekrana Ekle → Ekle adımlarıyla olur.
// Uygulama içi tarayıcılar (Instagram, Facebook, WhatsApp, Google uygulaması
// vb.) bu menüyü sunmaz; o durumda önce "Safari'de açın" gösterilir.
//
//   safari  : iOS Safari → doğrudan 3 adım
//   browser : iOS Chrome / Firefox / Edge / Opera … → önce Safari önerisi,
//             istenirse bu tarayıcıda devam (iOS 16.4+ Paylaş menüsünde var)
//   inapp   : uygulama içi tarayıcı → yalnız "Safari'de açın"
//
// Not: SFSafariViewController (bazı uygulamaların "Safari görünümü") Safari
// ile aynı user-agent'ı gönderir, ayırt edilemez; sihirbaz bu yüzden 2. adımda
// "seçenek yoksa Safari'de açın" notunu her zaman gösterir.

const IN_APP = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FBIOS|FB_IAB|FBSS/, "Facebook"],
  [/WhatsApp/i, "WhatsApp"],
  [/Snapchat/i, "Snapchat"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Twitter/i, "X"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/\bLine\//, "LINE"],
  [/Telegram/i, "Telegram"],
  [/Pinterest/i, "Pinterest"],
  [/MicroMessenger/i, "WeChat"],
  [/\bGSA\//, "Google"],
  [/Claude/i, "Claude"],
];

const OTHER_BROWSERS = [
  [/CriOS/, "Chrome"],
  [/FxiOS/, "Firefox"],
  [/EdgiOS/, "Edge"],
  [/OPiOS|OPT\//, "Opera"],
  [/YaBrowser/, "Yandex"],
  [/DuckDuckGo/i, "DuckDuckGo"],
];

function classifyIosBrowser(ua) {
  ua = String(ua || "");
  for (const [re, app] of IN_APP) if (re.test(ua)) return { kind: "inapp", app };
  for (const [re, app] of OTHER_BROWSERS) if (re.test(ua)) return { kind: "browser", app };
  // Safari ve iOS tarayıcıları "Safari/604.1" belirtecini gönderir; çıplak
  // WKWebView (çoğu uygulama içi tarayıcı) göndermez.
  if (!/Safari\//.test(ua)) return { kind: "inapp", app: null };
  return { kind: "safari", app: null };
}

module.exports = { classifyIosBrowser };
