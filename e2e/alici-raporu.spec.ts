import { test, expect } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// Alıcı Raporu — public buyer view sunum testleri (offline mock).
const RAPOR = {
  vehicle: {
    plate: "34 QR 001",
    brand: "Renault",
    model: "Clio",
    year: 2020,
    current_km: 52430,
    next_service_km: 62430,
    next_service_date: "2027-03-20",
    muayene_tarihi: "2026-12-15",
    kasko_bitis: "2026-10-30",
    trafik_sigortasi_bitis: "2026-10-30",
  },
  stats: { total: 3, servis: 2, bireysel: 1 },
  last: { date: "2026-03-20", km: 52430, items: "Motor Yağı, Yağ Filtresi", source: "servis" },
  chronology: [
    { date: "2026-03-20", km: 52430, items: "Motor Yağı, Yağ Filtresi", source: "servis" },
    { date: "2026-01-10", km: 48000, items: "Hava Filtresi", source: "bireysel" },
  ],
  passportActive: true,
};

test("Alıcı Raporu: public buyer view premium render, kaynak ayrımı ve sızıntı yok", async ({ page }) => {
  await page.route((url) => url.pathname.startsWith("/api/alici-raporu/rapor"), async (route) => {
    const url = new URL(route.request().url());
    const token = url.searchParams.get("token");
    if (token === "expired-token") {
      await route.fulfill({ status: 410, contentType: "application/json", body: `{"error":"expired"}` });
      return;
    }
    if (token === "revoked-token") {
      await route.fulfill({ status: 410, contentType: "application/json", body: `{"error":"revoked"}` });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RAPOR) });
  });

  await page.goto("/alici/valid-token-mock");
  await expect(page.getByText("Otoiz Alıcı Raporu", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "34 QR 001" })).toBeVisible();
  await expect(page.getByText(/3 kayıt · 2 servis doğrulamalı · 1 bireysel kayıt/)).toBeVisible();
  await expect(page.getByText("SERVİS DOĞRULAMALI ✓").first()).toBeVisible();
  await expect(page.getByText("ARAÇ SAHİBİ KAYDI").first()).toBeVisible();
  await expect(page.getByText("OTOİZ Alıcı Raporu, sisteme kaydedilmiş bakım ve araç bilgilerini gösterir.")).toBeVisible();
  // Gizlilik: private alanlar buyer DOM'unda görünmez.
  await expect(page.getByText(/owner_user_id|activation|token/i)).toHaveCount(0);
});

test("Araç detay: Alıcıya Göster CTA'sı görünür ve açılır", async ({ page, baseURL }) => {
  const VEHICLE_ID = "cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  await installMockSession(page.context(), { id: "cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb", email: "sahip@ornek.com" }, baseURL!);
  await mockSupabaseRest(page, {
    vehicles: { single: { id: VEHICLE_ID, plate: "34 AG 001", brand: "Renault", model: "Clio", year: 2020, current_km: 52430, owner_user_id: "cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, list: [] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: null, list: [] },
  });
  await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
  const btn = page.getByRole("button", { name: /Alıcıya Göster/ }).first();
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByTestId("aliciya-goster")).toBeVisible();
  await expect(page.getByRole("button", { name: "QR ile Paylaş", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF Oluştur", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "E-posta ile Gönder", exact: true })).toBeVisible();
});

test("Alıcı Raporu: süresi dolmuş paylaşım 410 ekranına düşer", async ({ page }) => {
  await page.route((url) => url.pathname.startsWith("/api/alici-raporu/rapor"), async (route) => {
    await route.fulfill({ status: 410, contentType: "application/json", body: `{"error":"expired"}` });
  });
  await page.goto("/alici/expired-token");
  await expect(page.getByRole("heading", { name: "Paylaşım Süresi Doldu" })).toBeVisible();
});
