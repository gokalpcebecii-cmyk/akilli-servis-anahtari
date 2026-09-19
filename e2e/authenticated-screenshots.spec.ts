import { test, expect } from "@playwright/test";
import path from "path";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// Bu spec, gerçek kimlik doğrulamalı ekranları GERÇEK component kodu ve
// GERÇEK Supabase client çağrılarıyla render eder; yalnızca ağ katmanı
// (çerez + REST/RPC yanıtları) Playwright test fixture'ıyla mock'lanır.
// Bkz. e2e/fixtures/mockAuth.ts başlığındaki açıklama. Production kodu
// değişmedi, yeni route yok, gerçek Supabase projesine bu testlerde hiç
// istek gitmiyor.

const outDir = path.join(__dirname, "..", "qa-screenshots");

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const VEHICLE_ID = "22222222-2222-2222-2222-222222222222";
const STAFF_ID = "33333333-3333-3333-3333-333333333333";
const TENANT_ID = "44444444-4444-4444-4444-444444444444";

const mockVehicle = {
  id: VEHICLE_ID,
  plate: "34 ABC 123",
  brand: "Volkswagen",
  model: "Golf",
  year: 2021,
  current_km: 52430,
  next_service_km: 60000,
  next_service_date: "2026-12-01",
  notes: "",
  owner_user_id: OWNER_ID,
  tenant_id: null,
  muayene_tarihi: "2027-04-15",
  trafik_sigortasi_bitis: "2027-01-10",
  kasko_bitis: "2027-01-10",
};

const mockRecords = [
  { id: "r1", vehicle_id: VEHICLE_ID, description: "Motor Yağı", km_at_service: 50000, cost: 1200, service_date: "2026-06-01", created_at: "2026-06-01", tenant_id: TENANT_ID },
  { id: "r2", vehicle_id: VEHICLE_ID, description: "Yağ Filtresi", km_at_service: 50000, cost: 300, service_date: "2026-06-01", created_at: "2026-06-01", tenant_id: TENANT_ID },
  { id: "r3", vehicle_id: VEHICLE_ID, description: "Genel bakım", km_at_service: 42000, cost: null, service_date: "2026-01-15", created_at: "2026-01-15", tenant_id: null },
];

const mockMaintenanceItems = [
  { vehicle_id: VEHICLE_ID, item_key: "motor_yagi", last_service_date: "2026-06-01", last_service_km: 50000, interval_km: 10000 },
  { vehicle_id: VEHICLE_ID, item_key: "lastik", last_service_date: "2025-11-01", last_service_km: 40000, interval_km: 20000 },
];

const mockQrKey = { code: "abc123def456", revoked_at: null, vehicle_id: VEHICLE_ID };

async function setupBireyselAuth(page: any, baseURL: string) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "test.kullanici@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: { single: mockVehicle, list: [mockVehicle] },
    maintenance_records: { list: mockRecords },
    maintenance_items: { list: mockMaintenanceItems },
    qr_keys: { single: mockQrKey, list: [mockQrKey] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
}

async function setupServisAuth(page: any, baseURL: string) {
  await installMockSession(page.context(), { id: STAFF_ID, email: "servis@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: { single: { ...mockVehicle, tenant_id: TENANT_ID, owner_user_id: null }, list: [mockVehicle] },
    maintenance_records: { list: mockRecords },
    maintenance_items: { list: mockMaintenanceItems },
    qr_keys: { single: mockQrKey, list: [mockQrKey] },
    staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
    tenants: { single: { id: TENANT_ID, name: "Yılmaz Oto Servis", phone: "0312 000 00 00", address: "Çankaya, Ankara" } },
  });
}

test.describe("Authenticated ekranlar — mock fixture ile gerçek render (bkz. final rapor madde 13)", () => {
  test("Bireysel ana ekran — araç verili", async ({ page, baseURL }, testInfo) => {
    await setupBireyselAuth(page, baseURL!);
    await page.goto("/bireysel/araclar");
    await page.getByText("34 ABC 123").waitFor();
    const suffix = testInfo.project.name === "mobile-390" ? "mobile" : "desktop";
    await page.screenshot({ path: path.join(outDir, `11-bireysel-ana-ekran-${suffix}.png`), fullPage: true });
  });

  test("Bireysel araç detay/pasaport", async ({ page, baseURL }, testInfo) => {
    await setupBireyselAuth(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByText("34 ABC 123").first().waitFor();
    const suffix = testInfo.project.name === "mobile-390" ? "mobile" : "desktop";
    await page.screenshot({ path: path.join(outDir, `12-bireysel-arac-detay-${suffix}.png`), fullPage: true });
  });

  test("QR/NFC yönetimi (araç detay içinde)", async ({ page, baseURL }, testInfo) => {
    await setupBireyselAuth(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}#qr`);
    await page.locator("#qr").waitFor();
    await page.locator("#qr").scrollIntoViewIfNeeded();
    const suffix = testInfo.project.name === "mobile-390" ? "mobile" : "desktop";
    await page.screenshot({ path: path.join(outDir, `13-qr-nfc-yonetimi-${suffix}.png`) });
  });

  test("Araç devret", async ({ page, baseURL }, testInfo) => {
    await setupBireyselAuth(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
    await page.getByRole("heading", { name: "Aracı Devret / Elden Çıkar" }).waitFor();
    const suffix = testInfo.project.name === "mobile-390" ? "mobile" : "desktop";
    await page.screenshot({ path: path.join(outDir, `14-arac-devret-${suffix}.png`) });
  });

  test("Servis hızlı bakım kayıt ekranı", async ({ page, baseURL }, testInfo) => {
    await setupServisAuth(page, baseURL!);
    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    await page.getByText("34 ABC 123").first().waitFor();
    const suffix = testInfo.project.name === "mobile-390" ? "mobile" : "desktop";
    await page.screenshot({ path: path.join(outDir, `15-servis-hizli-bakim-${suffix}.png`) });
  });

  test("Servis hızlı bakım — işlem butonları ve KAYDET 44px altına düşmüyor (390px)", async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "yalnızca mobil viewport'ta anlamlı");
    await setupServisAuth(page, baseURL!);
    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    await page.getByText("34 ABC 123").first().waitFor();

    for (const label of ["Motor Yağı", "Ön Balata", "Diğer"]) {
      const box = await page.getByText(label, { exact: true }).first().boundingBox();
      expect(box?.height ?? 0, `${label} chip yüksekliği`).toBeGreaterThanOrEqual(44);
    }
    const saveBox = await page.getByRole("button", { name: "KAYDET" }).boundingBox();
    expect(saveBox?.height ?? 0, "KAYDET buton yüksekliği").toBeGreaterThanOrEqual(44);
  });
});
