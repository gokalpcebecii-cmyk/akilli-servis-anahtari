"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const seo = require("../lib/seo");

const PROD = { OTOIZ_DEPLOYMENT_ROLE: "production", VERCEL_ENV: "production" };

test("yalnız production rolü + Vercel production hedefi indekslenebilir", () => {
  assert.equal(seo.isIndexable(PROD), true);
  assert.equal(seo.isIndexable({ OTOIZ_DEPLOYMENT_ROLE: "production" }), true);
  assert.equal(seo.isIndexable({ OTOIZ_DEPLOYMENT_ROLE: "production", VERCEL_ENV: "preview" }), false);
  assert.equal(seo.isIndexable({ OTOIZ_DEPLOYMENT_ROLE: "staging", VERCEL_ENV: "production" }), false);
  assert.equal(seo.isIndexable({}), false);
  assert.equal(seo.isIndexable(undefined), false);
});

test("staging robots.txt tüm siteyi kapatır, sitemap göstermez", () => {
  const r = seo.robotsRules({ OTOIZ_DEPLOYMENT_ROLE: "staging", VERCEL_ENV: "production" });
  assert.deepEqual(r, { rules: [{ userAgent: "*", disallow: "/" }] });
});

test("production robots.txt özel alanları kapatır, kökü açık bırakır", () => {
  const r = seo.robotsRules(PROD);
  assert.equal(r.rules[0].allow, "/");
  for (const p of ["/yonetim", "/bireysel/", "/panel/", "/servis/", "/aktivasyon", "/hesap/", "/p/", "/r/", "/v/", "/api/"]) {
    assert.ok(r.rules[0].disallow.includes(p), p);
  }
  assert.ok(!r.rules[0].disallow.includes("/"));
  assert.equal(r.sitemap, "https://otoizgo.com/sitemap.xml");
});

test("sitemap yalnız ana sayfayı içerir", () => {
  const urls = seo.sitemapEntries().map((e) => e.url);
  assert.deepEqual(urls, ["https://otoizgo.com/"]);
});

// Next.js header kaynağındaki desenin davranışını birebir kontrol eder.
function headerMatches(rule, path) {
  if (rule.source === "/") return path === "/";
  const inner = rule.source.slice("/:path(".length, -1);
  return new RegExp(`^/${inner}$`).test(path);
}

test("X-Robots-Tag: kök hariç her sayfa noindex, dosyalar hariç", () => {
  const rules = seo.robotsHeaderRules(PROD);
  const noindex = (p) => rules.some((r) => headerMatches(r, p));
  for (const p of ["/yonetim", "/yonetim/yazdir", "/bireysel/araclar/1", "/panel/dashboard", "/aktivasyon",
    "/hesap/dogrulandi", "/p/ABC123", "/v/1", "/giris", "/api/signup"]) {
    assert.equal(noindex(p), true, p);
  }
  for (const p of ["/", "/r/abcdefghijklmnopqrstuvwxyz", "/robots.txt", "/sitemap.xml", "/og/otoiz-og-1200x630.jpg", "/icons/otoiz-icon-512.png", "/manifest.json"]) {
    assert.equal(noindex(p), false, p);
  }
  for (const r of rules) assert.match(r.headers[0].value, /noindex/);
});

test("X-Robots-Tag: staging'de kök de noindex", () => {
  const rules = seo.robotsHeaderRules({ OTOIZ_DEPLOYMENT_ROLE: "staging" });
  assert.ok(rules.some((r) => headerMatches(r, "/")));
});

test("structured data: Organization + WebSite, yanlış şema yok", () => {
  const d = seo.structuredData();
  const types = d["@graph"].map((n) => n["@type"]);
  assert.deepEqual(types, ["Organization", "WebSite"]);
  const json = JSON.stringify(d);
  assert.ok(!/LocalBusiness|Product|NFC/.test(json));
  assert.ok(json.includes("OTOİZGO"));
  assert.equal(d["@graph"][1].publisher["@id"], d["@graph"][0]["@id"]);
});

test("ana sayfa metin vaatleri: NFC ve değer artışı yok", () => {
  const text = `${seo.HOME_TITLE} ${seo.HOME_DESCRIPTION}`;
  assert.ok(!/NFC|değer/i.test(text));
  assert.equal(seo.HOME_TITLE, "OTOİZ | Aracınız İçin Dijital Servis Pasaportu");
});

test("X-Robots-Tag kuralları kalıcı QR host'unu (go.) kapsamaz", () => {
  for (const r of seo.robotsHeaderRules({}, "go.otoizgo.com")) {
    assert.deepEqual(r.missing, [{ type: "host", value: "go.otoizgo.com" }]);
  }
  for (const r of seo.robotsHeaderRules(PROD, null)) assert.equal(r.missing, undefined);
});
