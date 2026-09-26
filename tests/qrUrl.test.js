const test = require("node:test");
const assert = require("node:assert/strict");
const { generateQrCode } = require("../lib/qrToken");

function load(base) {
  delete require.cache[require.resolve("../lib/qrUrl")];
  if (base === undefined) delete process.env.NEXT_PUBLIC_QR_BASE_URL;
  else process.env.NEXT_PUBLIC_QR_BASE_URL = base;
  return require("../lib/qrUrl");
}

test("qrUrl: üretilen her token resolver formatına uyar", () => {
  const { isQrToken } = load(undefined);
  for (let i = 0; i < 2000; i++) assert.ok(isQrToken(generateQrCode()));
});

test("qrUrl: kalıcı adres tanımlıysa QR içeriği yalnız go.<alan-adı>/<token>, kilit açık", () => {
  const { printableQrUrl, qrIssuanceLocked } = load("https://go.otoiz-pilot.com/");
  const t = generateQrCode();
  assert.equal(printableQrUrl(t), `https://go.otoiz-pilot.com/${t}`);
  assert.equal(qrIssuanceLocked(), false);
});

test("qrUrl: kalıcı adres yoksa QR görseli üretilmez ve üretim kilitli", () => {
  const { printableQrUrl, qrIssuanceLocked } = load(undefined);
  assert.equal(printableQrUrl(generateQrCode()), null);
  assert.equal(qrIssuanceLocked(), true);
  const again = load("   ");
  assert.equal(again.qrIssuanceLocked(), true);
});

test("qrUrl: eski kısa kod için QR görseli üretilmez", () => {
  const { printableQrUrl } = load("https://go.otoiz-pilot.com");
  assert.equal(printableQrUrl("nwanp2ue22pm"), null);
});

test("qrUrl: token formatı dışı değerler reddedilir", () => {
  const { isQrToken } = load(undefined);
  for (const bad of ["", "abc", "A".repeat(26), "o".repeat(26), "1".repeat(26), "a".repeat(27), null, undefined, "a".repeat(25) + "/"]) {
    assert.equal(isQrToken(bad), false, String(bad));
  }
});
