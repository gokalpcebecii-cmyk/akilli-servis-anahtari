// Aşama C.1 — landing sayfasının gerçek ürünle senkronizasyonu.
// Metinler (hero, fayda kartları, nasıl çalışır, bireysel/kurumsal), NFC ve
// ispatlanamayan vaatlerin kaldırılması, fayda kaydırıcısı (swipe + oklar +
// aktif nokta), CTA hedefleri ve yatay taşma kontrolü.
import { test, expect, type Page } from "@playwright/test";

const FORBIDDEN = [/NFC/i, /temassız/i, /Daha Yüksek/i, /ikinci el değeri/i, /Otomobiliniz/i, /logonuz/i, /15–20 saniye/, /Değer Katar/, /Sürdürülebilir/];

async function bodyText(page: Page) {
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
}

test.describe("Aşama C.1 landing", () => {
  test("hero metni ve alt metin güncel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Aracınız için");
    await expect(page.locator("h1")).toContainText("servis pasaportu");
    const text = await bodyText(page);
    expect(text).toContain("Bakım geçmişi, servis kayıtları ve yaklaşan işlemler tek yerde.");
    expect(text).toContain("OTOİZ ile aracınızın geçmişini düzenli, güvenli ve erişilebilir tutun.");
  });

  test("NFC ve ispat gerektiren vaatler yok", async ({ page }) => {
    await page.goto("/");
    const text = await bodyText(page);
    for (const re of FORBIDDEN) expect(text, String(re)).not.toMatch(re);
    // Görünmeyen (display:none) varyantlar da dahil tüm DOM metni
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
    await expect(page.locator("#kurumsal a", { hasText: "İşletme Kaydı" })).toHaveAttribute("href", "/panel/kayit");
    await expect(page.locator("#kurumsal a", { hasText: "İşletme Girişi" })).toHaveAttribute("href", "/panel/login");
    await expect(page.locator("#bireysel a", { hasText: "Bireysel Kayıt" })).toHaveAttribute("href", "/bireysel/kayit");
    await expect(page.locator("#bireysel a", { hasText: "Bireysel Giriş" })).toHaveAttribute("href", "/bireysel/giris");
    const kurumsal = await page.locator("#kurumsal").innerText();
    expect(kurumsal).toContain("servis doğrulamalı");
    expect(kurumsal).toContain("veriler servisler arasında ayrıdır");
  });

  test("hero CTA giriş seçimine gider", async ({ page }, ti) => {
    await page.goto("/");
    const name = ti.project.name === "mobile-390" ? "Ücretsiz Başlayın" : "Hemen Başla";
    await page.getByRole("button", { name }).first().click();
    await expect(page).toHaveURL(/\/giris$/);
    await expect(page.getByRole("heading", { name: "Nasıl devam etmek istersiniz?" })).toBeVisible();
  });
});

test.describe("Aşama C.1 fayda kaydırıcısı (mobil)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1040, "yalnızca mobil/tablet");

  test("oklar ve noktalar aktif kartı değiştirir", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", { name: "OTOİZ faydaları" });
    await expect(carousel).toBeVisible();
    await expect(carousel.getByRole("group")).toHaveCount(5);
    const prev = carousel.getByRole("button", { name: "Önceki kart" });
    const next = carousel.getByRole("button", { name: "Sonraki kart" });
    const dots = carousel.locator(".otoiz-benefit-dot");
    await expect(prev).toBeDisabled();
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");

    await next.click();
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    const track = page.getByTestId("benefit-track");
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
    await expect(prev).toBeEnabled();

    await dots.nth(4).click();
    await expect(dots.nth(4)).toHaveAttribute("aria-current", "true");
    await expect(next).toBeDisabled();

    await prev.click();
    await expect(dots.nth(3)).toHaveAttribute("aria-current", "true");
  });

  test("parmakla kaydırma (touch swipe) çalışır", async ({ page }) => {
    await page.goto("/");
    const track = page.getByTestId("benefit-track");
    await track.scrollIntoViewIfNeeded();
    const box = (await track.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.85;
    const endX = box.x + box.width * 0.1;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startX + ((endX - startX) * i) / 10, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
    await expect(page.locator(".otoiz-benefit-dot").nth(0)).not.toHaveAttribute("aria-current", "true");
  });
});

test.describe("Aşama C.1 desktop", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1040, "yalnızca desktop");

  test("5 fayda aynı anda görünür, kaydırıcı gizli", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "OTOİZ faydaları" })).toBeHidden();
    const col = page.locator(".otoiz-hero-benefits-desktop");
    for (const t of [
      "Bakım geçmişiniz tek yerde",
      "Servis doğrulamalı kayıtlar",
      "QR ile hızlı erişim",
      "Araç devrinde teknik geçmiş korunur",
      "Düzenli ve şeffaf araç geçmişi",
    ]) {
      await expect(col.getByText(t, { exact: true })).toBeVisible();
    }
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
        const sel = ".otoiz-hero-text h1, .otoiz-hero-text p, .otoiz-hero-cta-mobile button, .otoiz-hero-cta-desktop button, .otoiz-benefit-controls, #kurumsal, #bireysel";
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
