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

  // ÜÇÜNCÜ düzeltme turu (madde 6): /api/ownership-transfer ve
  // /api/ownership-transfer-initiate KALDIRILDI — incelemede bu iki
  // route'un yalnızca kendi kendini sarmaladığı, gerçek RLS/RPC EXECUTE
  // yetkilerinin zaten aynı işlemlere doğrudan izin verdiği (bu yüzden
  // gerçek bir güvenlik sınırı EKLEMEDİKLERİ) ortaya çıktı. Sahiplik
  // devri artık yalnızca UI seviyesi PILOT_FLAGS ile kapalı — bkz. yukarı
  // "madde 3" describe bloğundaki iki URL testi ve final rapor.
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

test.describe("İkinci düzeltme turu — madde 7/8: aynı anda seçilen birden fazla işlem tek servis ziyareti olarak kaydedilir", () => {
  // DEFAULT_INTERVALS (app/panel/araclar/[id]/page.tsx): motor_yagi=10000,
  // yag_filtresi=10000, hava_filtresi=15000. current_km=40000 ile Motor
  // Yağı+Hava Filtresi seçilirse en erken vade 40000+10000=50000 olmalı
  // (Hava Filtresi'nin 55000'i değil).
  async function setupQuickSave(page: any, baseURL: string, plate: string) {
    const recordInserts: any[] = [];
    const vehiclePatches: any[] = [];
    await installMockSession(page.context(), { id: STAFF_ID, email: `grup-${plate}@ornek.com` }, baseURL);
    await mockSupabaseRest(page, {
      vehicles: { single: { id: VEHICLE_ID, plate, brand: "Fiat", model: "Egea", year: 2021, current_km: 40000, tenant_id: TENANT_ID, owner_user_id: null }, list: [] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      qr_keys: { single: null, list: [] },
      staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
      tenants: { single: { id: TENANT_ID, name: "Grup Test Servis" } },
    });
    await page.route("**/rest/v1/maintenance_records**", async (route: any) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        recordInserts.push(body);
        await new Promise((r) => setTimeout(r, 100)); // gerçekçi ağ gecikmesi — çift tık senaryosu için
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(Array.isArray(body) ? body : [body]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("**/rest/v1/vehicles**", async (route: any) => {
      if (route.request().method() === "PATCH") {
        vehiclePatches.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      }
      // GET: sayfa yüklemesi .single() kullanıyor (Accept:
      // vnd.pgrst.object) — bu durumda tek NESNE dönmeli, dizi değil,
      // yoksa supabase-js parse hatası verir ve sayfa hiç dolmaz.
      const wantsSingle = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
      const row = { id: VEHICLE_ID, plate, brand: "Fiat", model: "Egea", year: 2021, current_km: 40000, tenant_id: TENANT_ID, owner_user_id: null };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wantsSingle ? row : [row]) });
    });
    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    await page.getByText(plate).first().waitFor();
    return { recordInserts, vehiclePatches };
  }

  test("madde 7: maintenance_records yazma fonksiyonu yalnız BİR kez çağrılır (iki ayrı satır değil, tek satır)", async ({ page, baseURL }) => {
    const { recordInserts } = await setupQuickSave(page, baseURL!, "34 GR 001");
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "Yağ Filtresi", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await page.waitForTimeout(300);

    expect(recordInserts.length, "maintenance_records'a tam olarak bir POST gitmeli").toBe(1);
    const rows = Array.isArray(recordInserts[0]) ? recordInserts[0] : [recordInserts[0]];
    expect(rows.length, "tek POST içinde tek satır olmalı").toBe(1);
  });

  test("madde 8: üç işlem seçildiğinde TÜM işlem adları birleştirilmiş açıklamada korunur", async ({ page, baseURL }) => {
    const { recordInserts } = await setupQuickSave(page, baseURL!, "34 GR 003");
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "Yağ Filtresi", exact: true }).click();
    await page.getByRole("button", { name: "Hava Filtresi", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await page.waitForTimeout(300);

    const rows = Array.isArray(recordInserts[0]) ? recordInserts[0] : [recordInserts[0]];
    expect(rows.length).toBe(1);
    for (const label of ["Motor Yağı", "Yağ Filtresi", "Hava Filtresi"]) {
      expect(rows[0].description, `${label} açıklamada eksik`).toContain(label);
    }
  });

  test("madde 8: en erken bakım gerektiren işlem otomatik sonraki km olarak seçilir (10.000 vade, 15.000 değil)", async ({ page, baseURL }) => {
    const { vehiclePatches } = await setupQuickSave(page, baseURL!, "34 GR 004");
    // Motor Yağı: +10.000 (vade 50.000) — Hava Filtresi: +15.000 (vade 55.000).
    // Otomatik öneri en erken olanı (50.000) seçmeli, en geç olanı değil.
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "Hava Filtresi", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await page.waitForTimeout(300);

    expect(vehiclePatches.length).toBeGreaterThan(0);
    const patch = vehiclePatches[vehiclePatches.length - 1];
    expect(patch.next_service_km, "en erken vade (40.000+10.000) seçilmeli").toBe(50000);
  });

  test("madde 8: güncel kilometre yalnız BİR kez güncellenir (vehicles PATCH tek çağrı)", async ({ page, baseURL }) => {
    const { vehiclePatches } = await setupQuickSave(page, baseURL!, "34 GR 005");
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "Yağ Filtresi", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await page.waitForTimeout(300);

    expect(vehiclePatches.length, "vehicles'a tam olarak bir PATCH gitmeli").toBe(1);
    expect(vehiclePatches[0].current_km).toBe(40000);
  });

  test("madde 8: KAYDET'e hızlı çift tıklama tek ziyaret üretir (ikinci istek engellenmeli)", async ({ page, baseURL }) => {
    const { recordInserts } = await setupQuickSave(page, baseURL!, "34 GR 006");
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    const saveBtn = page.getByRole("button", { name: "KAYDET" });
    // quickSubmitRef senkron kilidi — iki hızlı tıklama tek istek üretmeli.
    await Promise.all([saveBtn.click(), saveBtn.click()]);
    await page.waitForTimeout(400);

    expect(recordInserts.length, "çift tıklama tek maintenance_records POST'u üretmeli").toBe(1);
  });
});
