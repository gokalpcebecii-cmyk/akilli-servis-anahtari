import { test, expect } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// PILOT FIX 03 (bölüm G): erişilebilirlik/duyarlı tasarım kapısı —
// spec'te açıkça istenen mobil genişlikler (360/390/430px) VE masaüstü
// boyutları (768×1024, 1024×768, 1440×900) için sıfır yatay taşma
// doğrulaması. Yalnızca desktop-chromium projesinde çalışır (viewport'u
// kendi test içinde değiştiriyoruz, proje viewport'undan bağımsız).

const OWNER_ID = "77777777-7777-7777-7777-777777777777";
const VEHICLE_ID = "88888888-8888-8888-8888-888888888888";
const STAFF_ID = "99999999-9999-9999-9999-999999999999";
const TENANT_ID = "10101010-1010-1010-1010-101010101010";

const mockVehicle = {
  id: VEHICLE_ID,
  plate: "34 RSP 001",
  brand: "Renault",
  model: "Clio",
  year: 2019,
  current_km: 48000,
  next_service_km: 58000,
  next_service_date: "2026-11-01",
  notes: "",
  owner_user_id: OWNER_ID,
  tenant_id: null,
};

async function setupBireyselAuth(page: any, baseURL: string) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "matris@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: { single: mockVehicle, list: [mockVehicle] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: null, list: [] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
}

async function setupServisAuth(page: any, baseURL: string) {
  await installMockSession(page.context(), { id: STAFF_ID, email: "matris.servis@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: { single: { ...mockVehicle, tenant_id: TENANT_ID, owner_user_id: null }, list: [mockVehicle] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: null, list: [] },
    staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
    tenants: { single: { id: TENANT_ID, name: "Matris Test Servis", phone: "0312 000 00 00", address: "Test, Ankara" } },
  });
}

const VIEWPORTS = [
  { label: "mobil 360px", width: 360, height: 800 },
  { label: "mobil 390px", width: 390, height: 844 },
  { label: "mobil 430px", width: 430, height: 932 },
  { label: "tablet dikey 768x1024", width: 768, height: 1024 },
  { label: "tablet yatay 1024x768", width: 1024, height: 768 },
  { label: "masaüstü 1440x900", width: 1440, height: 900 },
];

const PAGES: { label: string; path: string; setup?: (page: any, baseURL: string) => Promise<void>; wait: (page: any) => Promise<unknown> }[] = [
  { label: "Ana sayfa", path: "/", wait: (p) => p.getByText("OTOİZ").first().waitFor() },
  { label: "Giriş seçimi", path: "/giris", wait: (p) => p.getByText("Bireysel").first().waitFor() },
  { label: "Bireysel giriş", path: "/bireysel/giris", wait: (p) => p.getByText("Bireysel Giriş").waitFor() },
  { label: "Servis giriş", path: "/panel/login", wait: (p) => p.getByText("Servis / İşletme Girişi").waitFor() },
  { label: "Bireysel kayıt", path: "/bireysel/kayit", wait: (p) => p.getByText("Bireysel Kayıt").waitFor() },
  { label: "404", path: "/olmayan-bir-sayfa-xyz", wait: (p) => p.getByText("Sayfa Bulunamadı").waitFor() },
  {
    label: "Bireysel araçlarım",
    path: "/bireysel/araclar",
    setup: setupBireyselAuth,
    wait: (p) => p.getByText("34 RSP 001").first().waitFor(),
  },
  {
    label: "Bireysel araç detay",
    path: `/bireysel/araclar/${VEHICLE_ID}`,
    setup: setupBireyselAuth,
    wait: (p) => p.getByText("34 RSP 001").first().waitFor(),
  },
  {
    label: "Bireysel yeni araç",
    path: "/bireysel/araclar/yeni",
    setup: setupBireyselAuth,
    wait: (p) => p.getByText("Güncel Kilometre").waitFor(),
  },
  {
    label: "Servis panel araç detay",
    path: `/panel/araclar/${VEHICLE_ID}`,
    setup: setupServisAuth,
    wait: (p) => p.getByText("34 RSP 001").first().waitFor(),
  },
];

test.describe("PILOT FIX 03 (bölüm G) — duyarlı tasarım matrisi: sıfır yatay taşma", () => {
  for (const vp of VIEWPORTS) {
    for (const pg of PAGES) {
      test(`${pg.label} — ${vp.label} — yatay taşma yok`, async ({ page, baseURL }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-chromium", "matris kendi viewport'unu ayarlıyor, tek projede yeterli");
        await page.setViewportSize({ width: vp.width, height: vp.height });
        if (pg.setup) await pg.setup(page, baseURL!);
        await page.goto(pg.path);
        await pg.wait(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(overflow, `${pg.label} (${vp.width}px) yatay taşmamalı`).toBe(false);
      });
    }
  }
});
