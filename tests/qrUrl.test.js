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

test("qrUrl: kalıcı adres tanımlıysa QR içeriği yalnız go.<alan-adı>/<token>", () => {
  const { buildQrUrl } = load("https://go.otoiz-pilot.com/");
  const t = generateQrCode();
  assert.equal(buildQrUrl(t, "https://akilli-servis-anahtari.vercel.app"), `https://go.otoiz-pilot.com/${t}`);
});

test("qrUrl: tanımlı değilse eski davranış (origin/p/kod) korunur", () => {
  const { buildQrUrl, hasPermanentQrBase } = load(undefined);
  const t = generateQrCode();
  assert.equal(buildQrUrl(t, "https://x.vercel.app/"), `https://x.vercel.app/p/${t}`);
  assert.equal(hasPermanentQrBase(), false);
});

test("qrUrl: eski kısa kod kalıcı adrese yazılmaz", () => {
  const { buildQrUrl } = load("https://go.otoiz-pilot.com");
  assert.equal(buildQrUrl("nwanp2ue22pm", "https://x.vercel.app"), "https://x.vercel.app/p/nwanp2ue22pm");
});

test("qrUrl: token formatı dışı değerler reddedilir", () => {
  const { isQrToken } = load(undefined);
  for (const bad of ["", "abc", "A".repeat(26), "o".repeat(26), "1".repeat(26), "a".repeat(27), null, undefined, "a".repeat(25) + "/"]) {
    assert.equal(isQrToken(bad), false, String(bad));
  }
});
