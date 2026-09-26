const test = require("node:test");
const assert = require("node:assert/strict");
const { safeNext, confirmRedirectUrl, signupErrorMessage, parseConfirmHash } = require("../lib/emailConfirm");

test("safeNext: yalnız site içi yol", () => {
  assert.equal(safeNext("/aktivasyon?t=abc"), "/aktivasyon?t=abc");
  assert.equal(safeNext("//evil.com"), "");
  assert.equal(safeNext("https://evil.com"), "");
  assert.equal(safeNext("/\\evil.com"), "");
  assert.equal(safeNext(undefined), "");
});

test("confirmRedirectUrl: /hesap/dogrulandi + güvenli next", () => {
  assert.equal(confirmRedirectUrl("https://otoizgo.com/", "/aktivasyon?t=x"), "https://otoizgo.com/hesap/dogrulandi?next=%2Faktivasyon%3Ft%3Dx");
  assert.equal(confirmRedirectUrl("https://otoizgo.com", "//evil.com"), "https://otoizgo.com/hesap/dogrulandi");
});

test("parseConfirmHash: Auth sonucu", () => {
  assert.deepEqual(parseConfirmHash("#error=access_denied&error_code=otp_expired&error_description=x"), { ok: false, error: "otp_expired" });
  assert.equal(parseConfirmHash("#access_token=a&refresh_token=b&type=signup").ok, true);
  assert.equal(parseConfirmHash("").ok, null);
  assert.equal(parseConfirmHash("#type=recovery").ok, null);
});

test("signupErrorMessage: ham metin gösterilmez", () => {
  assert.match(signupErrorMessage({ code: "over_email_send_rate_limit", status: 429 }), /birkaç dakika/);
  assert.match(signupErrorMessage({ code: "email_address_not_authorized", status: 400 }), /gönderilemedi/);
  assert.match(signupErrorMessage({ status: 500, message: "SMTP boom" }), /gönderilemedi/);
  assert.doesNotMatch(signupErrorMessage({ message: "internal pq error" }), /pq/);
});
