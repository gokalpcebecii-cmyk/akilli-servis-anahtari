// OTOİZ — Playwright-ONLY görsel QA fixture'ı.
//
// Bu dosya production kodunu HİÇBİR ŞEKİLDE değiştirmez, yeni bir route
// eklemez ve production bundle'a girmez (e2e/ dışına asla import edilmez).
// Amaç: gerçek React ekranlarını (gerçek component kodu, gerçek Supabase
// client çağrıları) mock veriyle render edip screenshot almak.
//
// Yöntem:
//  1) @supabase/ssr'nin browser istemcisi oturumu bir çerezde tutar
//     (varsayılan anahtar: `sb-<project-ref>-auth-token`, değer
//     `base64-` önekli base64url JSON). Bu çerezi Playwright browser
//     context'ine EKLEYEREK supabase-js'in kendi `getSession()`'ının
//     (ağ isteği yapmadan, yalnızca yerel expiry kontrolüyle) sahte ama
//     biçimce geçerli bir oturumu kabul etmesini sağlıyoruz.
//  2) O oturumdaki access_token gerçek değildir / imzalanmamıştır — hiçbir
//     zaman gerçek Supabase sunucusuna ulaşmaz, çünkü aynı testte
//     `page.route("**/rest/v1/**", ...)` ile TÜM PostgREST/RPC istekleri
//     tarayıcı seviyesinde yakalanıp mock JSON ile yanıtlanır. Gerçek
//     Supabase projesine bu sahte token'la hiçbir istek gitmez.
//  3) Bu, yalnızca Playwright'ın kontrol ettiği tarayıcı sekmesi içinde
//     geçerlidir; runtime/RLS/production security modeli hiçbir şekilde
//     değişmez, gerçek bir auth bypass oluşturulmaz.
//
// Bilinen sınırlama: Next.js Server Component'lerin (ör. /p/[code] genel
// pasaport sayfası) sunucu tarafında yaptığı fetch'ler, Playwright'ın
// tarayıcı ağ katmanı DIŞINDADIR ve bu fixture ile yakalanamaz. Bu sayfalar
// için mock veri üretilmedi (bkz. final rapor).

import type { BrowserContext, Page } from "@playwright/test";

// 04A-S: gerçek Production ref'i yerine, playwright.config.ts'nin
// NEXT_PUBLIC_SUPABASE_URL'sindeki (https://otoiz-e2e-test.supabase.invalid)
// ilk hostname etiketiyle birebir eşleşen sahte bir test ref'i kullanılıyor.
// Depolama anahtarı adı @supabase/supabase-js'in kendi varsayılan türetme
// mantığıyla (`sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
// bkz. node_modules/@supabase/supabase-js/src/SupabaseClient.ts) birebir
// hesaplanır — bu yüzden URL değişirse bu sabit de değişmelidir.
const SUPABASE_PROJECT_REF = "otoiz-e2e-test";
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fakeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  // İmza kısmı kasıtlı olarak geçersiz/rastgele — bu token gerçek Supabase
  // sunucusuna asla gönderilmez (bkz. dosya başı açıklaması).
  return `${header}.${body}.mock-signature-not-real`;
}

export interface MockUser {
  id: string;
  email: string;
}

export function buildMockSession(user: MockUser) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const farFuture = nowSeconds + 60 * 60 * 24 * 365 * 5; // 5 yıl sonra — test süresince asla expire olmaz
  const accessToken = fakeJwt({ sub: user.id, email: user.email, role: "authenticated", exp: farFuture });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365 * 5,
    expires_at: farFuture,
    refresh_token: "mock-refresh-token-not-real",
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

// Playwright browser context'ine, @supabase/ssr'nin kendi çerez okuma
// mantığıyla (base64- önekli base64url JSON) uyumlu bir sahte oturum çerezi
// ekler. Yalnızca test ortamındaki context'e uygulanır.
export async function installMockSession(context: BrowserContext, user: MockUser, baseURL: string) {
  const session = buildMockSession(user);
  const value = "base64-" + base64url(JSON.stringify(session));
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: STORAGE_KEY,
      value,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

type RestHandler = { single?: unknown; list?: unknown[]; raw?: unknown };

// TÜM /rest/v1/* (PostgREST + RPC) isteklerini tarayıcı seviyesinde yakalar
// ve tabloya göre mock JSON döner. Gerçek Supabase projesine bu testte HİÇ
// istek gitmez. Eşleşmeyen bir tabloya rastlarsa boş sonuç döner (sayfayı
// kırmamak için) ve konsola uyarı yazar.
export async function mockSupabaseRest(page: Page, handlers: Record<string, RestHandler>) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const afterRest = url.pathname.split("/rest/v1/")[1] ?? "";
    const table = afterRest.split("?")[0];
    const accept = route.request().headers()["accept"] ?? "";
    const wantsSingle = accept.includes("vnd.pgrst.object");

    const handler = handlers[table];
    if (!handler) {
      // eslint-disable-next-line no-console
      console.warn(`[mockSupabaseRest] eşleşmeyen tablo/rpc: ${table} — boş sonuç dönülüyor`);
      await route.fulfill({ status: 200, contentType: "application/json", body: wantsSingle ? "null" : "[]" });
      return;
    }

    // "raw": PostgREST, SETOF olmayan (tekil JSON/skaler döndüren) RPC
    // fonksiyonlarının sonucunu diziye SARMAZ — supabase-js da bu durumda
    // .single() kullanmadığı için Accept header'ı "vnd.pgrst.object" olmaz.
    // Bu yüzden get_public_vehicle_passport gibi RPC'ler için wantsSingle/
    // list ayrımına girmeden doğrudan nesneyi döndürüyoruz.
    if ("raw" in handler) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(handler.raw) });
      return;
    }

    if (wantsSingle) {
      await route.fulfill({
        status: handler.single ? 200 : 406,
        contentType: "application/json",
        body: JSON.stringify(handler.single ?? null),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(handler.list ?? (handler.single ? [handler.single] : [])),
    });
  });
}
