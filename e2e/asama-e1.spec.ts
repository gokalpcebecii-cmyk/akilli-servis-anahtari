import { test, expect, Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ Aşama E.1 — Sonraki Muayene / Kasko / Zorunlu Trafik Sigortası
// tarihleri ve durumları, marka → model seçimi (Diğer / Elle gir), mevcut
// kayıtları bozmama, imleç (caret) düzeltmesi. Gerçek component kodu; yalnız
// ağ katmanı mock.

const OWNER_ID = "e1e1e1e1-1111-4000-8000-000000000001";
const STAFF_ID = "e1e1e1e1-1111-4000-8000-000000000002";
const TENANT_ID = "e1e1e1e1-1111-4000-8000-000000000003";
const VEHICLE_ID = "e1e1e1e1-1111-4000-8000-000000000004";
const CREATED_ID = "e1e1e1e1-1111-4000-8000-000000000005";
const SHOT_DIR = process.env.E2E_SHOT_DIR;

function isoInDays(n: number) {
  // İstanbul takvim günü (uygulama ile aynı)
  const d = new Date(Date.now() + 3 * 3600000 + n * 86400000);
  return d.toISOString().slice(0, 10);
}

const vehicle = {
  id: VEHICLE_ID,
  plate: "34 OTZ 084",
  brand: "Volkswagen",
  model: "Passat",
  year: 2019,
  current_km: 84200,
  next_service_km: 94200,
  next_service_date: isoInDays(300),
  muayene_tarihi: null,
  trafik_sigortasi_bitis: isoInDays(-3), // geçti → KIRMIZI
  kasko_bitis: isoInDays(12), // 30 gün içinde → SARI
  notes: "",
};

async function shot(page: Page, name: string) {
  if (!SHOT_DIR) return;
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
}

async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, `yatay taşma ${o.sw} > ${o.cw}`).toBeLessThanOrEqual(o.cw);
}

async function mockCommon(page: Page) {
  await page.route("**/rest/v1/rpc/vehicle_timeline**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [], has_more: false, total: 0, viewer: "owner" }) })
  );
}

async function setupOwner(page: Page, baseURL: string, v: any = vehicle) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "e1.sahip@ornek.com" }, baseURL);
  const row = { ...v, tenant_id: null, owner_user_id: OWNER_ID };
  await mockSupabaseRest(page, {
    vehicles: { single: row, list: [row] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: null, list: [] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
  await mockCommon(page);
  const patches: any[] = [];
  await page.route("**/rest/v1/vehicles**", async (route) => {
    if (route.request().method() === "PATCH") {
      patches.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([row]) });
      return;
    }
    await route.fallback();
  });
  return { patches };
}

test.describe("Aşama E.1 — muayene / kasko / trafik sigortası", () => {
  test("Araç Durumu: trafik sigortası KIRMIZI, kasko SARI, muayene GRİ; Belgeler sekmesi aynı renkler", async ({ page, baseURL }, info) => {
    await setupOwner(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await expect(page.getByTestId("durum-trafik")).toHaveAttribute("data-level", "late");
    await expect(page.getByTestId("durum-kasko")).toHaveAttribute("data-level", "soon");
    await expect(page.getByTestId("durum-muayene")).toHaveAttribute("data-level", "none");
    await expect(page.getByTestId("durum-trafik")).toContainText("3 gün geçti");
    await expect(page.getByTestId("durum-kasko")).toContainText("12 gün kaldı");
    await expect(page.getByTestId("durum-yaklasan")).toContainText("Zorunlu trafik sigortası bitişi");
    await noHorizontalOverflow(page);
    await shot(page, `e1-durum-${info.project.name}`);

    await page.getByRole("button", { name: "Belgeler" }).click();
    await expect(page.getByTestId("belge-satir-trafik_sigortasi_bitis")).toHaveAttribute("data-level", "late");
    await expect(page.getByTestId("belge-satir-kasko_bitis")).toHaveAttribute("data-level", "soon");
    await expect(page.getByTestId("belge-satir-muayene_tarihi")).toHaveAttribute("data-level", "none");
    await expect(page.getByTestId("belge-satir-muayene_tarihi")).toContainText("Tarih girilmedi");
  });

  test("Sahip tarihleri düzenler: anlık renk + kayda üç tarih de gider", async ({ page, baseURL }, info) => {
    const { patches } = await setupOwner(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.getByRole("button", { name: "Belgeler" }).click();
    await page.getByRole("button", { name: "Tarihleri Güncelle" }).click();
    const box = page.getByTestId("belge-tarihleri");
    await expect(box).toBeVisible();
    await page.locator('[data-field="muayene_tarihi"]').fill(isoInDays(30));
    await expect(page.getByTestId("belge-durum-muayene_tarihi")).toHaveAttribute("data-level", "soon");
    await page.locator('[data-field="muayene_tarihi"]').fill(isoInDays(31));
    await expect(page.getByTestId("belge-durum-muayene_tarihi")).toHaveAttribute("data-level", "ok");
    await page.locator('[data-field="kasko_bitis"]').fill(isoInDays(-1));
    await expect(page.getByTestId("belge-durum-kasko_bitis")).toHaveAttribute("data-level", "late");
    await page.getByRole("button", { name: "Zorunlu Trafik Sigortası Bitiş Tarihi tarihini sil" }).click();
    await expect(page.getByTestId("belge-durum-trafik_sigortasi_bitis")).toHaveAttribute("data-level", "none");
    await noHorizontalOverflow(page);
    await shot(page, `e1-tarih-duzenle-${info.project.name}`);
    await page.getByRole("button", { name: "Kaydet", exact: true }).first().click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0].muayene_tarihi).toBe(isoInDays(31));
    expect(patches[0].kasko_bitis).toBe(isoInDays(-1));
    expect(patches[0].trafik_sigortasi_bitis).toBeNull();
    // Diğer alanlar aynen
    expect(patches[0].brand).toBe("Volkswagen");
    expect(patches[0].model).toBe("Passat");
    expect(patches[0].current_km).toBe(84200);
  });

  test("Servis araç bilgilerinden tarihleri girer; güncelleme hata verirse form açık kalır", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "e1.servis@ornek.com" }, baseURL!);
    const row = { ...vehicle, tenant_id: TENANT_ID, owner_user_id: null };
    await mockSupabaseRest(page, {
      vehicles: { single: row, list: [row] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      qr_keys: { single: null, list: [] },
      staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
      tenants: { single: { id: TENANT_ID, name: "Güven Oto" } },
    });
    await mockCommon(page);
    const patches: any[] = [];
    let fail = true;
    await page.route("**/rest/v1/vehicles**", async (route) => {
      if (route.request().method() === "PATCH") {
        patches.push(route.request().postDataJSON());
        if (fail) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "x" }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([row]) });
      }
      await route.fallback();
    });
    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    await page.getByText(row.plate).first().waitFor();
    await page.getByRole("button", { name: "Araç bilgilerini düzenle" }).click();
    await page.locator('[data-field="muayene_tarihi"]').fill(isoInDays(90));
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Bilgileri Kaydet" }).click();
    await expect.poll(() => patches.length).toBe(1);
    await expect(page.getByTestId("belge-tarihleri")).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Bilgileri Kaydet" }).click();
    await expect.poll(() => patches.length).toBe(2);
    expect(patches[1].muayene_tarihi).toBe(isoInDays(90));
    expect(patches[1].kasko_bitis).toBe(vehicle.kasko_bitis);
    await expect(page.getByTestId("belge-tarihleri")).toHaveCount(0);
  });
});

test.describe("Aşama E.1 — marka → model", () => {
  async function setupNew(page: Page, baseURL: string) {
    await installMockSession(page.context(), { id: OWNER_ID, email: "e1.yeni@ornek.com" }, baseURL);
    await mockSupabaseRest(page, {
      vehicles: { single: null, list: [] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      "rpc/list_my_pending_outgoing_transfers": { list: [] },
    });
    const posts: any[] = [];
    await page.route("**/api/vehicles", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ vehicle: { id: CREATED_ID } }) });
    });
    await page.goto("/bireysel/araclar/yeni");
    await page.getByTestId("marka-model").waitFor();
    return { posts };
  }

  test("Yeni araç: marka seç → model listesi gelir; listede yoksa Diğer / Elle gir", async ({ page, baseURL }, info) => {
    const { posts } = await setupNew(page, baseURL!);
    const model = page.getByLabel("Model", { exact: true });
    await expect(model).toBeDisabled();
    await page.getByLabel("Marka", { exact: true }).selectOption("Fiat");
    await expect(model).toBeEnabled();
    const opts = await model.locator("option").allTextContents();
    expect(opts).toContain("Egea");
    expect(opts).toContain("Diğer / Elle gir");
    await model.selectOption({ label: "Diğer / Elle gir" });
    const manual = page.locator("#arac-model");
    await expect(manual).toHaveJSProperty("tagName", "INPUT");
    await manual.fill("Tipo");
    await page.locator('[data-field="plate"]').fill("34 E1 001");
    await page.locator('[data-field="year"]').fill("2021");
    await page.getByPlaceholder("Örn. 52430").pressSequentially("15000");
    await page.locator('[data-field="kasko_bitis"]').fill(isoInDays(200));
    await noHorizontalOverflow(page);
    await shot(page, `e1-yeni-arac-${info.project.name}`);
    await page.getByRole("button", { name: "Aracı Oluştur" }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].brand).toBe("Fiat");
    expect(posts[0].model).toBe("Tipo");
    expect(posts[0].kasko_bitis).toBe(isoInDays(200));
    expect(posts[0].muayene_tarihi).toBeNull();
  });

  test("Yeni araç: marka listede yoksa Diğer / Elle gir ile marka ve model yazılır", async ({ page, baseURL }) => {
    const { posts } = await setupNew(page, baseURL!);
    await page.getByLabel("Marka", { exact: true }).selectOption({ label: "Diğer / Elle gir" });
    await page.locator("#arac-brand").fill("Anadol");
    await page.locator("#arac-model").fill("A1");
    await page.locator('[data-field="plate"]').fill("34 E1 002");
    await page.locator('[data-field="year"]').fill("1975");
    await page.getByPlaceholder("Örn. 52430").pressSequentially("120000");
    await page.getByRole("button", { name: "Aracı Oluştur" }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].brand).toBe("Anadol");
    expect(posts[0].model).toBe("A1");
  });

  test("Marka değişince eski model temizlenir; boş model kaydı engellenir", async ({ page, baseURL }) => {
    const { posts } = await setupNew(page, baseURL!);
    await page.getByLabel("Marka", { exact: true }).selectOption("Fiat");
    await page.getByLabel("Model", { exact: true }).selectOption("Egea");
    await page.getByLabel("Marka", { exact: true }).selectOption("Renault");
    await expect(page.getByLabel("Model", { exact: true })).toHaveValue("");
    await page.locator('[data-field="plate"]').fill("34 E1 003");
    await page.locator('[data-field="year"]').fill("2020");
    await page.getByPlaceholder("Örn. 52430").pressSequentially("1000");
    await page.getByRole("button", { name: "Aracı Oluştur" }).click();
    await expect(page.locator("#arac-model-err")).toBeVisible();
    expect(posts.length).toBe(0);
  });

  test("Mevcut kayıt bozulmaz: listede olmayan marka/model elle girişte aynen açılır ve aynen kaydedilir", async ({ page, baseURL }) => {
    const { patches } = await setupOwner(page, baseURL!, { ...vehicle, brand: "Anadol", model: "A1 Özel" });
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.getByRole("button", { name: "Düzenle" }).click();
    await expect(page.locator("#arac-brand")).toHaveValue("Anadol");
    await expect(page.locator("#arac-model")).toHaveValue("A1 Özel");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0].brand).toBe("Anadol");
    expect(patches[0].model).toBe("A1 Özel");
  });

  test("Mevcut kayıt bozulmaz: listedeki marka + listede olmayan model, küçük harfli yazım aynen kalır", async ({ page, baseURL }) => {
    const { patches } = await setupOwner(page, baseURL!, { ...vehicle, brand: "fiat", model: "Egea 1.4 Fire Urban" });
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.getByRole("button", { name: "Düzenle" }).click();
    await expect(page.getByLabel("Marka", { exact: true })).toHaveValue("Fiat");
    await expect(page.locator("#arac-model")).toHaveValue("Egea 1.4 Fire Urban");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0].brand).toBe("fiat");
    expect(patches[0].model).toBe("Egea 1.4 Fire Urban");
  });

  test("320 px: marka ve model alt alta, taşma yok", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await setupNew(page, baseURL!);
    const b = await page.getByLabel("Marka", { exact: true }).boundingBox();
    const m = await page.getByLabel("Model", { exact: true }).boundingBox();
    expect(m!.y).toBeGreaterThan(b!.y + b!.height - 1);
    await noHorizontalOverflow(page);
  });
});

test.describe("Aşama E.1 — imleç", () => {
  async function caretOf(page: Page, sel: string) {
    return page.locator(sel).evaluate((el: HTMLInputElement) => [el.value, el.selectionStart]);
  }

  test("KM alanında ortadan düzeltme: imleç sona kaçmaz", async ({ page, baseURL }) => {
    await setupOwner(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.getByRole("button", { name: "Düzenle" }).click();
    const sel = '[data-field="current_km"]';
    const km = page.locator(sel);
    await expect(km).toHaveValue("84.200");
    await km.click();
    await km.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 2)); // "84|.200"
    await km.press("1");
    expect(await caretOf(page, sel)).toEqual(["841.200", 3]);
    await km.press("5");
    expect(await caretOf(page, sel)).toEqual(["8.415.200", 5]);
    await km.press("Backspace");
    expect(await caretOf(page, sel)).toEqual(["841.200", 3]);
    // Rakam dışı karakter reddedilir, imleç yerinde kalır
    await km.press("a");
    await page.waitForTimeout(50);
    expect(await caretOf(page, sel)).toEqual(["841.200", 3]);
  });

  test("Plakada ortadan küçük harf: büyük harfe döner, imleç yerinde kalır", async ({ page, baseURL }) => {
    await setupOwner(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.getByRole("button", { name: "Düzenle" }).click();
    const sel = '[data-field="plate"]';
    const plate = page.locator(sel);
    await plate.click();
    await plate.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 3)); // "34 |OTZ 084"
    await plate.pressSequentially("ab", { delay: 20 });
    expect(await caretOf(page, sel)).toEqual(["34 ABOTZ 084", 5]);
  });

  test("Servis hızlı kayıt KM: ortadan düzeltme imleci korur", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "e1.servis@ornek.com" }, baseURL!);
    const row = { ...vehicle, tenant_id: TENANT_ID, owner_user_id: null };
    await mockSupabaseRest(page, {
      vehicles: { single: row, list: [row] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      qr_keys: { single: null, list: [] },
      staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
      tenants: { single: { id: TENANT_ID, name: "Güven Oto" } },
    });
    await mockCommon(page);
    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    const sel = 'input[aria-label="Güncel kilometre"]';
    const km = page.locator(sel);
    await expect(km).toHaveValue("84.200");
    await km.click();
    await km.evaluate((el: HTMLInputElement) => el.setSelectionRange(6, 6));
    await km.press("Backspace"); // "84.20" → "8.420"
    await km.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1)); // "8|.420"
    await km.press("6");
    expect(await caretOf(page, sel)).toEqual(["86.420", 2]);
  });

  test("E-posta alanları: otomatik düzeltme/büyük harf kapalı, ortadan yazım imleci korur", async ({ page }) => {
    for (const [path, id] of [
      ["/bireysel/giris", "#bireysel-email"],
      ["/panel/login", "#panel-email"],
      ["/bireysel/kayit", "#kayit-email"],
      ["/panel/kayit", "#isletme-email"],
      ["/hesap/sifremi-unuttum", "#reset-email"],
    ]) {
      await page.goto(path);
      const el = page.locator(id);
      await expect(el).toHaveAttribute("autocorrect", "off");
      await expect(el).toHaveAttribute("autocapitalize", "none");
      await expect(el).toHaveAttribute("spellcheck", "false");
      await el.fill("gokalp@ornek.com");
      // type=email seçim API'si sunmaz: ortadan yazım klavye ile
      await el.press("Home");
      for (let i = 0; i < 6; i++) await el.press("ArrowRight");
      await el.pressSequentially("x");
      await el.pressSequentially("y");
      await expect(el).toHaveValue("gokalpxy@ornek.com");
      await expect(el).toBeFocused();
    }
  });

  test("Giriş kabuğu ayrı kaydırma kutusu değil (iPhone imleç kayması nedeni)", async ({ page }) => {
    await page.goto("/bireysel/giris");
    const ox = await page.locator("main.otoiz-auth2").evaluate((el) => getComputedStyle(el).overflowX);
    expect(ox).toBe("clip");
  });
});
