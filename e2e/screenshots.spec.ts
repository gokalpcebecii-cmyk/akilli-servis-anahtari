import { test } from "@playwright/test";
import path from "path";

const outDir = path.join(__dirname, "..", "qa-screenshots");

test.describe("QA görsel doğrulama ekran görüntüleri", () => {
  test("Homepage desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/");
    await page.screenshot({ path: path.join(outDir, "01-homepage-desktop.png"), fullPage: false });
  });

  test("Login chooser desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/giris");
    await page.getByRole("heading", { name: "Nasıl devam etmek istersiniz?" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "02-login-chooser-desktop.png") });
  });

  test("Login chooser mobile 390px", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile-390") test.skip();
    await page.goto("/giris");
    await page.getByRole("heading", { name: "Nasıl devam etmek istersiniz?" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "03-login-chooser-mobile-390.png") });
  });

  test("Individual login", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/bireysel/giris");
    await page.screenshot({ path: path.join(outDir, "04-individual-login.png") });
  });

  test("Business login", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/panel/login");
    await page.screenshot({ path: path.join(outDir, "05-business-login.png") });
  });

  test("Homepage mobile", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile-390") test.skip();
    await page.goto("/");
    await page.screenshot({ path: path.join(outDir, "06-homepage-mobile.png") });
  });

  test("Bireysel kayıt desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/bireysel/kayit");
    await page.screenshot({ path: path.join(outDir, "07-bireysel-kayit-desktop.png") });
  });

  test("Panel kayıt desktop", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/panel/kayit");
    await page.screenshot({ path: path.join(outDir, "08-panel-kayit-desktop.png") });
  });

  test("Public passport - geçersiz kod", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    await page.goto("/p/gecersiz-test-kodu-000");
    await page.screenshot({ path: path.join(outDir, "09-public-passport-invalid.png") });
  });

  test("Devret adımları (sahiplik devri pilot kapalı -> 'Kullanılamıyor' gösterir)", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop-chromium") test.skip();
    // Not: bu ekran önceden token geçersizse "Geçersiz veya Süresi Dolmuş
    // Bağlantı" gösterirdi. Takip turunda (ağ seviyesinde sıfır istek
    // kapatması) PILOT_FLAGS.ownershipTransferSelfService kontrolü bu
    // sayfanın en başına taşındı — flag kapalıyken (mevcut durum) hangi
    // token verilirse verilsin her zaman "Bu Özellik Şu An Kullanılamıyor"
    // gösterilir, hiçbir RPC isteği atılmaz.
    await page.goto("/bireysel/devir-kabul/gecersiz-token-000");
    await page.getByRole("heading", { name: "Bu Özellik Şu An Kullanılamıyor" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "10-devir-kabul-invalid.png") });
  });
});
