const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyIosBrowser } = require("../lib/iosInstall");

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const WEBVIEW = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

test("iosInstall: Safari (iPhone ve masaüstü kipindeki iPad) doğrudan 3 adıma gider", () => {
  assert.deepEqual(classifyIosBrowser(SAFARI), { kind: "safari", app: null });
  assert.deepEqual(classifyIosBrowser(IPAD_SAFARI), { kind: "safari", app: null });
});

test("iosInstall: uygulama içi tarayıcılar 'inapp' (önce Safari'de aç)", () => {
  const cases = [
    [WEBVIEW + " Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_5; tr_TR)", "Instagram"],
    [WEBVIEW + " [FBAN/FBIOS;FBAV/480.0.0;FBBV/1;FBDV/iPhone15,2]", "Facebook"],
    [WEBVIEW + " WhatsApp/25.1.0", "WhatsApp"],
    [WEBVIEW + " Snapchat/13.0", "Snapchat"],
    [WEBVIEW + " LinkedInApp/9.0", "LinkedIn"],
    [WEBVIEW + " Twitter for iPhone/10.0", "X"],
    [WEBVIEW + " musical_ly_37.0 BytedanceWebview/d8a21c6", "TikTok"],
    [WEBVIEW + " Line/14.0.0", "LINE"],
    [WEBVIEW + " Telegram-iOS/11.0", "Telegram"],
    [SAFARI.replace("Version/18.5", "GSA/350.0.0") , "Google"],
    [WEBVIEW + " Claude/1.2", "Claude"],
  ];
  for (const [ua, app] of cases) assert.deepEqual(classifyIosBrowser(ua), { kind: "inapp", app }, ua);
  // Tanınmayan çıplak WKWebView de inapp sayılır.
  assert.deepEqual(classifyIosBrowser(WEBVIEW), { kind: "inapp", app: null });
});

test("iosInstall: diğer iOS tarayıcıları 'browser'", () => {
  assert.deepEqual(classifyIosBrowser(SAFARI.replace("Version/18.5", "CriOS/140.0.0.0")), { kind: "browser", app: "Chrome" });
  assert.deepEqual(classifyIosBrowser(SAFARI.replace("Version/18.5", "FxiOS/140.0")), { kind: "browser", app: "Firefox" });
  assert.deepEqual(classifyIosBrowser(SAFARI.replace("Version/18.5", "EdgiOS/140.0")), { kind: "browser", app: "Edge" });
});

test("iosInstall: boş / tanımsız user-agent güvenli", () => {
  assert.equal(classifyIosBrowser("").kind, "inapp");
  assert.equal(classifyIosBrowser(undefined).kind, "inapp");
});
