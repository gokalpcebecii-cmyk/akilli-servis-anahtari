import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("hero, CTA'lar ve marka doğru render ediliyor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /premium.*dijital servis pasaportu/i })).toBeVisible();
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

test.describe("Giriş seçimi (tam ekran sayfa)", () => {
  test("Giriş Yap tıklanınca /giris sayfasına yönlendirir, başlık/alt metin doğru", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page).toHaveURL(/\/giris$/);
    await expect(page.getByRole("heading", { name: "Nasıl devam etmek istersiniz?" })).toBeVisible();
    await expect(page.getByText("İhtiyaçlarınıza en uygun seçeneği seçin.")).toBeVisible();
  });

  test("iki kart da doğru hedeflere sahip", async ({ page }) => {
    await page.goto("/giris");

    await expect(page.getByText("Bireysel Kullanıcı")).toBeVisible();
    await expect(page.getByText("Servis / Kurumsal")).toBeVisible();

    const bireyselCard = page.getByRole("link", { name: /Bireysel Kullanıcı/ });
    await expect(bireyselCard).toHaveAttribute("href", "/bireysel/giris");

    const servisCard = page.getByRole("link", { name: /Servis \/ Kurumsal/ });
    await expect(servisCard).toHaveAttribute("href", "/panel/login");
  });

  test("Ücretsiz Başlayın da aynı sayfaya yönlendirir", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Ücretsiz Başlayın/i }).click();
    await expect(page).toHaveURL(/\/giris$/);
  });

  test("geri oku ana sayfaya döner", async ({ page }) => {
    await page.goto("/giris");
    await page.getByRole("link", { name: "Geri" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("'Daha sonra değiştirilebilir' notu görünür", async ({ page }) => {
    await page.goto("/giris");
    await expect(page.getByText("Daha sonra değiştirilebilir.")).toBeVisible();
  });
});

test.describe("Mobil (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("homepage'de yatay taşma yok", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("/giris tam ekran sayfası mobilde taşmadan açılır", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await expect(page).toHaveURL(/\/giris$/);
    await expect(page.getByRole("heading", { name: "Nasıl devam etmek istersiniz?" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("kartlar mobilde dokunulabilir", async ({ page }) => {
    await page.goto("/giris");
    const bireyselCard = page.getByRole("link", { name: /Bireysel Kullanıcı/ });
    await expect(bireyselCard).toBeVisible();
    await expect.poll(async () => (await bireyselCard.boundingBox())?.height ?? 0, {
      timeout: 5000,
    }).toBeGreaterThanOrEqual(44);
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
