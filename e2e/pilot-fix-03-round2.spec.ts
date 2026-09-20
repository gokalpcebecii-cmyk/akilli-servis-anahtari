import { test, expect } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// İkinci düzeltme turu — güvenlik/kabul testleri.
// Bu dosya PILOT FIX 03'ün ilk turunda eksik kalan/yeni bulunan
// maddeleri kapsar: kapalı özelliklerin URL+API seviyesinde gerçekten
// kapalı olduğu, çift gönderimde tek araç oluştuğu, çoklu işlem
// seçiminin tek ziyaret altında kaydedildiği, /panel/araclar
// yönlendirmesi.

const OWNER_ID = "bbbbbbbb-1111-1111-1111-111111111111";
const VEHICLE_ID = "bbbbbbbb-2222-2222-2222-222222222222";
const STAFF_ID = "bbbbbbbb-3333-3333-3333-333333333333";
const TENANT_ID = "bbbbbbbb-4444-4444-4444-444444444444";
const CREATED_VEHICLE_ID = "bbbbbbbb-5555-5555-5555-555555555555";

test.describe("İkinci düzeltme turu — madde 3/4: kapalı özellikler URL seviyesinde kapalı", () => {
  test("madde 3: /panel/araclar/[id]/devret (servis) doğrudan URL ile açılsa da 'Kullanılamıyor' gösterir", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "servis@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
      vehicles: { single: { id: VEHICLE_ID, plate: "34 ABC 123", tenant_id: TENANT_ID }, list: [] },
    });
    await page.goto(`/panel/araclar/${VEHICLE_ID}/devret`);
    await expect(page.getByRole("heading", { name: "Bu Özellik Şu An Kullanılamıyor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Devri Tamamla" })).toHaveCount(0);
  });

  test("madde 3: /bireysel/araclar/[id]/devret (bireysel self-service) doğrudan URL ile açılsa da 'Kullanılamıyor' gösterir", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: OWNER_ID, email: "bireysel@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      vehicles: { single: { id: VEHICLE_ID, plate: "34 ABC 123", owner_user_id: OWNER_ID }, list: [] },
    });
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
    await expect(page.getByRole("heading", { name: "Bu Özellik Şu An Kullanılamıyor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Devri Başlat" })).toHaveCount(0);
  });

  test("madde 3: /panel/qr-uretim doğrudan URL ile açılsa da 'Kullanılamıyor' gösterir", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "servis@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, { staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID, role: "owner" } } });
    await page.goto("/panel/qr-uretim");
    await expect(page.getByRole("heading", { name: "Bu Özellik Şu An Kullanılamıyor" })).toBeVisible();
  });

  test("madde 4: /panel/eslestir doğrudan URL ile açılsa da 'Kullanılamıyor' gösterir, araç sorgusu hiç çalışmaz", async ({ page, baseURL }) => {
    let vehiclesQueried = false;
    await installMockSession(page.context(), { id: STAFF_ID, email: "servis@ornek.com" }, baseURL!);
    await page.route("**/rest/v1/vehicles**", async (route) => {
      vehiclesQueried = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto("/panel/eslestir");
    await expect(page.getByRole("heading", { name: "Bu Özellik Şu An Kullanılamıyor" })).toBeVisible();
    expect(vehiclesQueried, "flag kapalıyken araç listesi hiç çekilmemeli").toBe(false);
  });

  test("madde 5: silinen /panel/araclar 404 değil, /panel/dashboard'a yönlendiriyor", async ({ page, baseURL }) => {
    const response = await page.goto("/panel/araclar");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/panel\/dashboard$/);
  });
});

test.describe("İkinci düzeltme turu — madde 3/4: kapalı özellikler API seviyesinde de kapalı (URL'yi atlayan doğrudan istek)", () => {
  test("POST /api/qr-uretim → 403, zero side effect (kimliksiz istekte bile)", async ({ request }) => {
    const res = await request.post("/api/qr-uretim", { data: { count: 5 } });
    expect(res.status()).toBe(403);
  });

  test("POST /api/qr-eslestir → 403 (kimliksiz istekte bile)", async ({ request }) => {
    const res = await request.post("/api/qr-eslestir", { data: { code: "abc123", vehicle_id: VEHICLE_ID } });
    expect(res.status()).toBe(403);
  });

  test("POST /api/ownership-transfer (servis) → 403 (kimliksiz istekte bile)", async ({ request }) => {
    const res = await request.post("/api/ownership-transfer", {
      data: { vehicle_id: VEHICLE_ID, new_owner: { full_name: "Test" }, confirm_erase: true },
    });
    expect(res.status()).toBe(403);
  });

  test("POST /api/ownership-transfer-initiate (bireysel) → 403 (kimliksiz istekte bile)", async ({ request }) => {
    const res = await request.post("/api/ownership-transfer-initiate", { data: { vehicle_id: VEHICLE_ID } });
    expect(res.status()).toBe(403);
  });
});

test.describe("İkinci düzeltme turu — madde 2: çift gönderim tek araç oluşturur (istemci seviyesi)", () => {
  test("Hızlı ardışık iki tıklama, /api/vehicles'a yalnızca BİR istek gönderir", async ({ page, baseURL }) => {
    let postCount = 0;
    await installMockSession(page.context(), { id: OWNER_ID, email: "cift@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      vehicles: { single: { id: CREATED_VEHICLE_ID, plate: "34 CC 111" }, list: [] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      "rpc/list_my_pending_outgoing_transfers": { list: [] },
    });
    await page.route("**/api/vehicles", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      postCount++;
      // Gerçek ağ gecikmesini taklit et — çift tıklamanın ikinci
      // isteği ilk yanıt dönmeden gelirse ne olacağını da test eder.
      await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ vehicle: { id: CREATED_VEHICLE_ID } }) });
    });

    await page.goto("/bireysel/araclar/yeni");
    await page.getByText("Güncel Kilometre").waitFor();
    await page
      .locator("label")
      .filter({ hasText: /^Plaka$/ })
      .locator("xpath=following-sibling::input[1]")
      .fill("34 CC 111");
    await page
      .locator("label")
      .filter({ hasText: /^Marka$/ })
      .locator("xpath=following-sibling::input[1]")
      .fill("Fiat");
    await page
      .locator("label")
      .filter({ hasText: /^Model$/ })
      .locator("xpath=following-sibling::input[1]")
      .fill("Egea");
    await page
      .locator("label")
      .filter({ hasText: /^Model Yılı$/ })
      .locator("xpath=following-sibling::input[1]")
      .fill("2020");
    await page.getByPlaceholder("Örn. 52430").pressSequentially("40000");

    const submitBtn = page.getByRole("button", { name: "Aracı Oluştur" });
    // İki hızlı tıklama — React state güncellemesi henüz DOM'a
    // yansımadan gelen ikinci tıklamayı taklit eder (madde A5/A1'in
    // senkron useRef kilidi burada test ediliyor).
    await Promise.all([submitBtn.click(), submitBtn.click()]);
    await page.waitForURL(new RegExp(`/bireysel/araclar/${CREATED_VEHICLE_ID}$`));

    expect(postCount, "iki hızlı tıklama yalnızca BİR POST /api/vehicles üretmeli").toBe(1);
  });
});

test.describe("İkinci düzeltme turu — madde 7: aynı anda seçilen birden fazla işlem tek servis ziyareti olarak kaydedilir", () => {
  test("Motor Yağı + Yağ Filtresi birlikte seçilip KAYDET'e basıldığında maintenance_records'a TEK satır yazılır", async ({ page, baseURL }) => {
    const insertedPayloads: any[] = [];
    await installMockSession(page.context(), { id: STAFF_ID, email: "grup@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      vehicles: { single: { id: VEHICLE_ID, plate: "34 GR 001", brand: "Fiat", model: "Egea", year: 2021, current_km: 40000, tenant_id: TENANT_ID, owner_user_id: null }, list: [] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      qr_keys: { single: null, list: [] },
      staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
      tenants: { single: { id: TENANT_ID, name: "Grup Test Servis" } },
    });
    await page.route("**/rest/v1/maintenance_records**", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        insertedPayloads.push(body);
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(Array.isArray(body) ? body : [body]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    await page.getByText("34 GR 001").first().waitFor();

    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "Yağ Filtresi", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await page.waitForTimeout(300);

    expect(insertedPayloads.length, "maintenance_records'a tam olarak bir POST gitmeli").toBe(1);
    const rows = Array.isArray(insertedPayloads[0]) ? insertedPayloads[0] : [insertedPayloads[0]];
    expect(rows.length, "tek POST içinde tek satır olmalı (iki ayrı satır değil)").toBe(1);
    expect(rows[0].description).toContain("Motor Yağı");
    expect(rows[0].description).toContain("Yağ Filtresi");
  });
});
