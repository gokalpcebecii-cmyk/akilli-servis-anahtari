import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("hero, CTA'lar ve marka doğru render ediliyor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /tüm geçmişi/i })).toBeVisible();
    await expect(page.getByText("OTO", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Ücretsiz Başlayın/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Giriş Yap" })).toBeVisible();
  });

  test("sayfada yatay taşma yok (masaüstü)", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});

test.describe("Giriş seçim modalı", () => {
  test("Giriş Yap tıklanınca modal açılır, başlık/alt metin doğru", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Nasıl devam etmek istersiniz?")).toBeVisible();
    await expect(page.getByText("Size uygun giriş türünü seçin.")).toBeVisible();
  });

  test("iki kart da doğru CTA ve hedeflere sahip", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    await expect(page.getByText("Bireysel Kullanıcı")).toBeVisible();
    await expect(page.getByText("Servis / İşletme")).toBeVisible();

    const bireyselLink = page.getByRole("link", { name: "Bireysel Giriş" });
    await expect(bireyselLink).toHaveAttribute("href", "/bireysel/giris");

    const kurumsalLink = page.getByRole("link", { name: "Kurumsal Giriş" });
    await expect(kurumsalLink).toHaveAttribute("href", "/panel/login");

    const bireyselKayit = page.getByRole("link", { name: "Kayıt Ol" });
    await expect(bireyselKayit).toHaveAttribute("href", "/bireysel/kayit");

    const kurumsalKayit = page.getByRole("link", { name: "İşletme hesabı oluştur" });
    await expect(kurumsalKayit).toHaveAttribute("href", "/panel/kayit");
  });

  test("Ücretsiz Başlayın da aynı modalı açar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Ücretsiz Başlayın/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("X butonu ile kapanır", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Kapat" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("ESC ile kapanır ve odak tetikleyiciye döner", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Giriş Yap" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("dışarı tıklayınca kapanır", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // backdrop'un en dışına, kartın kesinlikle dışında bir noktaya tıkla
    await page.mouse.click(5, 5);
    await expect(dialog).not.toBeVisible();
  });

  test("açıldığında ilk odak kapat butonuna gelir", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.getByRole("button", { name: "Kapat" })).toBeFocused();
  });

  test("modal aria-modal ve dialog rolüne sahip", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

test.describe("Mobil (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("homepage'de yatay taşma yok", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("modal alt sayfa (bottom-sheet) olarak açılır ve taşmaz", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("kartlar mobilde tek sütun ve dokunulabilir", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Bottom-sheet'in 0.24s'lik slide-up animasyonu bitene kadar bekle;
    // aksi halde boundingBox() geçiş karesinde ölçüm yapıp kararsız sonuç verebilir.
    await page.waitForTimeout(350);
    const bireyselLink = page.getByRole("link", { name: "Bireysel Giriş" });
    await expect(bireyselLink).toBeVisible();
    await bireyselLink.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await bireyselLink.boundingBox())?.height ?? 0, {
      timeout: 5000,
    }).toBeGreaterThanOrEqual(40);
  });
});

test.describe("Bireysel giriş sayfası", () => {
  test("form alanları ve çerçeveleme metni doğru", async ({ page }) => {
    await page.goto("/bireysel/giris");
    await expect(page.getByRole("heading", { name: "Bireysel Giriş" })).toBeVisible();
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await expect(page.getByLabel("Şifre")).toBeVisible();
    await expect(page.getByRole("button", { name: "Giriş Yap" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kayıt olun" })).toHaveAttribute("href", "/bireysel/kayit");
  });

  test("boş şifre ile yanlış giriş denemesi anlaşılır hata gösterir", async ({ page }) => {
    await page.goto("/bireysel/giris");
    await page.getByLabel("E-posta").fill("olmayan-test-kullanicisi@example.invalid");
    await page.getByLabel("Şifre").fill("yanlis-sifre-123");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("hatalı", { timeout: 15000 });
  });
});

test.describe("Servis / İşletme giriş sayfası", () => {
  test("form alanları ve çerçeveleme metni doğru", async ({ page }) => {
    await page.goto("/panel/login");
    await expect(page.getByRole("heading", { name: "Servis / İşletme Girişi" })).toBeVisible();
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await expect(page.getByLabel("Şifre")).toBeVisible();
    await expect(page.getByRole("link", { name: "Kayıt olun" })).toHaveAttribute("href", "/panel/kayit");
  });
});

test.describe("Kayıt sayfaları", () => {
  test("bireysel kayıt formu render ediliyor", async ({ page }) => {
    await page.goto("/bireysel/kayit");
    await expect(page.getByRole("heading", { name: "Bireysel Kayıt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hesap Oluştur" })).toBeVisible();
  });

  test("işletme kayıt formu render ediliyor", async ({ page }) => {
    await page.goto("/panel/kayit");
    await expect(page.getByRole("heading", { name: "İşletme Kaydı" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hesap Oluştur" })).toBeVisible();
  });
});

test.describe("Public QR pasaportu", () => {
  test("geçersiz kod için PII sızdırmadan jenerik mesaj gösterir", async ({ page }) => {
    await page.goto("/p/gecersiz-test-kodu-000");
    await expect(page.getByRole("heading", { name: "Geçersiz Kod" })).toBeVisible();
  });
});

test.describe("Legacy /v/[id]", () => {
  test("artık araç verisi göstermeden inert mesaj gösteriyor", async ({ page }) => {
    await page.goto("/v/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Bu Bağlantı Artık Geçerli Değil" })).toBeVisible();
  });
});
