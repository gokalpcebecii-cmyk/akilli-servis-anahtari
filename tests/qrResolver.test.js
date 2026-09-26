const test = require("node:test");
const assert = require("node:assert/strict");
const { generateQrCode } = require("../lib/qrToken");
const { normalizeResolverToken, decide, renderMessagePage } = require("../lib/qrResolver");

const APP = "https://otoiz-pilot.com";

test("resolver: token normalize — büyük harf, sondaki /, URL kodlaması", () => {
  const t = generateQrCode();
  assert.equal(normalizeResolverToken(t), t);
  assert.equal(normalizeResolverToken(t.toUpperCase()), t);
  assert.equal(normalizeResolverToken(t + "/"), t);
  assert.equal(normalizeResolverToken(encodeURIComponent(t)), t);
});

test("resolver: format dışı token DB'ye gitmeden geçersiz sayılır", () => {
  for (const bad of ["", "-", "nwanp2ue22pm", "o".repeat(26), "a".repeat(27), "%E0%A4%A", "../" + "a".repeat(23), null, undefined]) {
    assert.equal(normalizeResolverToken(bad), null, String(bad));
  }
});

test("resolver: active/unassigned → 307 ana uygulama /p/<token>", () => {
  const t = generateQrCode();
  for (const s of ["active", "unassigned"]) {
    const d = decide(t, s, APP + "/");
    assert.equal(d.kind, "redirect");
    assert.equal(d.status, 307);
    assert.equal(d.location, `${APP}/p/${t}`);
  }
});

test("resolver: revoked → 410 'artık aktif değil'; not_found → 404; hata → 503", () => {
  const t = generateQrCode();
  const r = decide(t, "revoked", APP);
  assert.equal(r.status, 410);
  assert.match(r.title, /artık aktif değil/);
  assert.equal(decide(t, "not_found", APP).status, 404);
  assert.equal(decide(null, "active", APP).status, 404);
  assert.equal(decide(t, "error", APP).status, 503);
  assert.equal(decide(t, "beklenmeyen", APP).status, 503);
});

test("resolver: yönlendirme hiçbir zaman kalıcı (301/308) değildir", () => {
  const d = decide(generateQrCode(), "active", APP);
  assert.ok(![301, 308].includes(d.status));
});

test("resolver: mesaj sayfası token'ı geri yazmaz", () => {
  const t = generateQrCode();
  const d = decide(t, "revoked", APP);
  assert.ok(!renderMessagePage(d.title, d.body).includes(t));
});
