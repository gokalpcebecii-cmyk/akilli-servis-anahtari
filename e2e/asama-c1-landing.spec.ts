// Aşama C.1 — landing sayfasının gerçek ürünle senkronizasyonu.
// Metinler (hero, fayda kartları, nasıl çalışır, bireysel/kurumsal), NFC ve
// ispatlanamayan vaatlerin kaldırılması, fayda kaydırıcısı (swipe + oklar +
// aktif nokta), CTA hedefleri ve yatay taşma kontrolü.
import { test, expect, type Page } from "@playwright/test";

const FORBIDDEN = [/NFC/i, /temassız/i, /Daha Yüksek/i, /ikinci el değeri/i, /Otomobiliniz/i, /logonuz/i, /15–20 saniye/, /Değer Katar/, /Sürdürülebilir/];

async function bodyText(page: Page) {
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
}

// OTOİZ Premium (2026-10-05): landing onaylı referans görsele göre yenilendi
// (hero + iki CTA + 4 ikonlu değer + "her zaman yanınızda" kartı). Fayda
// kaydırıcısı ve kurumsal/bireysel bölümleri bu tasarımda yok; içerik
// doğruluğu (yasak vaatler, gerçek 6 adımlı akış, CTA hedefleri) korunur.
test.describe("Aşama C.1 landing", () => {
  test("hero metni ve alt metin güncel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Aracınızın geçmişi kaybolmaz.");
    const text = await bodyText(page);
    expect(text).toContain("Bakımlar, belgeler ve araç geçmişi tek yerde.");
    expect(text).toContain("Aracınızın tüm geçmişi her zaman yanınızda.");
  });

  test("NFC ve ispat gerektiren vaatler yok", async ({ page }) => {
    await page.goto("/");
    const text = await bodyText(page);
    for (const re of FORBIDDEN) expect(text, String(re)).not.toMatch(re);
    const all = await page.locator("main").evaluate((el) => el.textContent || "");
    for (const re of FORBIDDEN) expect(all, String(re)).not.toMatch(re);
  });

  test("giriş seçimi ekranında NFC yok", async ({ page }) => {
    await page.goto("/giris");
    const all = await page.locator("body").evaluate((el) => el.textContent || "");
    expect(all).not.toMatch(/NFC/);
  });

  test("Nasıl Çalışır: gerçek bireysel akış, 6 adım sırayla", async ({ page }) => {
    await page.goto("/");
    const titles = await page.locator("#nasil-calisir h3").allInnerTexts();
    expect(titles).toEqual([
      "QR'ı okutun",
      "Giriş yapın veya kayıt olun",
      "E-postanızı doğrulayın",
      "Aktivasyon kodunu girin",
      "Aracınızı seçin veya ekleyin",
      "OTOİZ'i kullanmaya başlayın",
    ]);
  });

  test("kurumsal ve bireysel CTA hedefleri", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-bireysel")).toHaveAttribute("href", "/bireysel/giris");
    await expect(page.getByTestId("landing-servis")).toHaveAttribute("href", "/panel/login");
    await expect(page.locator("footer a", { hasText: "İşletme Kaydı" })).toHaveAttribute("href", "/panel/kayit");
    await expect(page.locator("footer a", { hasText: "Bireysel Kayıt" })).toHaveAttribute("href", "/bireysel/kayit");
  });

  test("4 değer ikonu görünür", async ({ page }) => {
    await page.goto("/");
    for (const t of ["Bakım Geçmişi", "Belgeler", "Yaklaşan Bakımlar", "Güvenli Devir"]) {
      await expect(page.getByRole("heading", { name: t, exact: true })).toBeVisible();
    }
  });

  test("üstteki giriş düğmesi giriş seçimine gider", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Giriş Yap" }).click();
    await expect(page).toHaveURL(/\/giris$/);
    await expect(page.getByTestId("giris-bireysel")).toBeVisible();
  });
});

test.describe("Aşama C.1 yatay taşma yok", () => {
  for (const w of [320, 360, 390, 412, 768, 1024, 1280, 1440]) {
    test(`genişlik ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // <main> overflow-x:hidden olduğu için sayfa kaydırılmaz ama içerik
      // kırpılabilir: hero başlığı, alt metin ve görünür CTA'lar ekran
      // içinde kalmalı.
      const clipped = await page.evaluate((vw) => {
        const sel = ".oz-land-title, .oz-land-sub, .oz-cta, .oz-feats, .oz-promo";
        return Array.from(document.querySelectorAll(sel))
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < -1 || r.right > vw + 1;
          })
          .map((el) => el.className || el.tagName);
      }, w);
      expect(clipped).toEqual([]);
    });
  }
});
