import { test, expect, Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// Bu formdaki <label>/<input> çiftleri `for`/`id` ile ilişkilendirilmemiş
// (düz kardeş öğeler) — getByLabel çalışmaz. Etiketin TAM metnine göre
// (alt-dize çakışması olmadan, ör. "Model" vs "Model Yılı") bir sonraki
// kardeş input'u buluyoruz.
function fieldByLabel(page: Page, exactLabelText: string) {
  return page
    .locator("label")
    .filter({ hasText: new RegExp(`^${exactLabelText}$`) })
    .locator("xpath=following-sibling::input[1]");
}

// OTOİZ — Pilot bugfix 01: "Yeni Araç" formu (bireysel, /bireysel/araclar/yeni)
// Güncel Kilometre / Sonraki Bakım (km) / Sonraki Bakım (tarih) alanları.
// Gerçek component kodu + gerçek Supabase client çağrıları, yalnızca ağ
// katmanı mock'lanıyor (bkz. e2e/fixtures/mockAuth.ts).

const OWNER_ID = "55555555-5555-5555-5555-555555555555";
const CREATED_VEHICLE_ID = "66666666-6666-6666-6666-666666666666";

async function setupNewVehicleForm(page: any, baseURL: string) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "yeni.kullanici@ornek.com" }, baseURL);
  await mockSupabaseRest(page, {
    vehicles: {
      single: {
        id: CREATED_VEHICLE_ID,
        plate: "34 XY 999",
        brand: "Toyota",
        model: "Corolla",
        year: 2020,
        current_km: 52430,
        next_service_km: 60000,
        next_service_date: "2027-03-20",
        owner_user_id: OWNER_ID,
        tenant_id: null,
      },
      list: [],
    },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
  await page.goto("/bireysel/araclar/yeni");
  await page.getByText("Güncel Kilometre").waitFor();
}

test.describe("Bugfix 01 — Yeni Araç formu: Güncel Kilometre / Sonraki Bakım", () => {
  test("1. Güncel Kilometre input ilk açılışta boş", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const kmInput = page.getByPlaceholder("Örn. 52430");
    await expect(kmInput).toHaveValue("");
  });

  test("2. 52430 yazıldığında \"052430\" olmuyor (baştaki sıfır girilse bile temizleniyor)", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const kmInput = page.getByPlaceholder("Örn. 52430");
    // Kullanıcı yanlışlıkla başta bir "0" ile "052430" yazsa bile temizlenmeli.
    await kmInput.pressSequentially("052430");
    await expect(kmInput).toHaveValue("52430");
  });

  test("2b. Normal giriş akışında da hiçbir zaman baştaki sıfır oluşmuyor", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const kmInput = page.getByPlaceholder("Örn. 52430");
    await kmInput.pressSequentially("52430");
    await expect(kmInput).toHaveValue("52430");
  });

  test("2c. Negatif değer girilemiyor (- karakteri süzülüyor)", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const kmInput = page.getByPlaceholder("Örn. 52430");
    await kmInput.pressSequentially("-500");
    await expect(kmInput).toHaveValue("500");
  });

  test("3. Sonraki Bakım (km) ilk açılışta boş", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const nextKmInput = page.getByPlaceholder("Opsiyonel");
    await expect(nextKmInput).toHaveValue("");
  });

  test("4. Sonraki Bakım (tarih) input ilk açılışta boş", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toHaveValue("");
  });

  test("5. 2027-03-20 seçilebiliyor", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill("2027-03-20");
    await expect(dateInput).toHaveValue("2027-03-20");
  });

  test("6. Geçmiş tarih min ile engelleniyor (min = bugün, ISO YYYY-MM-DD)", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    const dateInput = page.locator('input[type="date"]');
    const today = new Date().toISOString().slice(0, 10);
    await expect(dateInput).toHaveAttribute("min", today);
  });

  test("7. Form geçerli değerlerle submit edilebiliyor (Aracı Oluştur → yönlendirme)", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    await fieldByLabel(page, "Plaka").fill("34 XY 999");
    await fieldByLabel(page, "Marka").fill("Toyota");
    await fieldByLabel(page, "Model").fill("Corolla");
    await fieldByLabel(page, "Model Yılı").fill("2020");
    await page.getByPlaceholder("Örn. 52430").pressSequentially("52430");
    await page.getByPlaceholder("Opsiyonel").pressSequentially("60000");
    await page.locator('input[type="date"]').fill("2027-03-20");

    await page.getByRole("button", { name: "Aracı Oluştur" }).click();
    await expect(page).toHaveURL(new RegExp(`/bireysel/araclar/${CREATED_VEHICLE_ID}$`));
  });

  test("8. Boş/geçersiz kilometre ile submit engelleniyor (regresyon: mevcut oluşturma akışı korunuyor)", async ({ page, baseURL }) => {
    await setupNewVehicleForm(page, baseURL!);
    await fieldByLabel(page, "Plaka").fill("34 ZZ 111");
    await fieldByLabel(page, "Marka").fill("Fiat");
    await fieldByLabel(page, "Model").fill("Egea");

    let dialogSeen = false;
    page.once("dialog", async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Aracı Oluştur" }).click();
    await page.waitForTimeout(300);
    expect(dialogSeen, "boş km ile submit uyarı vermeli, sessizce kaydetmemeli").toBe(true);
    // Hâlâ aynı sayfada (yönlendirme olmadı).
    await expect(page).toHaveURL(/\/bireysel\/araclar\/yeni$/);
  });
});
