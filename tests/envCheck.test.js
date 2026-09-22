const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDeploymentEnv, STAGING_REF, PRODUCTION_REF } = require("../lib/envCheck");

function fakeJwt(payload) {
  // Not: imza kısmı "fake"/"dummy" gibi placeholder işaretçileri İÇERMEMELİ
  // — validateDeploymentEnv tüm anahtar dizesini placeholder taramasından
  // geçirir, gerçek bir JWT'nin imza segmenti asla bu kelimeleri içermez.
  const b64url = (obj) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.zxKq9mN3pQwErTyUiOpAsDfGhJkLzXcVbNm1234567890`;
}

function baseStagingEnv(overrides) {
  return Object.assign(
    {
      OTOIZ_DEPLOYMENT_ROLE: "staging",
      OTOIZ_EXPECTED_SUPABASE_REF: STAGING_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ iss: "supabase", ref: STAGING_REF, role: "anon" }),
      SUPABASE_SERVICE_ROLE_KEY: fakeJwt({ iss: "supabase", ref: STAGING_REF, role: "service_role" }),
      CRON_SECRET: "cok-uzun-ve-rastgele-bir-staging-secret-degeri",
    },
    overrides
  );
}

function baseProductionEnv(overrides) {
  return Object.assign(
    {
      OTOIZ_DEPLOYMENT_ROLE: "production",
      OTOIZ_EXPECTED_SUPABASE_REF: PRODUCTION_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ iss: "supabase", ref: PRODUCTION_REF, role: "anon" }),
      SUPABASE_SERVICE_ROLE_KEY: fakeJwt({ iss: "supabase", ref: PRODUCTION_REF, role: "service_role" }),
      CRON_SECRET: "cok-uzun-ve-rastgele-bir-production-secret-degeri",
    },
    overrides
  );
}

test("staging: doğru ref/URL/anahtarlarla geçer", () => {
  const result = validateDeploymentEnv(baseStagingEnv());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.testMode, false);
});

test("staging: OTOIZ_EXPECTED_SUPABASE_REF yanlış -> reddedilir", () => {
  const result = validateDeploymentEnv(baseStagingEnv({ OTOIZ_EXPECTED_SUPABASE_REF: "yanlis-ref" }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("OTOIZ_EXPECTED_SUPABASE_REF")));
});

test("staging: NEXT_PUBLIC_SUPABASE_URL hostu yanlış -> reddedilir", () => {
  const result = validateDeploymentEnv(baseStagingEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://baska-proje.supabase.co" }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("hostu")));
});

test("staging: Production ref'i URL içinde herhangi bir yerde geçiyorsa (host doğru olsa bile) reddedilir", () => {
  const result = validateDeploymentEnv(
    baseStagingEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co/?fallback=${PRODUCTION_REF}` })
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes(PRODUCTION_REF)));
});

test("production: doğru ref/URL/anahtarlarla geçer", () => {
  const result = validateDeploymentEnv(baseProductionEnv());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("production: staging ref'i URL içinde geçiyorsa reddedilir", () => {
  const result = validateDeploymentEnv(
    baseProductionEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co/?x=${STAGING_REF}` })
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes(STAGING_REF)));
});

test("production: ref yanlış -> reddedilir", () => {
  const result = validateDeploymentEnv(baseProductionEnv({ OTOIZ_EXPECTED_SUPABASE_REF: STAGING_REF }));
  assert.equal(result.ok, false);
});

test("eksik rol (OTOIZ_DEPLOYMENT_ROLE tanımsız) -> reddedilir", () => {
  const env = baseStagingEnv();
  delete env.OTOIZ_DEPLOYMENT_ROLE;
  const result = validateDeploymentEnv(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("OTOIZ_DEPLOYMENT_ROLE")));
});

test("bilinmeyen rol (ör. 'development') -> reddedilir", () => {
  const result = validateDeploymentEnv(baseStagingEnv({ OTOIZ_DEPLOYMENT_ROLE: "development" }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("bilinmiyor")));
});

test("eksik NEXT_PUBLIC_SUPABASE_URL -> reddedilir", () => {
  const env = baseStagingEnv();
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  const result = validateDeploymentEnv(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("NEXT_PUBLIC_SUPABASE_URL")));
});

test("placeholder anon key (ör. 'changeme') -> reddedilir, içerik hata mesajında yazmaz", () => {
  const result = validateDeploymentEnv(baseStagingEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "changeme-please" }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")));
  assert.ok(!result.errors.some((e) => e.includes("changeme-please")), "hata mesajı anahtar İÇERİĞİNİ taşımamalı");
});

test("boş SUPABASE_SERVICE_ROLE_KEY -> reddedilir (eksik zorunlu değişken)", () => {
  const result = validateDeploymentEnv(baseStagingEnv({ SUPABASE_SERVICE_ROLE_KEY: "" }));
  assert.equal(result.ok, false);
});

test("JWT anahtara gömülü ref beklenenle uyuşmuyorsa reddedilir", () => {
  const result = validateDeploymentEnv(
    baseStagingEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ iss: "supabase", ref: PRODUCTION_REF, role: "anon" }) })
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("gömülü proje ref")));
});

test("opaque (yeni biçim, sb_publishable_/sb_secret_) anahtarlar biçim olarak kabul edilir", () => {
  const result = validateDeploymentEnv(
    baseStagingEnv({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_" + "a".repeat(20),
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_" + "b".repeat(20),
    })
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("CRON_SECRET çok kısa -> reddedilir", () => {
  const result = validateDeploymentEnv(baseStagingEnv({ CRON_SECRET: "kisa" }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("CRON_SECRET")));
});

test("yerel test modu: env tamamen boş olsa da geçer (yalnızca VERCEL algılanmadığında)", () => {
  const result = validateDeploymentEnv({ OTOIZ_ENV_CHECK_TEST_MODE: "1" });
  assert.equal(result.ok, true);
  assert.equal(result.testMode, true);
});

test("GÜVENLİK: VERCEL=1 iken OTOIZ_ENV_CHECK_TEST_MODE=1 bypass denemesi YOK SAYILIR, tam doğrulama çalışır ve eksik env ile BAŞARISIZ olur", () => {
  const result = validateDeploymentEnv({ VERCEL: "1", OTOIZ_ENV_CHECK_TEST_MODE: "1" });
  assert.equal(result.testMode, false, "VERCEL=1 iken test modu asla aktif olmamalı");
  assert.equal(result.ok, false);
  assert.ok(result.notices.some((n) => n.includes("YOK SAYILDI")));
});

test("GÜVENLİK: VERCEL=1 + bypass denemesi + aksi halde TAM GEÇERLİ staging env -> yine de normal kurallarla geçer (bypass'a ihtiyaç yok, kurallar zaten sağlanıyor)", () => {
  const env = baseStagingEnv({ VERCEL: "1", OTOIZ_ENV_CHECK_TEST_MODE: "1" });
  const result = validateDeploymentEnv(env);
  assert.equal(result.testMode, false);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

// 2026-09-23 staging olayı: Vercel'de değer alanına değişken ADI yapıştırıldı,
// build geçti, tüm girişler 401 ile kırıldı. Bu artık build'i durdurmalı.
test("anon key değeri değişken adının kendisiyse -> reddedilir", () => {
  const r = validateDeploymentEnv(baseStagingEnv({ VERCEL: "1", NEXT_PUBLIC_SUPABASE_ANON_KEY: "NEXT_PUBLIC_SUPABASE_ANON_KEY" }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")));
});

test("bilinmeyen biçimde uzun anahtar -> reddedilir", () => {
  const r = validateDeploymentEnv(baseStagingEnv({ VERCEL: "1", SUPABASE_SERVICE_ROLE_KEY: "abcdefghijklmnopqrstuvwxyz0123456789" }));
  assert.equal(r.ok, false);
});

test("anon ile service_role anahtarları yer değiştirmişse -> reddedilir", () => {
  const r = validateDeploymentEnv(baseStagingEnv({
    VERCEL: "1",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ iss: "supabase", ref: STAGING_REF, role: "service_role" }),
  }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("yanlış rolde")));
});

test("opaque sb_publishable_ / sb_secret_ anahtarlar doğru rolde -> kabul", () => {
  const r = validateDeploymentEnv(baseStagingEnv({
    VERCEL: "1",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_Ab12Cd34Ef56Gh78",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_Zy98Xw76Vu54Ts32",
  }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});
