import { test, expect, devices, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ — iPhone premium kurulum sihirbazı kabul testleri
// (components/IosInstallWizard.tsx). Cihazlar test içinde ayrı context
// olarak açılır; yalnız desktop-chromium projesinde çalışır. Supabase'e
// hiçbir gerçek istek gitmez. E2E_SCREENSHOT_DIR verilirse ekran görüntüsü alınır.

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "cihazlar test içinde açılıyor");
});

const SHOTS = process.env.E2E_SCREENSHOT_DIR || "";
const OWNER_ID = "c0c0c0c0-0000-4000-8000-000000000011";
const VEHICLE_ID = "c0c0c0c0-0000-4000-8000-000000000012";

const IPHONE: BrowserContextOptions = { ...devices["iPhone 13"] };
const IPHONE_SE: BrowserContextOptions = { ...devices["iPhone SE"] };
const IPHONE_MAX: BrowserContextOptions = { ...devices["iPhone 15 Pro Max"] };
const IPAD: BrowserContextOptions = { ...devices["iPad Mini"] };
const ANDROID: BrowserContextOptions = { ...devices["Pixel 7"] };
for (const d of [IPHONE, IPHONE_SE, IPHONE_MAX, IPAD, ANDROID]) delete (d as any).defaultBrowserType;
const IPHONE_320: BrowserContextOptions = { ...IPHONE_SE, viewport: { width: 320, height: 568 } };

const SAFARI_UA = IPHONE.userAgent as string;
const WEBVIEW_UA = SAFARI_UA.replace(/ Version\/[\d.]+/, "").replace(/ Safari\/[\d.]+/, "");
const IN_APP: { name: string; ua: string; app: string }[] = [
  { name: "Instagram", ua: `${WEBVIEW_UA} Instagram 350.0.0.0.0 (iPhone14,5; iOS 18_5; tr_TR)`, app: "Instagram" },
  { name: "Facebook", ua: `${WEBVIEW_UA} [FBAN/FBIOS;FBAV/480.0.0;FBBV/1;FBDV/iPhone14,5]`, app: "Facebook" },
  { name: "WhatsApp", ua: `${WEBVIEW_UA} WhatsApp/25.1.0`, app: "WhatsApp" },
  { name: "Google uygulaması", ua: SAFARI_UA.replace(/Version\/[\d.]+/, "GSA/350.0.0"), app: "Google" },
  { name: "Claude", ua: `${WEBVIEW_UA} Claude/1.0`, app: "Claude" },
  { name: "tanınmayan WKWebView", ua: WEBVIEW_UA, app: "Bu uygulama" },
];

const STANDALONE_INIT = `(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } } : orig(q));
})();`;
const IOS_STANDALONE_INIT = `Object.defineProperty(window.navigator, "standalone", { get: () => true });`;

async function open(browser: Browser, opts: BrowserContextOptions, baseURL: string, init?: string) {
  const context = await browser.newContext({ ...opts, baseURL });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  return { context, page };
}

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

// Sihirbazdaki görünür düğmelerin en küçük yüksekliği ≥ 44px; sihirbaz
// yatayda taşmaz.
async function sheetHealth(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="install-sheet-ios"]') as HTMLElement;
    const small: string[] = [];
    sheet.querySelectorAll("button").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && r.height < 44) small.push(`${b.textContent?.trim() || b.getAttribute("aria-label")} ${Math.round(r.height)}px`);
    });
    const sr = sheet.getBoundingClientRect();
    return {
      small,
      overflowX: sheet.scrollWidth > sheet.clientWidth + 1 || sr.right > window.innerWidth + 1 || sr.left < -1,
      bg: getComputedStyle(sheet).backgroundImage + " " + getComputedStyle(sheet).backgroundColor,
      anim: getComputedStyle(sheet).animationName + "|" + getComputedStyle(sheet).transitionDuration,
    };
  });
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe("iPhone kurulum sihirbazı — Safari", () => {
  for (const [label, opts] of [
    ["iPhone 13", IPHONE],
    ["iPhone SE", IPHONE_SE],
    ["iPhone 320", IPHONE_320],
    ["iPhone 15 Pro Max", IPHONE_MAX],
  ] as const) {
    test(`${label}: CTA "OTOİZ’İ iPHONE’A EKLE" → 3 adım; büyük numara, çizim, kısa metin; taşma yok; dokunma ≥ 44px`, async ({ browser, baseURL }) => {
      const { context, page } = await open(browser, opts, baseURL!);
      await page.goto("/bireysel/giris");
      const cta = page.getByTestId("install-cta");
      await expect(cta).toHaveAttribute("data-ios-browser", "safari");
      await expect(cta).toContainText("3 kısa adım");
      await expect(cta).not.toContainText("NASIL YAPILIR");
      const btn = cta.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE", exact: true });
      await expect(btn).toBeVisible();
      expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      const slug = label.replace(/\s+/g, "-").toLowerCase();
      await shot(page, `${slug}-0-cta`);
      await btn.click();

      const sheet = page.getByTestId("install-sheet-ios");
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("OTOİZ’i iPhone’a ekleyin");
      const expected = [
        ["Safari’nin Paylaş simgesine dokunun", "Alt çubuktaki Paylaş simgesine"],
        ["“Ana Ekrana Ekle”ye dokunun", "aşağı kaydırın"],
        ["Sağ üstte “Ekle”ye dokunun", "tek dokunuşla açılır"],
      ];
      for (let i = 0; i < 3; i++) {
        await expect(sheet).toHaveAttribute("data-screen", `step-${i + 1}`);
        await expect(sheet.getByRole("heading", { level: 2 })).toHaveText(expected[i][0]);
        await expect(sheet).toContainText(expected[i][1]);
        await expect(sheet).toContainText(`Adım ${i + 1} / 3`);
        const no = sheet.locator(".otoiz-iw-no");
        await expect(no).toHaveText(String(i + 1));
        const nb = (await no.boundingBox())!;
        expect(nb.height).toBeGreaterThanOrEqual(56);
        await expect(sheet.locator(".otoiz-iw-mock")).toBeVisible();
        await expect(sheet.locator(".otoiz-iw-dot-on")).toHaveCount(i + 1);
        const h = await sheetHealth(page);
        expect(h.small, `${label} adım ${i + 1}`).toEqual([]);
        expect(h.overflowX, `${label} adım ${i + 1}`).toBe(false);
        expect(h.bg).toMatch(/gradient|rgb\((1[0-9]|2[0-9]), /);
        expect(h.anim).toBe("none|0s");
        expect(await noHorizontalOverflow(page)).toBe(true);
        // Kısa ekranda da (320×568) ana eylem düğmesi kaydırmadan görünür.
        const vh = page.viewportSize()!.height;
        const primary = (await sheet.locator(".otoiz-iw-primary").boundingBox())!;
        expect(primary.y + primary.height, `${label} adım ${i + 1} düğme görünür`).toBeLessThanOrEqual(vh);
        await shot(page, `${slug}-${i + 1}-adim`);
        if (i < 2) {
          // Tek eylem: İleri; ilk adımda Geri yok.
          await expect(sheet.getByRole("button", { name: "Geri" })).toHaveCount(i === 0 ? 0 : 1);
          await sheet.getByRole("button", { name: "İleri" }).click();
        }
      }
      // Geri çalışır.
      await sheet.getByRole("button", { name: "Geri" }).click();
      await expect(sheet).toHaveAttribute("data-screen", "step-2");
      await sheet.getByRole("button", { name: "İleri" }).click();
      await expect(sheet.getByRole("button", { name: "Ekledim" })).toBeVisible();
      // Sihirbaz hiçbir aşamada "kuruldu" demez; kurulum yalnız kullanıcıyla olur.
      await expect(sheet).not.toContainText("Kuruldu");
      await context.close();
    });
  }

  test("iPhone: koyu premium zemin; Esc ve arka plana dokunma kapatır, odak butona döner; Şimdi değil gizler", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE, baseURL!);
    await page.goto("/bireysel/giris");
    const btn = page.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE" });
    await btn.click();
    const sheet = page.getByTestId("install-sheet-ios");
    const bg = await sheet.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("rgb(12, 14, 17)"); // --otoiz-anthracite-2 (premium: #0C0E11)
    await expect(page.getByRole("button", { name: "Kapat" })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(btn).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await btn.click();
    await page.mouse.click(195, 20); // arka plan
    await expect(sheet).toHaveCount(0);
    await btn.click();
    await sheet.getByRole("button", { name: "Şimdi değil" }).click();
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await context.close();
  });

  test("iPad: 'OTOİZ’İ iPAD’E EKLE', adres çubuğundaki Paylaş", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPAD, baseURL!);
    await page.goto("/bireysel/giris");
    await page.getByRole("button", { name: "OTOİZ’İ iPAD’E EKLE" }).click();
    const sheet = page.getByTestId("install-sheet-ios");
    await expect(sheet).toContainText("OTOİZ’i iPad’e ekleyin");
    await expect(sheet).toContainText("Adres çubuğunun sağındaki Paylaş");
    await shot(page, "ipad-1-adim");
    await context.close();
  });
});

test.describe("iPhone kurulum sihirbazı — Safari dışı", () => {
  for (const c of IN_APP) {
    test(`${c.name} uygulama içi tarayıcı: önce "Safari’de açın"; 3 adıma geçilmez; bağlantı kopyalanır`, async ({ browser, baseURL }) => {
      const { context, page } = await open(browser, { ...IPHONE, userAgent: c.ua }, baseURL!);
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
      await page.goto("/bireysel/giris");
      const cta = page.getByTestId("install-cta");
      await expect(cta).toHaveAttribute("data-ios-browser", "inapp");
      await expect(cta).toContainText("Ekleme Safari’de yapılır");
      await cta.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE" }).click();
      const sheet = page.getByTestId("install-sheet-ios");
      await expect(sheet).toHaveAttribute("data-screen", "safari");
      await expect(sheet.getByRole("heading", { level: 2 })).toHaveText("Önce Safari’de açın");
      await expect(sheet).toContainText(`${c.app}`);
      await expect(sheet).toContainText("ana ekrana ekleyemez");
      await expect(sheet.getByRole("button", { name: "İleri" })).toHaveCount(0);
      await expect(sheet.getByRole("button", { name: "Bu tarayıcıda devam et" })).toHaveCount(0);
      await expect(sheet).not.toContainText("Adım 1 / 3");
      const h = await sheetHealth(page);
      expect(h.small).toEqual([]);
      expect(h.overflowX).toBe(false);
      const pb = (await sheet.locator(".otoiz-iw-primary").boundingBox())!;
      expect(pb.y + pb.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      if (c.name === "Instagram") await shot(page, "inapp-instagram-safaride-ac");
      await sheet.getByRole("button", { name: "Bağlantıyı kopyala" }).click();
      await expect(sheet.getByRole("button", { name: "Bağlantı kopyalandı" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/bireysel/giris`);
      await context.close();
    });
  }

  test("iPhone Chrome: Safari önerisi + 'Bu tarayıcıda devam et' → adres çubuğundaki Paylaş", async ({ browser, baseURL }) => {
    const ua = SAFARI_UA.replace(/Version\/[\d.]+/, "CriOS/140.0.0.0");
    const { context, page } = await open(browser, { ...IPHONE, userAgent: ua }, baseURL!);
    await page.goto("/bireysel/giris");
    await expect(page.getByTestId("install-cta")).toHaveAttribute("data-ios-browser", "browser");
    await page.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE" }).click();
    const sheet = page.getByTestId("install-sheet-ios");
    await expect(sheet).toHaveAttribute("data-screen", "safari");
    await expect(sheet).toContainText("Chrome yerine Safari’de");
    await shot(page, "chrome-ios-safaride-ac");
    await sheet.getByRole("button", { name: "Bu tarayıcıda devam et" }).click();
    await expect(sheet).toHaveAttribute("data-screen", "step-1");
    await expect(sheet).toContainText("Adres çubuğunun sağındaki Paylaş");
    await sheet.getByRole("button", { name: "Safari’de açma" }).click();
    await expect(sheet).toHaveAttribute("data-screen", "safari");
    await context.close();
  });

  test("kopyalama izni yoksa kullanıcıya elle kopyalama söylenir (yanıltıcı 'kopyalandı' yok)", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, { ...IPHONE, userAgent: IN_APP[0].ua }, baseURL!);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { get: () => ({ writeText: () => Promise.reject(new Error("no")) }) });
      document.execCommand = () => false;
    });
    await page.goto("/bireysel/giris");
    await page.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE" }).click();
    const sheet = page.getByTestId("install-sheet-ios");
    await sheet.getByRole("button", { name: "Bağlantıyı kopyala" }).click();
    await expect(sheet).toContainText("Kopyalanamadı");
    await expect(sheet.getByRole("button", { name: "Bağlantı kopyalandı" })).toHaveCount(0);
    await context.close();
  });
});

test.describe("iPhone kurulum sihirbazı — kurulu (standalone) durum", () => {
  for (const [label, init] of [
    ["navigator.standalone", IOS_STANDALONE_INIT],
    ["display-mode: standalone", STANDALONE_INIT],
  ] as const) {
    test(`${label}: giriş ve ana ekranda CTA yok, sihirbaz açılamaz`, async ({ browser, baseURL }) => {
      const { context, page } = await open(browser, IPHONE, baseURL!, init);
      await page.goto("/bireysel/giris");
      await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("install-cta")).toHaveCount(0);
      await expect(page.getByTestId("install-sheet-ios")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /iPHONE’A EKLE/ })).toHaveCount(0);
      await installMockSession(context, { id: OWNER_ID, email: "iw.standalone@ornek.com" }, baseURL!);
      await mockSupabaseRest(page, {
        vehicles: {
          list: [{ id: VEHICLE_ID, plate: "34 IWS 001", brand: "Fiat", model: "Egea", year: 2021, current_km: 30000, next_service_km: 40000, next_service_date: "2027-01-01", owner_user_id: OWNER_ID, tenant_id: null }],
        },
      });
      await page.goto("/bireysel/araclar");
      await expect(page.getByText("34 IWS 001").first()).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("install-cta")).toHaveCount(0);
      await context.close();
    });
  }
});

test.describe("iPhone kurulum sihirbazı — mobil ana ekran ve regresyon", () => {
  test("bireysel ana ekran (iPhone): CTA görünür, sihirbaz açılır, 320px'te taşma yok", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, IPHONE_320, baseURL!);
    await installMockSession(context, { id: OWNER_ID, email: "iw.ana@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      vehicles: {
        list: [{ id: VEHICLE_ID, plate: "34 IWA 001", brand: "Renault", model: "Clio", year: 2020, current_km: 41200, next_service_km: 50000, next_service_date: "2027-03-01", owner_user_id: OWNER_ID, tenant_id: null }],
      },
    });
    await page.goto("/bireysel/araclar");
    await expect(page.getByText("34 IWA 001").first()).toBeVisible();
    const cta = page.getByTestId("install-cta").first();
    await expect(cta).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    await cta.getByRole("button", { name: "OTOİZ’İ iPHONE’A EKLE" }).click();
    await expect(page.getByTestId("install-sheet-ios")).toBeVisible();
    const h = await sheetHealth(page);
    expect(h.small).toEqual([]);
    expect(h.overflowX).toBe(false);
    await shot(page, "ana-ekran-320-sihirbaz");
    await context.close();
  });

  test("Android: CTA metni ve yerel yükleme akışı değişmedi, iPhone sihirbazı açılmaz", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, ANDROID, baseURL!);
    await page.goto("/bireysel/giris");
    const cta = page.getByTestId("install-cta");
    await expect(cta).toHaveAttribute("data-platform", "android");
    await expect(cta).not.toHaveAttribute("data-ios-browser", /.+/);
    await expect(cta.getByRole("button", { name: "OTOİZ'İ TELEFONA EKLE", exact: true })).toBeVisible();
    await cta.getByRole("button", { name: "OTOİZ'İ TELEFONA EKLE" }).click();
    const sheet = page.getByTestId("install-sheet-android");
    await expect(sheet.getByRole("heading", { name: "Android telefona ekle" })).toBeVisible();
    await expect(sheet).toContainText("Uygulamayı yükle");
    expect(await sheet.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(17, 19, 23)"); // premium: koyu kart yüzeyi #111317
    await expect(page.getByTestId("install-sheet-ios")).toHaveCount(0);
    await context.close();
  });

  test("masaüstünde CTA ve sihirbaz yok", async ({ browser, baseURL }) => {
    const { context, page } = await open(browser, { viewport: { width: 1440, height: 900 } }, baseURL!);
    await page.goto("/bireysel/giris");
    await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("install-cta")).toHaveCount(0);
    await context.close();
  });
});
