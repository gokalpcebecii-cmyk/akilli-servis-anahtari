import { test, expect, Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ E–H — devir ekranında seçimli belge aktarımı (gerçek component kodu;
// yalnız ağ katmanı mock). Yetki kontrolünün asıl testi veritabanında:
// tests/belgeDevri.test.js + supabase/tests/belge_devri_eh.sql.

const OWNER_ID = "e4e4e4e4-0000-4000-8000-000000000001";
const BUYER_ID = "e4e4e4e4-0000-4000-8000-000000000002";
const VEHICLE_ID = "e4e4e4e4-0000-4000-8000-000000000004";
const DOC_A = "e4e4e4e4-0000-4000-8000-0000000000d1";
const DOC_B = "e4e4e4e4-0000-4000-8000-0000000000d2";

const vehicle = { id: VEHICLE_ID, plate: "34 EH 001", brand: "Renault", model: "Clio", owner_user_id: OWNER_ID, tenant_id: null };
const docs = [
  { id: DOC_A, vehicle_id: VEHICLE_ID, doc_type: "servis_fisi", doc_date: "2026-09-01", note: null, file_name: "servis.pdf", mime_type: "application/pdf", size_bytes: 1000, created_at: "2026-09-01T10:00:00Z", own: true },
  { id: DOC_B, vehicle_id: VEHICLE_ID, doc_type: "fatura", doc_date: "2026-08-01", note: "kişisel", file_name: "fatura.pdf", mime_type: "application/pdf", size_bytes: 1000, created_at: "2026-08-01T10:00:00Z", own: true },
];

async function setupDevret(page: Page, baseURL: string, list: unknown[]) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "eh.sahip@ornek.com" }, baseURL);
  await mockSupabaseRest(page, { vehicles: { single: vehicle, list: [vehicle] } });
  const apiCalls: string[] = [];
  await page.route("**/api/belgeler?**", async (route) => {
    apiCalls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: list }) });
  });
  const rpc: any[] = [];
  await page.route("**/rest/v1/rpc/initiate_ownership_transfer", async (route) => {
    rpc.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "tok-eh", expires_at: "2026-10-08T10:00:00Z", document_count: rpc[0].p_document_ids.length }) });
  });
  await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
  await page.getByRole("heading", { name: "Aracı Devret / Elden Çıkar" }).waitFor();
  return { apiCalls, rpc };
}

test.describe("E–H devir ekranı belge seçimi", () => {
  test("E1: A ve B belgeli araç — liste gerçek API'den, varsayılan seçili sayısı 0", async ({ page, baseURL }) => {
    const { apiCalls } = await setupDevret(page, baseURL!, docs);
    await expect(page.getByRole("heading", { name: "Yeni sahibine aktarmak istediğiniz belgeler" })).toBeVisible();
    await expect(page.getByText("Belgeleriniz otomatik olarak aktarılmaz. Yalnızca seçtikleriniz yeni araç sahibine devredilir.")).toBeVisible();
    await expect(page.getByTestId("devir-belge-satir")).toHaveCount(2);
    await expect(page.getByTestId("devir-belge-secim").and(page.locator(":checked"))).toHaveCount(0);
    await expect(page.getByTestId("devir-belge-sayac")).toHaveText("0 belge seçildi");
    expect(apiCalls.some((u) => u.includes(`vehicle_id=${VEHICLE_ID}`))).toBe(true);
  });

  test("E2: yalnız A seçilir — RPC'ye yalnız A'nın kimliği gider", async ({ page, baseURL }) => {
    const { rpc } = await setupDevret(page, baseURL!, docs);
    await page.getByTestId("devir-belge-secim").nth(0).check();
    await expect(page.getByTestId("devir-belge-sayac")).toHaveText("1 belge seçildi");
    await page.getByText(/devri başlatmayı onaylıyorum/).click();
    await page.getByRole("button", { name: "Devri Başlat" }).click();
    await expect(page.getByRole("heading", { name: "Devir Başlatıldı" })).toBeVisible();
    expect(rpc).toEqual([{ p_vehicle_id: VEHICLE_ID, p_document_ids: [DOC_A] }]);
  });

  test("Belge yoksa: 'Bu araç için aktarılabilir belge bulunmuyor.' ve devir belgesiz başlar", async ({ page, baseURL }) => {
    const { rpc } = await setupDevret(page, baseURL!, []);
    await expect(page.getByTestId("devir-belge-yok")).toHaveText("Bu araç için aktarılabilir belge bulunmuyor.");
    await page.getByText(/devri başlatmayı onaylıyorum/).click();
    await page.getByRole("button", { name: "Devri Başlat" }).click();
    await expect(page.getByRole("heading", { name: "Devir Başlatıldı" })).toBeVisible();
    expect(rpc).toEqual([{ p_vehicle_id: VEHICLE_ID, p_document_ids: [] }]);
  });

  test("SECURITY: sunucu geçersiz belge kimliğini reddederse devir oluşmaz, anlaşılır mesaj", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: OWNER_ID, email: "eh.sahip@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, { vehicles: { single: vehicle, list: [vehicle] } });
    await page.route("**/api/belgeler?**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: docs }) }));
    await page.route("**/rest/v1/rpc/initiate_ownership_transfer", (r) =>
      r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "invalid_document" }) })
    );
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
    await page.getByTestId("devir-belge-secim").nth(0).check();
    await page.getByText(/devri başlatmayı onaylıyorum/).click();
    await page.getByRole("button", { name: "Devri Başlat" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("erişiminiz yok");
    await expect(page.getByRole("heading", { name: "Devir Başlatıldı" })).toHaveCount(0);
  });
});

test.describe("E–H devir kabul ekranı", () => {
  test("H2: alıcı devri reddedebilir (reject RPC), belge sayısı yalnız sayı olarak görünür", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: BUYER_ID, email: "eh.alici@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      "rpc/preview_ownership_transfer": { raw: { plate: "34 EH 001", brand: "Renault", model: "Clio", current_km: 1000, own_transfer: false, document_count: 1 } },
    });
    const calls: any[] = [];
    await page.route("**/rest/v1/rpc/reject_ownership_transfer", async (route) => {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/bireysel/devir-kabul/tok-eh-0000000000000000000000000000000000000000");
    await expect(page.getByText(/paylaşmayı seçtiği 1 belge/)).toBeVisible();
    await page.getByTestId("devir-reddet").click();
    await expect(page.getByRole("heading", { name: "Devir Reddedildi" })).toBeVisible();
    expect(calls).toEqual([{ p_token: "tok-eh-0000000000000000000000000000000000000000" }]);
  });
});
