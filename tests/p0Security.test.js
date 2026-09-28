const test = require("node:test");
const assert = require("node:assert/strict");
const { clientIp, rateKey, LIMITS } = require("../lib/rateLimitCore");
const { slugifyBusiness, validateServiceFields, unguessablePassword, applicationMessage, SERVICE_COMPLETE_PATH } = require("../lib/serviceSignup");
const { adminMfaEnforced, tokenAal, isSixDigitCode } = require("../lib/adminMfa");
const { confirmRedirectUrl, completionPathFor, shouldForwardToCompletion, INDIVIDUAL_COMPLETE_PATH } = require("../lib/emailConfirm");

const h = (o) => ({ get: (k) => o[k] ?? null });

test("clientIp: x-forwarded-for ilk öğe, yedek x-real-ip, yoksa unknown", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(h({})), "unknown");
  assert.equal(clientIp(h({ "x-forwarded-for": "x".repeat(100) })), "unknown");
});

test("rateKey: ham değer saklanmaz, büyük/küçük harf ve boşluk bağımsız", () => {
  const k = rateKey("signup-email-h", " Ali@Ornek.com ");
  assert.equal(k, rateKey("signup-email-h", "ali@ornek.com"));
  assert.doesNotMatch(k, /ornek/);
  assert.ok(k.length <= 200);
  assert.notEqual(k, rateKey("resend-email-h", "ali@ornek.com"));
  for (const l of Object.values(LIMITS)) assert.ok(l.max >= 1 && l.windowSeconds >= 60);
});

test("servis alanları: işletme adı zorunlu, telefon biçimi, kontrol karakteri temizliği", () => {
  assert.equal(validateServiceFields({ business_name: " " }).error, "İşletme adı zorunlu.");
  assert.match(validateServiceFields({ business_name: "Yılmaz Oto", phone: "abc" }).error, /Telefon/);
  const ok = validateServiceFields({ business_name: "Yılmaz\u0000 Oto", phone: "0312 000 00 00", address: "Ankara" });
  assert.equal(ok.value.business_name, "Yılmaz  Oto");
  assert.equal(ok.value.phone, "0312 000 00 00");
});

test("slugifyBusiness: veritabanı kuralına uyar (^[a-z0-9-]{3,80}$)", () => {
  assert.equal(slugifyBusiness("Yılmaz Oto Servis", "ab12cd"), "yilmaz-oto-servis-ab12cd");
  assert.match(slugifyBusiness("!!!"), /^servis-[a-f0-9]{6}$/);
  assert.match(slugifyBusiness("Ç".repeat(200)), /^[a-z0-9-]{3,80}$/);
});

test("unguessablePassword: uzun ve her seferinde farklı", () => {
  const a = unguessablePassword();
  assert.ok(a.length >= 40);
  assert.notEqual(a, unguessablePassword());
});

test("servis doğrulama dönüşü /hesap/dogrulandi üzerinden tamamla sayfasına", () => {
  assert.equal(SERVICE_COMPLETE_PATH, "/panel/kayit/tamamla");
  assert.equal(confirmRedirectUrl("https://otoizgo.com", SERVICE_COMPLETE_PATH), "https://otoizgo.com/hesap/dogrulandi?next=%2Fpanel%2Fkayit%2Ftamamla");
  assert.match(applicationMessage("submitted"), /OTOİZ onayından sonra/);
  assert.match(applicationMessage("bilinmeyen"), /kaydedilemedi/);
});

function jwt(payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "HS256" })}.${b(payload)}.sig`;
}

test("admin MFA: varsayılan zorunlu, yalnız açık 'off' ile kapanır", () => {
  assert.equal(adminMfaEnforced({}), true);
  assert.equal(adminMfaEnforced({ OTOIZ_ADMIN_MFA_ENFORCE: "on" }), true);
  assert.equal(adminMfaEnforced({ OTOIZ_ADMIN_MFA_ENFORCE: "yes-off" }), true);
  assert.equal(adminMfaEnforced({ OTOIZ_ADMIN_MFA_ENFORCE: "off" }), false);
  assert.equal(adminMfaEnforced({ OTOIZ_ADMIN_MFA_ENFORCE: " OFF " }), false);
});

test("admin MFA: token aal okunur; bozuk token aal2 sayılmaz", () => {
  assert.equal(tokenAal(`Bearer ${jwt({ aal: "aal2", sub: "x" })}`), "aal2");
  assert.equal(tokenAal(`Bearer ${jwt({ aal: "aal1" })}`), "aal1");
  assert.equal(tokenAal("Bearer garbage"), null);
  assert.equal(tokenAal(""), null);
  assert.equal(tokenAal(`Bearer ${jwt({ aal: ["aal2"] })}`), null);
});

test("admin MFA: 6 haneli kod biçimi", () => {
  assert.equal(isSixDigitCode("123456"), true);
  assert.equal(isSixDigitCode("123 456"), true);
  assert.equal(isSixDigitCode("12345"), false);
  assert.equal(isSixDigitCode("abcdef"), false);
});

test("son kapılar: doğrulama sonrası şifre belirleme sayfası seçimi", () => {
  assert.equal(INDIVIDUAL_COMPLETE_PATH, "/bireysel/kayit/tamamla");
  assert.equal(completionPathFor("/panel/kayit/tamamla"), SERVICE_COMPLETE_PATH);
  assert.equal(completionPathFor("/panel/dashboard"), SERVICE_COMPLETE_PATH);
  assert.equal(completionPathFor("/aktivasyon?code=abc"), "/bireysel/kayit/tamamla?next=%2Faktivasyon%3Fcode%3Dabc");
  assert.equal(completionPathFor(""), "/bireysel/kayit/tamamla?next=%2Fbireysel%2Faraclar");
  assert.equal(completionPathFor("https://evil.example"), "/bireysel/kayit/tamamla?next=%2Fbireysel%2Faraclar");
  assert.equal(completionPathFor("//evil.example"), "/bireysel/kayit/tamamla?next=%2Fbireysel%2Faraclar");
  assert.equal(completionPathFor("/bireysel/kayit/tamamla?next=/x"), "/bireysel/kayit/tamamla?next=%2Fbireysel%2Faraclar");
});

test("son kapılar: yalnız kayıt doğrulaması şifre sayfasına aktarılır", () => {
  assert.equal(shouldForwardToCompletion("#access_token=a&refresh_token=b&type=signup"), true);
  assert.equal(shouldForwardToCompletion("#access_token=a&refresh_token=b"), true);
  assert.equal(shouldForwardToCompletion("#access_token=a&refresh_token=b&type=recovery"), false);
  assert.equal(shouldForwardToCompletion("#access_token=a&refresh_token=b&type=email_change"), false);
  assert.equal(shouldForwardToCompletion("#access_token=a&type=signup"), false);
  assert.equal(shouldForwardToCompletion("#error=access_denied"), false);
});
