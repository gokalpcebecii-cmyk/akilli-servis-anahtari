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
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: path.join(outDir, "02-login-chooser-desktop.png") });
  });

  test("Login chooser mobile 390px", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile-390") test.skip();
    await page.goto("/");
    await page.getByRole("button", { name: "Giriş Yap" }).click();
    await page.getByRole("dialog").waitFor();
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
});
