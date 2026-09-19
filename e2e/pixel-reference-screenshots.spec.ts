// Onaylanan OTOİZ referans görseline karşı görsel sadakat QA'sı için
// gerçek ekranlardan üretilen screenshot seti. Mevcut mockAuth fixture'ını
// kullanır (bkz. e2e/fixtures/mockAuth.ts); production kodu değişmez.
import { test } from "@playwright/test";
import path from "path";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

const outDir = path.join(__dirname, "..", "qa-screenshots", "pixel-reference");

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const VEHICLE_ID = "22222222-2222-2222-2222-222222222222";
const STAFF_ID = "33333333-3333-3333-3333-333333333333";
const TENANT_ID = "44444444-4444-4444-4444-444444444444";

const mockVehicle = {
  id: VEHICLE_ID,
  plate: "34 ABC 123",
  brand: "BMW",
  model: "5 Serisi",
  year: 2020,
  current_km: 52430,
  next_service_km: 60000,
  next_service_date: "2026-03-12",
  notes: "",
  owner_user_id: OWNER_ID,
  tenant_id: null,
  muayene_tarihi: "2027-03-12",
  trafik_sigortasi_bitis: "2027-01-10",
  kasko_bitis: "2027-01-10",
};
const mockRecords = [
  { id: "r1", vehicle_id: VEHICLE_ID, description: "Motor Yağı", km_at_service: 50000, cost: 1200, service_date: "2026-06-01", created_at: "2026-06-01", tenant_id: TENANT_ID },
  { id: "r2", vehicle_id: VEHICLE_ID, description: "Genel bakım", km_at_service: 42000, cost: null, service_date: "2026-01-15", created_at: "2026-01-15", tenant_id: null },
];
const mockMaintenanceItems = [
  { vehicle_id: VEHICLE_ID, item_key: "motor_yagi", last_service_date: "2026-06-01", last_service_km: 50000, interval_km: 10000 },
];
const mockQrKey = { code: "abc123def456", revoked_at: null, vehicle_id: VEHICLE_ID };

async function setupBireysel(page: any, baseURL: string) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "ali.yilmaz@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: { single: mockVehicle, list: [mockVehicle] },
    maintenance_records: { list: mockRecords },
    maintenance_items: { list: mockMaintenanceItems },
    qr_keys: { single: mockQrKey, list: [mockQrKey] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
}
async function setupServis(page: any, baseURL: string) {
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

test.describe("Referans görsel sadakat seti", () => {
  test("01 Landing", async ({ page }, ti) => {
    const suf = ti.project.name === "mobile-390" ? "mobil" : "desktop";
    await page.goto("/");
    await page.screenshot({ path: path.join(outDir, `01-landing-${suf}.png`), fullPage: ti.project.name !== "mobile-390" });
  });

  test("02 Giriş seçimi", async ({ page }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    await page.goto("/giris");
    await page.getByRole("heading", { name: "Nasıl devam etmek istersiniz?" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "02-giris-secimi-mobil.png"), fullPage: true });
  });

  test("02b Bireysel login", async ({ page }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    await page.goto("/bireysel/giris");
    await page.getByRole("heading", { name: "Bireysel Giriş" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "02b-bireysel-login-mobil.png"), fullPage: true });
  });

  test("02c Servis login", async ({ page }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    await page.goto("/panel/login");
    await page.getByRole("heading", { name: "Servis / İşletme Girişi" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "02c-servis-login-mobil.png"), fullPage: true });
  });

  test("03 Bireysel ana ekran", async ({ page, baseURL }, ti) => {
    await setupBireysel(page, baseURL!);
    await page.goto("/bireysel/araclar");
    await page.getByText("34 ABC 123").waitFor();
    const suf = ti.project.name === "mobile-390" ? "mobil" : "desktop";
    // fullPage:true, sabit (position:fixed) alt navigasyonla birlikte
    // Chromium'un sayfa-birleştirme sürecinde görsel bir tekrar artefaktı
    // üretiyor (gerçek kullanıcı deneyiminde yok) — bu yüzden yalnızca
    // viewport yüksekliği yakalanıyor, referans görseldeki tek-ekran
    // kadrajıyla da tutarlı.
    await page.screenshot({ path: path.join(outDir, `03-bireysel-ana-ekran-${suf}.png`), fullPage: false });
  });

  test("04 Araç detay", async ({ page, baseURL }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    await setupBireysel(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
    await page.getByText("34 ABC 123").first().waitFor();
    await page.screenshot({ path: path.join(outDir, "04-arac-detay-mobil.png"), fullPage: true });
  });

  test("05 Servis hızlı bakım", async ({ page, baseURL }, ti) => {
    await setupServis(page, baseURL!);
    await page.goto(`/panel/araclar/${VEHICLE_ID}`);
    await page.getByText("34 ABC 123").first().waitFor();
    if (ti.project.name === "mobile-390") {
      await page.screenshot({ path: path.join(outDir, "05-servis-hizli-bakim-mobil.png") });
    } else {
      await page.screenshot({ path: path.join(outDir, "10-servis-paneli-desktop.png") });
    }
  });

  test("06 QR/NFC", async ({ page, baseURL }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    await setupBireysel(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}#qr`);
    await page.locator("#qr").waitFor({ state: "visible" });
    await page.locator("#qr").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, "06-qr-nfc-mobil.png") });
  });

  test("07 Araç devret", async ({ page, baseURL }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    await setupBireysel(page, baseURL!);
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
    await page.getByRole("heading", { name: "Aracı Devret / Elden Çıkar" }).waitFor();
    await page.screenshot({ path: path.join(outDir, "07-arac-devret-mobil.png") });
  });

  test("08 Public passport — gerçek verili", async ({ page }, ti) => {
    test.skip(ti.project.name !== "mobile-390", "yalnızca mobil");
    // Public passport hiçbir oturum gerektirmez (herkese açık); yalnızca
    // get_public_vehicle_passport RPC yanıtı mock'lanıyor. Sayfa artık
    // PublicPassportView (components/PublicPassportView.tsx) adlı saf sunum
    // bileşenini render ediyor — gerçek production'da RPC'den gelen veriyle,
    // burada ise fixture veriyle AYNI bileşen kullanılıyor.
    await mockSupabaseRest(page, {
      "rpc/get_public_vehicle_passport": {
        raw: {
          status: "active",
          vehicle: mockVehicle,
          tenant: { name: "Yılmaz Oto Servis", phone: "0312 000 00 00", address: "Çankaya, Ankara" },
          maintenance_records: mockRecords,
          maintenance_items: mockMaintenanceItems,
        },
      },
    });
    await page.goto("/p/demo-kod-000");
    await page.getByText("34 ABC 123").first().waitFor();
    await page.screenshot({ path: path.join(outDir, "08-public-passport-mobil.png"), fullPage: true });
  });
});
