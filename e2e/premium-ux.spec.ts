import { test, expect, Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ Premium (2026-10-05) — 9 ekranın mobil (375/390/430) ve masaüstü
// duman testi. Gerçek component kodu; yalnız ağ katmanı mock (veri
// tarayıcıda yakalanır, hiçbir gerçek sunucuya istek gitmez).
// SHOT_DIR verilirse her ekranın görüntüsü oraya kaydedilir.

const OWNER_ID = "0be0be00-0000-4000-8000-000000000001";
const VEHICLE_ID = "0be0be00-0000-4000-8000-000000000004";

const vehicle = {
  id: VEHICLE_ID,
  plate: "34 ABC 123",
  brand: "Audi",
  model: "A3",
  year: 2011,
  current_km: 142350,
  next_service_km: 144700,
  next_service_date: "2027-01-05",
  muayene_tarihi: "2027-05-10",
  kasko_bitis: "2027-02-01",
  trafik_sigortasi_bitis: "2027-03-01",
  owner_user_id: OWNER_ID,
  tenant_id: null,
  created_at: "2025-08-01T10:00:00Z",
};

const timeline = {
  total: 5,
  has_more: false,
  rows: [
    { id: "r1", kind: "record", source: "service", event_date: "2026-09-12", km: 142350, title: "Motor Yağı, Yağ Filtresi, Hava Filtresi", service_name: "Akın Oto Servis", revised: false },
    { id: "r2", kind: "record", source: "owner", event_date: "2026-06-03", km: 135200, title: "Ön Fren Balatası", revised: false },
    { id: "r3", kind: "record", source: "service", event_date: "2025-09-20", km: 128400, title: "Motor Yağı, Yağ Filtresi, Polen Filtresi, Buji", service_name: "Akın Oto Servis", revised: false },
    { id: "q1", kind: "qr_linked", source: "system", event_date: "2025-08-02", km: null, title: "OTOİZ anahtarlık bağlandı", revised: false },
    { id: VEHICLE_ID, kind: "vehicle_created", source: "system", event_date: "2025-08-01", km: null, title: "Araç OTOİZ'e eklendi", revised: false },
  ],
};

const items = [
  { vehicle_id: VEHICLE_ID, item_key: "motor_yagi", interval_km: 10000, interval_months: 12, last_service_km: 142350, last_service_date: "2026-09-12" },
  { vehicle_id: VEHICLE_ID, item_key: "polen_filtresi", interval_km: 14000, interval_months: null, last_service_km: 128400, last_service_date: "2025-09-20" },
  { vehicle_id: VEHICLE_ID, item_key: "fren_on_balata", interval_km: 30000, interval_months: null, last_service_km: 135200, last_service_date: "2026-06-03" },
];

const docs = [
  { id: "d1", vehicle_id: VEHICLE_ID, doc_type: "fatura", doc_date: "2026-09-12", note: "Akın Oto Servis", file_name: "fatura.pdf", mime_type: "application/pdf", size_bytes: 182000, created_at: "2026-09-12T10:00:00Z", own: true },
  { id: "d2", vehicle_id: VEHICLE_ID, doc_type: "servis_fisi", doc_date: "2026-09-12", note: null, file_name: "fis.jpg", mime_type: "image/jpeg", size_bytes: 920000, created_at: "2026-09-12T10:00:00Z", own: true },
  { id: "d3", vehicle_id: VEHICLE_ID, doc_type: "muayene", doc_date: "2025-05-10", note: null, file_name: "muayene.pdf", mime_type: "application/pdf", size_bytes: 120000, created_at: "2025-05-10T10:00:00Z", own: true },
  { id: "d4", vehicle_id: VEHICLE_ID, doc_type: "kasko", doc_date: "2026-02-01", note: null, file_name: "kasko.pdf", mime_type: "application/pdf", size_bytes: 300000, created_at: "2026-02-01T10:00:00Z", own: true },
];

async function setup(page: Page, baseURL: string) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "ayse@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: { single: vehicle, list: [vehicle] },
    maintenance_items: { list: items },
    maintenance_records: { list: [{ id: "m0", service_date: "2025-05-10", description: "Muayene" }] },
    qr_keys: { single: { code: "7gs9cqmxhqmy" }, list: [{ code: "7gs9cqmxhqmy", revoked_at: null }] },
    "rpc/vehicle_timeline": { raw: timeline },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
  await page.route("**/api/belgeler?**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: docs }) }));
  await page.route("**/api/belgeler/baglanti", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ urls: Object.fromEntries(docs.map((d) => [d.id, `https://imzali.invalid/${d.id}`])) }) })
  );
}

async function noHorizontalOverflow(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, "yatay taşma").toBeLessThanOrEqual(iw);
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true, animations: "disabled" });
}

const WIDTHS = [375, 390, 430];

for (const w of WIDTHS) {
  test.describe(`Premium ${w}px`, () => {
    test.use({ viewport: { width: w, height: 844 }, hasTouch: true, isMobile: true });

    test(`1-2 landing ve giriş (${w})`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Aracınızın geçmişi kaybolmaz." })).toBeVisible();
      await expect(page.getByTestId("landing-bireysel")).toBeVisible();
      await expect(page.getByTestId("landing-servis")).toBeVisible();
      for (const v of ["Bakım Geçmişi", "Belgeler", "Yaklaşan Bakımlar", "Güvenli Devir"]) await expect(page.getByRole("heading", { name: v })).toBeVisible();
      await noHorizontalOverflow(page);
      await shot(page, `${w}-1-landing`);

      await page.goto("/giris?next=%2Fp%2Fabc123");
      await expect(page.getByText("Aracınızın dijital geçmişi")).toBeVisible();
      await expect(page.getByTestId("giris-bireysel")).toHaveAttribute("href", "/bireysel/giris?next=%2Fp%2Fabc123");
      await expect(page.getByTestId("giris-servis")).toHaveAttribute("href", "/panel/login");
      await noHorizontalOverflow(page);
      await shot(page, `${w}-2-giris`);
    });

    test(`3-8 dijital kokpit ve bölümler (${w})`, async ({ page, baseURL }) => {
      await setup(page, baseURL!);
      await page.goto("/bireysel/araclar");
      await expect(page.getByTestId("aktif-plaka")).toHaveText("34 ABC 123");
      await expect(page.getByText("Audi A3 • 2011")).toBeVisible();
      await expect(page.getByTestId("aktif-km")).toContainText("142.350");
      await expect(page.getByTestId("durum-son-servis")).toContainText("12.09.2026");
      await expect(page.getByTestId("durum-muayene")).toContainText("ay kaldı");
      await expect(page.getByTestId("kart-yaklasan")).toContainText("2.350 km kaldı");
      await expect(page.getByTestId("kart-belgeler")).toContainText("4 belge kayıtlı");
      await expect(page.getByTestId("aracinizin-gecmisi").getByText("12 Eylül 2026")).toBeVisible();
      await expect(page.getByTestId("aracinizin-gecmisi").getByText("Servis Doğrulamalı").first()).toBeVisible();
      await expect(page.getByTestId("alt-gezinme").getByRole("button")).toHaveCount(5);
      await noHorizontalOverflow(page);
      await shot(page, `${w}-3-kokpit`);

      // 4 Bakım geçmişi + filtre
      await page.getByTestId("tumunu-gor").click();
      await expect(page).toHaveURL(/bolum=bakim/);
      await expect(page.getByTestId("zaman-olay")).toHaveCount(5);
      await page.getByRole("button", { name: "Servis", exact: true }).click();
      await expect(page.getByTestId("zaman-olay")).toHaveCount(2);
      await page.getByRole("button", { name: "Kullanıcı", exact: true }).click();
      await expect(page.getByTestId("zaman-olay")).toHaveCount(1);
      await page.getByRole("button", { name: "Tümü", exact: true }).click();
      await noHorizontalOverflow(page);
      await shot(page, `${w}-4-bakim`);

      // 5 Belgeler + filtre + imzalı bağlantı
      await page.getByTestId("alt-gezinme").getByRole("button", { name: "Belgeler" }).click();
      await expect(page.getByTestId("belge-satir")).toHaveCount(4);
      await page.getByRole("button", { name: "Fatura", exact: true }).click();
      await expect(page.getByTestId("belge-satir")).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Fatura görüntüle" })).toHaveAttribute("href", "https://imzali.invalid/d1");
      await page.getByRole("button", { name: "Diğer", exact: true }).first().click();
      await expect(page.getByTestId("belge-satir")).toHaveCount(2);
      await page.getByRole("button", { name: "Tümü", exact: true }).click();
      await noHorizontalOverflow(page);
      await shot(page, `${w}-5-belgeler`);

      // 6 Yaklaşan bakımlar (tam ekran, geri oku, gerçek veri)
      await page.getByTestId("alt-gezinme").getByRole("button", { name: "Ana Sayfa" }).click();
      await page.getByTestId("kart-yaklasan").click();
      await expect(page).toHaveURL(/bolum=yaklasan/);
      const up = page.getByTestId("yaklasan-pencere");
      await expect(up).toBeVisible();
      await expect(up.getByText("2.350 km", { exact: true })).toBeVisible();
      await expect(up.getByText("sonra bakım")).toBeVisible();
      await expect(up.getByText(/Yaklaşık \d+ ay/)).toBeVisible();
      await expect(up.getByRole("heading", { name: "Önerilen Bakımlar" })).toBeVisible();
      await expect(up.getByText("Polen Filtresi")).toBeVisible();
      await noHorizontalOverflow(page);
      await shot(page, `${w}-6-yaklasan`);
      await page.getByRole("button", { name: "Geri" }).click();
      await expect(page.getByTestId("aktif-plaka")).toBeVisible();

      // 7 Muayene
      await page.getByTestId("kart-muayene").click();
      await expect(page).toHaveURL(/bolum=muayene/);
      const mu = page.getByTestId("muayene-pencere");
      await expect(mu.getByText("10 Mayıs 2027")).toBeVisible();
      await expect(mu.getByText("10 Mayıs 2025")).toBeVisible();
      await expect(mu.getByTestId("muayene-rapor")).toHaveAttribute("href", "https://imzali.invalid/d3");
      await noHorizontalOverflow(page);
      await shot(page, `${w}-7-muayene`);
      await page.getByRole("button", { name: "Geri" }).click();

      // 8 Aracım
      await page.getByTestId("kart-aracim").click();
      await expect(page).toHaveURL(/bolum=aracim/);
      await expect(page.getByTestId("arac-bilgileri").getByText("Audi")).toBeVisible();
      await expect(page.getByTestId("arac-bilgileri").getByText("142.350 km")).toBeVisible();
      await noHorizontalOverflow(page);
      await shot(page, `${w}-8-aracim`);
      await page.getByTestId("qr-goruntule").click();
      await expect(page.getByTestId("qr-pencere").getByTestId("anahtarlik-durum")).toHaveText("Aktif");
      await page.getByTestId("qr-pencere").getByRole("button", { name: "Kapat" }).click();

      // Diğer
      await page.getByTestId("alt-gezinme").getByRole("button", { name: "Diğer" }).click();
      await expect(page.getByRole("link", { name: "Bildirimler" })).toBeVisible();
      await noHorizontalOverflow(page);
      await shot(page, `${w}-diger`);
    });

    test(`9 araç devri (${w})`, async ({ page, baseURL }) => {
      await setup(page, baseURL!);
      await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
      await expect(page.getByRole("heading", { name: "Aracınızı Güvenle Devredin" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Devir İşlemini Başlat" })).toBeDisabled();
      for (const t of ["Yeni sahibi davet edin", "Devredilecek belgeleri seçin", "Güvenli devri tamamlayın"]) await expect(page.getByText(t)).toBeVisible();
      await expect(page.getByTestId("devir-belge-satir")).toHaveCount(4);
      await expect(page.getByTestId("devir-belge-sayac")).toHaveText("0 belge seçildi");
      await noHorizontalOverflow(page);
      await shot(page, `${w}-9-devir`);
    });
  });
}

test.describe("Premium masaüstü", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("kokpit masaüstünde ortalanır, alt çubuk yerine üst gezinme", async ({ page, baseURL }) => {
    await setup(page, baseURL!);
    await page.goto("/bireysel/araclar");
    await expect(page.getByTestId("aktif-plaka")).toBeVisible();
    await expect(page.getByTestId("alt-gezinme")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Masaüstü gezinme" })).toBeVisible();
    const box = await page.getByTestId("arac-kimligi").boundingBox();
    expect(box!.x).toBeGreaterThan(100);
    await noHorizontalOverflow(page);
    await shot(page, "desktop-3-kokpit");
    await page.goto("/");
    await shot(page, "desktop-1-landing");
    await page.goto("/giris");
    await shot(page, "desktop-2-giris");
    await page.goto("/bireysel/araclar?bolum=bakim");
    await expect(page.getByTestId("zaman-olay").first()).toBeVisible();
    await shot(page, "desktop-4-bakim");
    await page.goto("/bireysel/araclar?bolum=aracim");
    await shot(page, "desktop-8-aracim");
    for (const v of ["belgeler", "yaklasan", "muayene"]) {
      await page.goto(`/bireysel/araclar?bolum=${v}`);
      await noHorizontalOverflow(page);
      await shot(page, `desktop-${v}`);
    }
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
    await shot(page, "desktop-9-devir");
  });
});
