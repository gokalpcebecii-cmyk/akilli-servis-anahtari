import { expect, Page } from "@playwright/test";

// OTOİZ Aşama E.1: marka → model seçim paneli yardımcıları.
export async function pickBrand(page: Page, brand: string, prefix = "arac") {
  await page.locator(`#${prefix}-brand`).click();
  const sheet = page.getByRole("dialog", { name: "Marka seçin" });
  await sheet.getByRole("button", { name: brand, exact: true }).click();
}

export async function pickModel(page: Page, model: string, prefix = "arac") {
  let sheet = page.getByRole("dialog", { name: /modeli seçin|Model seçin/ });
  if (!(await sheet.isVisible())) {
    await page.locator(`#${prefix}-model`).click();
    sheet = page.getByRole("dialog", { name: /modeli seçin|Model seçin/ });
  }
  await sheet.getByRole("button", { name: model, exact: true }).click();
  await expect(sheet).toBeHidden();
}

export async function pickBrandModel(page: Page, brand: string, model: string, prefix = "arac") {
  await pickBrand(page, brand, prefix);
  await pickModel(page, model, prefix);
}

export async function closeSheet(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Kapat" }).click();
}
