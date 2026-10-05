import { test, expect, devices, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ Aşama C — premium giriş kabuğu, PWA markalama ve "OTOİZ'İ TELEFONA
// EKLE" kabul testleri. Cihazlar test içinde ayrı context olarak açılır;
// yalnız desktop-chromium projesinde çalışır. Supabase'e hiçbir gerçek
// istek gitmez (playwright.config.ts: .invalid URL + route mock'ları).

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "cihazlar test içinde açılıyor");
});

const ANTHRACITE = "rgb(7, 8, 10)"; // premium (2026-10-05): #07080A
const OWNER_ID = "c0c0c0c0-0000-4000-8000-000000000001";
const VEHICLE_ID = "c0c0c0c0-0000-4000-8000-000000000002";

const IPHONE: BrowserContextOptions = { ...devices["iPhone 13"] };
const IPHONE_SE: BrowserContextOptions = { ...devices["iPhone SE"] };
const ANDROID: BrowserContextOptions = { ...devices["Pixel 7"] };
const TABLET: BrowserContextOptions = { ...devices["iPad Mini"] };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1440, height: 900 } };
for (const d of [IPHONE, IPHONE_SE, ANDROID, TABLET]) delete (d as any).defaultBrowserType;

async function open(browser: Browser, opts: BrowserContextOptions, baseURL: string, init?: string) {
  const context = await browser.newContext({ ...opts, baseURL });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  return { context, page };
}

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

// Görünür, etkileşimli öğelerin en küçük kenarı (px). Kart içindeki metin
// satırı bağlantıları hariç tüm düğme/bağlantı/alanlar ≥ 44 olmalı.
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("main a, main button, main input").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 44) out.push(`${el.tagName} "${(el.textContent || (el as HTMLInputElement).id || "").trim().slice(0, 40)}" ${Math.round(r.height)}px`);
    });
    return out;
  });
}

const AUTH_PAGES = [
  { path: "/bireysel/giris", heading: "Bireysel Giriş", role: "bireysel" },
  { path: "/panel/login", heading: "Servis / İşletme Girişi", role: "servis" },
  { path: "/yonetim", heading: "Yönetim Paneli", role: "yonetim" },
  { path: "/bireysel/kayit", heading: "Bireysel Kayıt", role: "bireysel" },
  { path: "/panel/kayit", heading: "İşletme Kaydı", role: "servis" },
  { path: "/hesap/sifremi-unuttum", heading: "Şifremi Unuttum", role: "hesap" },
  { path: "/hesap/sifre-guncelle?token_hash=abcdefghijklmnop1234&type=recovery", heading: "Şifre Sıfırlama", role: "hesap" },
  { path: "/hesap/dogrulandi#type=signup", heading: "E-postan doğrulandı", role: "bireysel" },
];

const VIEWPORTS = [
  { label: "iPhone SE 320", width: 320, height: 568 },
  { label: "Android 360", width: 360, height: 780 },
  { label: "iPhone 390", width: 390, height: 844 },
  { label: "iPhone Pro Max 430", width: 430, height: 932 },
  { label: "tablet 768", width: 768, height: 1024 },
  { label: "tablet yatay 1024", width: 1024, height: 768 },
  { label: "masaüstü 1440", width: 1440, height: 900 },
];

test.describe("Aşama C — premium giriş kabuğu", () => {
  for (const p of AUTH_PAGES) {
    test(`${p.path}: koyu antrasit kabuk, logo, kart; tüm genişliklerde taşma yok, dokunma alanı ≥ 44px`, async ({ browser, baseURL }) => {
      const { context, page } = await open(browser, DESKTOP, baseURL!);
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(p.path);
        await expect(page.getByRole("heading", { name: p.heading })).toBeVisible();
        const main = page.locator("main.otoiz-auth2");
        await expect(main).toHaveAttribute("data-auth-role", p.role);
        expect(await main.evaluate((el) => getComputedStyle(el).backgroundColor), vp.label).toBe(ANTHRACITE);
        await expect(page.locator('main img[alt="OTOİZ"]').first()).toBeVisible();
        await expect(page.locator(".otoiz-auth2-card")).toBeVisible();
        expect(await noHorizontalOverflow(page), `${p.path} @ ${vp.label}`).toBe(true);
        expect(await smallTargets(page), `${p.path} @ ${vp.label}`).toEqual([]);
        // Mobilde beyaz boşluk yok: sayfanın altı da koyu zemin.
        const bottomBg = await page.evaluate(() => {
          const el = document.elementFromPoint(4, window.innerHeight - 4) as HTMLElement | null;
          let n: HTMLElement | null = el;
          while (n && getComputedStyle(n).backgroundColor === "rgba(0, 0, 0, 0)") n = n.parentElement;
          return n ? getComputedStyle(n).backgroundColor : "";
        });
        expect(bottomBg, `${p.path} @ ${vp.label} alt kenar`).not.toBe("rgb(255, 255, 255)");
      }
      await context.close();
    });
  }

  test("klavye açılınca (görünür yükseklik 844 → 420) form bozulmuyor: kart yerinde, taşma yok, odaklı alan görünür", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.goto("/bireysel/giris");
    const card = page.locator(".otoiz-auth2-card");
    const before = await card.boundingBox();
    await page.locator("#bireysel-password").focus();
    await page.setViewportSize({ width: 390, height: 420 });
    await page.locator("#bireysel-password").scrollIntoViewIfNeeded();
    const after = await card.boundingBox();
    expect(Math.round(after!.width)).toBe(Math.round(before!.width));
    expect(await noHorizontalOverflow(page)).toBe(true);
    const box = await page.locator("#bireysel-password").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(420);
    await context.close();
  });
});

test.describe("Aşama C — PWA markalama", () => {
  test("manifest: OTOİZ adı, antrasit tema, any + maskable ikonlar gerçekten yükleniyor", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toBe("OTOİZ");
    expect(m.short_name).toBe("OTOİZ");
    expect(m.display).toBe("standalone");
    expect(m.id).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.start_url).toBe("/bireysel/araclar");
    expect(m.theme_color).toBe("#0F1115");
    expect(m.background_color).toBe("#0F1115");
    const purposes = m.icons.map((i: any) => `${i.sizes}:${i.purpose}`);
    expect(purposes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
    for (const icon of m.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toContain("image/png");
      const buf = await r.body();
      // PNG IHDR: genişlik/yükseklik 16. bayttan itibaren
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  test("eski anahtar simgesi ve önceki ikon dosyaları artık yok (404)", async ({ request }) => {
    for (const old of ["/icon-192.png", "/icon-512.png", "/icon-otoiz-192.png", "/icon-otoiz-512.png", "/favicon-otoiz-48.png"]) {
      expect((await request.get(old)).status(), old).toBe(404);
    }
  });

  test("head: manifest, favicon, apple-touch-icon, tema rengi, iOS başlığı ve açılış ekranları yükleniyor", async ({ browser, baseURL, request }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.goto("/bireysel/giris");
    expect(await page.locator('meta[name="theme-color"]').getAttribute("content")).toBe("#0F1115");
    expect(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute("content")).toBe("OTOİZ");
    expect(await page.locator('meta[name="application-name"]').getAttribute("content")).toBe("OTOİZ");
    expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toBe("/manifest.json");
    expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("viewport-fit=cover");
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"]')).map(
        (l) => (l as HTMLLinkElement).getAttribute("href")!
      )
    );
    expect(hrefs).toContain("/favicon.ico");
    expect(hrefs).toContain("/icons/otoiz-apple-touch-180.png");
    expect(hrefs.filter((h) => h.startsWith("/splash/")).length).toBe(14);
    for (const h of [...hrefs, "/apple-touch-icon.png"]) {
      expect((await request.get(h)).status(), h).toBe(200);
    }
    await context.close();
  });

  test("Chromium kurulabilirlik denetimi: manifest/ikon kaynaklı hata yok", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, ANDROID, baseURL!);
    await page.goto("/bireysel/giris");
    await page.waitForLoadState("networkidle");
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    const manifest = await cdp.send("Page.getAppManifest");
    expect(manifest.errors).toEqual([]);
    const ids = installabilityErrors.map((e: any) => e.errorId);
    // Headless ortamda "platform-not-supported-on-android" benzeri ortam
    // kaynaklı kimlikler dışında manifest/ikon hatası olmamalı.
    for (const bad of ["manifest-missing-suitable-icon", "manifest-missing-name-or-short-name", "manifest-display-not-supported", "start-url-not-valid", "manifest-empty", "no-icon-available", "cannot-download-icon", "no-acceptable-icon"]) {
      expect(ids).not.toContain(bad);
    }
    await context.close();
  });
});

const STANDALONE_INIT = `(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } } : orig(q));
})();`;
const IOS_STANDALONE_INIT = `Object.defineProperty(window.navigator, "standalone", { get: () => true });`;
const BIP_INIT = `(() => {
  window.__otoizPrompted = 0;
  window.addEventListener("load", () => {
    setTimeout(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      e.prompt = () => { window.__otoizPrompted++; return Promise.resolve(); };
      e.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
      window.dispatchEvent(e);
    }, 50);
  });
})();`;

test.describe("Aşama C — OTOİZ'İ TELEFONA EKLE", () => {
  test("iPhone: CTA büyük ve görünür, 3 adımlı sihirbaz; 'Ekledim' sonrası bir daha görünmez", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.goto("/bireysel/giris");
    const cta = page.getByTestId("install-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("data-platform", "ios");
    const btn = cta.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE", exact: true });
    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await btn.click();
    const sheet = page.getByTestId("install-sheet-ios");
    await expect(sheet).toContainText("OTOİZ’i iPhone’a ekleyin");
    await expect(sheet).toContainText("Paylaş");
    await sheet.getByRole("button", { name: "İleri" }).click();
    await expect(sheet).toContainText("Ana Ekrana Ekle");
    await sheet.getByRole("button", { name: "İleri" }).click();
    await sheet.getByRole("button", { name: "Ekledim" }).click();
    await expect(cta).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await context.close();
  });

  test("iPhone Chrome: önce Safari'de açma ekranı gösterilir", async ({ browser, baseURL }) => {
    const ua = (IPHONE.userAgent as string).replace(/Version\/[\d.]+/, "CriOS/129.0.0.0");
    expect(ua).toContain("CriOS");
    const { context, page } = await open(browser, { ...IPHONE, userAgent: ua }, baseURL!);
    await page.goto("/bireysel/giris");
    await page.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE" }).click();
    await expect(page.getByTestId("install-sheet-ios")).toContainText("Safari");
    await context.close();
  });

  test("Android: tarayıcı yükleme penceresi hazırsa doğrudan açılır, kabul edilince CTA kalıcı olarak gizlenir", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, ANDROID, baseURL!, BIP_INIT);
    await page.goto("/bireysel/giris");
    const cta = page.getByTestId("install-cta");
    await expect(cta).toHaveAttribute("data-platform", "android");
    await expect(cta.getByRole("button", { name: "OTOİZ'İ TELEFONA EKLE", exact: true })).toBeVisible();
    await expect(cta).not.toContainText("NASIL YAPILIR");
    await page.waitForFunction(() => true);
    await page.waitForTimeout(200);
    await cta.getByRole("button", { name: "OTOİZ'İ TELEFONA EKLE" }).click();
    await expect(cta).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__otoizPrompted)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("otoiz-pwa-installed"))).toBe("1");
    await expect(page.getByTestId("install-sheet-android")).toHaveCount(0);
    await context.close();
  });

  test("Android: yükleme penceresi yoksa menü → Ana ekrana ekle yönergesi", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, ANDROID, baseURL!);
    await page.goto("/bireysel/giris");
    await page.getByRole("button", { name: "OTOİZ'İ TELEFONA EKLE" }).click();
    const sheet = page.getByTestId("install-sheet-android");
    await expect(sheet.getByRole("heading", { name: "Android telefona ekle" })).toBeVisible();
    await expect(sheet).toContainText("Ana ekrana ekle");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("install-cta")).toBeVisible();
    await context.close();
  });

  test("appinstalled olayından sonra CTA gizlenir", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, ANDROID, baseURL!);
    await page.goto("/bireysel/giris");
    await expect(page.getByTestId("install-cta")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await context.close();
  });

  test("kurulu uygulamada (display-mode: standalone / iOS standalone) CTA hiç görünmez", async ({ browser, baseURL }) => {
    for (const [opts, init] of [
      [ANDROID, STANDALONE_INIT],
      [IPHONE, IOS_STANDALONE_INIT],
    ] as const) {
      const { context, page } = await open(browser, opts, baseURL!, init);
      await page.goto("/bireysel/giris");
      await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("install-cta")).toHaveCount(0);
      await context.close();
    }
  });

  test("'Şimdi değil' CTA'yı gizler ve yeniden yüklemede de gizli kalır", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.goto("/bireysel/giris");
    await page.getByTestId("install-cta").getByRole("button", { name: "Şimdi değil" }).click();
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await context.close();
  });

  test("masaüstünde CTA gösterilmez; servis ve yönetim girişlerinde CTA yok", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, DESKTOP, baseURL!);
    await page.goto("/bireysel/giris");
    await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await context.close();
    const m = await open(browser, IPHONE, baseURL!);
    for (const path of ["/panel/login", "/yonetim"]) {
      await m.page.goto(path);
      await expect(m.page.locator(".otoiz-auth2-card")).toBeVisible();
      await expect(m.page.getByTestId("install-cta")).toHaveCount(0);
    }
    await m.context.close();
  });

  test("bireysel ana ekranda CTA görünür; başlık düğmeleri ≥ 44px; 320px'te taşma yok", async ({ browser, baseURL }) => {
    for (const opts of [IPHONE, IPHONE_SE, ANDROID, TABLET]) {
      const { context, page } = await open(browser, opts, baseURL!);
      await installMockSession(context, { id: OWNER_ID, email: "asama.c@ornek.com" }, baseURL!);
      await mockSupabaseRest(page, {
        vehicles: {
          list: [{ id: VEHICLE_ID, plate: "34 OTZ 001", brand: "Renault", model: "Clio", year: 2020, current_km: 41200, next_service_km: 50000, next_service_date: "2027-03-01", owner_user_id: OWNER_ID, tenant_id: null }],
        },
      });
      await page.goto("/bireysel/araclar");
      await expect(page.getByText("34 OTZ 001").first()).toBeVisible();
      await expect(page.getByTestId("install-cta")).toBeVisible();
      for (const name of ["Bildirimler", "Profil"]) {
        const b = await page.locator(`button[aria-label="${name}"]`).boundingBox();
        expect(b!.height, name).toBeGreaterThanOrEqual(44);
      }
      expect(await noHorizontalOverflow(page)).toBe(true);
      await page.setViewportSize({ width: 320, height: 640 });
      expect(await noHorizontalOverflow(page)).toBe(true);
      await context.close();
    }
  });
});

test.describe("Aşama C — auth akışlarında regresyon yok (ağ mock'lu)", () => {
  test("bireysel giriş: yanlış şifre Türkçe hata; doğru giriş /bireysel/araclar", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    let body: any = null;
    let ok = false;
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      body = route.request().postDataJSON();
      if (!ok) return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials" }) });
      const { buildMockSession } = await import("./fixtures/mockAuth");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildMockSession({ id: OWNER_ID, email: "a@ornek.com" })) });
    });
    await mockSupabaseRest(page, { vehicles: { list: [] } });
    await page.goto("/bireysel/giris");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.getByText("E-posta zorunlu.")).toBeVisible();
    await page.locator("#bireysel-email").fill("a@ornek.com");
    await page.locator("#bireysel-password").fill("yanlis-sifre");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.getByText("E-posta veya şifre hatalı.", { exact: false })).toBeVisible();
    expect(body).toMatchObject({ email: "a@ornek.com", password: "yanlis-sifre" });
    ok = true;
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page).toHaveURL(/\/bireysel\/araclar$/);
    await context.close();
  });

  test("bireysel giriş: doğrulanmamış e-posta → yeniden gönder düğmesi", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.route("**/auth/v1/token?grant_type=password", (route) =>
      route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error_code: "email_not_confirmed", msg: "Email not confirmed" }) })
    );
    await page.goto("/bireysel/giris");
    await page.locator("#bireysel-email").fill("b@ornek.com");
    await page.locator("#bireysel-password").fill("Sifre12345");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.getByText("E-posta adresin henüz doğrulanmadı", { exact: false })).toBeVisible();
    await expect(page.getByTestId("resend-confirmation")).toBeVisible();
    await context.close();
  });

  test("servis girişi: başarılı giriş /panel/dashboard", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, ANDROID, baseURL!);
    const { buildMockSession } = await import("./fixtures/mockAuth");
    await page.route("**/auth/v1/token?grant_type=password", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildMockSession({ id: OWNER_ID, email: "s@ornek.com" })) })
    );
    await mockSupabaseRest(page, {});
    await page.goto("/panel/login");
    await page.locator("#panel-email").fill("s@ornek.com");
    await page.locator("#panel-password").fill("Sifre12345");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page).toHaveURL(/\/panel\/dashboard/);
    await context.close();
  });

  test("yönetim girişi: yetkisiz hesap 'erişim yetkisi yok' görür", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, DESKTOP, baseURL!);
    const { buildMockSession } = await import("./fixtures/mockAuth");
    await page.route("**/auth/v1/token?grant_type=password", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildMockSession({ id: OWNER_ID, email: "y@ornek.com" })) })
    );
    await page.route("**/api/admin/me", (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "forbidden" }) }));
    await page.goto("/yonetim");
    await page.locator("#adm-email").fill("y@ornek.com");
    await page.locator("#adm-pass").fill("Sifre12345");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.getByText("Bu hesabın yönetim paneline erişim yetkisi yok.")).toBeVisible();
    await expect(page.locator("main.otoiz-auth2")).toHaveAttribute("data-auth-role", "yonetim");
    await context.close();
  });

  test("kayıt → 'E-postanı kontrol et'; şifremi unuttum → 'E-posta Gönderildi'", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    let kayit: any = null;
    await page.route("**/api/bireysel-kayit", (route) => {
      kayit = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    let recover: any = null;
    await page.route("**/auth/v1/recover**", (route) => {
      recover = { url: route.request().url(), body: route.request().postDataJSON() };
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("/bireysel/kayit");
    await page.locator("#kayit-ad").fill("Test Kişi");
    await page.locator("#kayit-email").fill("Kayit@Ornek.com");
    await expect(page.locator("#kayit-sifre")).toHaveCount(0);
    await page.getByRole("button", { name: "Hesap Oluştur" }).click();
    await expect(page.getByTestId("check-email")).toBeVisible();
    await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
    expect(kayit).toMatchObject({ full_name: "Test Kişi", email: "Kayit@Ornek.com", next: "/bireysel/araclar" });
    expect(kayit.password).toBeUndefined();

    await page.goto("/hesap/sifremi-unuttum");
    await page.locator("#reset-email").fill("r@ornek.com");
    await page.getByRole("button", { name: "Sıfırlama Bağlantısı Gönder" }).click();
    await expect(page.getByRole("heading", { name: "E-posta Gönderildi" })).toBeVisible();
    expect(recover.body.email).toBe("r@ornek.com");
    expect(decodeURIComponent(recover.url)).toContain("/hesap/sifre-guncelle");
    await context.close();
  });

  test("şifre sıfırlama bağlantısı: Devam et → yeni şifre → 'Şifreniz Güncellendi'; geçersiz bağlantı mesajı", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    const { buildMockSession } = await import("./fixtures/mockAuth");
    let verify: any = null;
    let update: any = null;
    await page.route("**/auth/v1/verify", (route) => {
      verify = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildMockSession({ id: OWNER_ID, email: "r@ornek.com" })) });
    });
    await page.route("**/auth/v1/user", (route) => {
      update = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildMockSession({ id: OWNER_ID, email: "r@ornek.com" }).user) });
    });
    await page.goto("/hesap/sifre-guncelle?token_hash=abcdefghijklmnop1234&type=recovery");
    await page.getByTestId("recovery-continue").click();
    await expect(page.getByRole("heading", { name: "Yeni Şifre Belirle" })).toBeVisible();
    expect(verify).toMatchObject({ token_hash: "abcdefghijklmnop1234", type: "recovery" });
    expect(page.url()).not.toContain("token_hash");
    await page.locator("#new-password").fill("YeniSifre123");
    await page.locator("#confirm-password").fill("YeniSifre124");
    await page.getByRole("button", { name: "Şifreyi Güncelle" }).click();
    await expect(page.getByText("Şifreler eşleşmiyor.")).toBeVisible();
    await page.locator("#confirm-password").fill("YeniSifre123");
    await page.getByRole("button", { name: "Şifreyi Güncelle" }).click();
    await expect(page.getByRole("heading", { name: "Şifreniz Güncellendi" })).toBeVisible();
    expect(update).toMatchObject({ password: "YeniSifre123" });

    await page.goto("/hesap/sifre-guncelle?token_hash=x&type=recovery");
    await expect(page.getByRole("heading", { name: "Bağlantı Geçersiz veya Süresi Dolmuş" })).toBeVisible();
    await context.close();
  });

  test("e-posta doğrulama dönüşü: başarı → Giriş yap (next korunur), hata → yeniden gönder; token adres çubuğundan silinir", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.goto("/hesap/dogrulandi?next=%2Faktivasyon%3Fk%3D1#access_token=gizli&type=signup");
    await expect(page.getByTestId("confirm-ok")).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/bireysel/giris?next=%2Faktivasyon%3Fk%3D1");
    expect(page.url()).not.toContain("access_token");
    await page.goto("/hesap/dogrulandi#error=access_denied&error_code=otp_expired");
    await expect(page.getByTestId("confirm-error")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bağlantı geçersiz veya süresi dolmuş" })).toBeVisible();
    await expect(page.getByTestId("resend-confirmation")).toBeVisible();
    await context.close();
  });
});
