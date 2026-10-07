import { test, expect, Page } from "@playwright/test";
import { installMockSession } from "./fixtures/mockAuth";

// OTOİZ Hızlı İşlem Alanı: tek "Hızlı İşlemler" kartı → "İşlem Ekle" alt
// penceresi → 4 işlem. Gerçek component kodu; yalnız ağ katmanı mock. Yazma
// istekleri (depolama dahil) yakalanır, hiçbir yere gitmez.

const OWNER_ID = "a0a0a0a0-0000-4000-8000-000000000001";
const STAFF_ID = "a0a0a0a0-0000-4000-8000-000000000002";
const TENANT_ID = "a0a0a0a0-0000-4000-8000-000000000003";
const VID = "a0a0a0a0-0000-4000-8000-000000000004";
const VID2 = "a0a0a0a0-0000-4000-8000-000000000005";

function istToday(offsetDays = 0) {
  return new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

const V1 = {
  id: VID,
  plate: "34 NUX 001",
  brand: "Volkswagen",
  model: "Passat",
  year: 2019,
  current_km: 84200,
  next_service_km: 94200, // araç eklenirken kayıt gününden hesaplanan plan
  next_service_date: istToday(365),
  trafik_sigortasi_bitis: istToday(-3),
  kasko_bitis: istToday(18),
  muayene_tarihi: null,
  owner_user_id: OWNER_ID,
  tenant_id: null,
  notes: "",
};
const V2 = { ...V1, id: VID2, plate: "06 NUX 002", brand: "Fiat", model: "Egea", next_service_km: null, next_service_date: null, trafik_sigortasi_bitis: null, kasko_bitis: null };

type Writes = { method: string; table: string; body: any }[];

async function mockAll(page: Page, opts: { vehicles?: any[]; qr?: boolean; records?: any[]; timeline?: any[]; role?: "owner" | "servis"; docs?: any[] } = {}) {
  const vehicles = opts.vehicles ?? [V1, V2];
  const writes: Writes = [];
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = (url.pathname.split("/rest/v1/")[1] ?? "").split("?")[0];
    const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const j = (b: any, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "content-range": "0-0/1" }, body: JSON.stringify(b) });
    if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "*/2" }, body: "" });
    if (!["GET", "HEAD"].includes(req.method()) && !table.startsWith("rpc/")) {
      writes.push({ method: req.method(), table, body: req.postDataJSON() });
      return j(single ? {} : []);
    }
    if (table === "rpc/vehicle_timeline") {
      const rows = opts.timeline ?? [];
      return j({ rows, has_more: false, total: rows.length });
    }
    if (table === "rpc/record_service_visit") {
      writes.push({ method: "RPC", table, body: req.postDataJSON() });
      return j({ ok: true, record_id: "x", service_verified: true });
    }
    if (table.startsWith("rpc/")) return j([]);
    if (table === "vehicles") {
      const idm = url.searchParams.get("id");
      let v = idm ? vehicles.find((x) => `eq.${x.id}` === idm) : null;
      if (v && opts.role === "servis") v = { ...v, tenant_id: TENANT_ID, owner_user_id: null };
      return j(single ? v ?? null : v ? [v] : vehicles);
    }
    if (table === "qr_keys") return j(single ? (opts.qr ? { code: "nux1code" } : null) : opts.qr ? [{ code: "nux1code", revoked_at: null }] : []);
    if (table === "maintenance_records") return j(single ? null : opts.records ?? []);
    if (table === "maintenance_items") return j([]);
    if (table === "vehicle_documents") return j(opts.docs ?? []);
    if (table === "staff_users") return j(single ? { id: STAFF_ID, tenant_id: TENANT_ID, role: "owner" } : [{ id: STAFF_ID, tenant_id: TENANT_ID, role: "owner" }]);
    if (table === "tenants") return j(single ? { id: TENANT_ID, name: "Güven Oto", approval_status: "approved" } : []);
    return j(single ? null : []);
  });
  await page.route("**/storage/v1/object/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.includes("/object/sign/")) {
      const body = req.postDataJSON() ?? {};
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify((body.paths ?? []).map((p: string) => ({ path: p, signedURL: `/object/sign/vehicle-documents/${p}?token=t`, error: null }))) });
    }
    writes.push({ method: "UPLOAD", table: "storage", body: { path: url.pathname.split("/object/")[1], contentType: req.headers()["content-type"] } });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "x", Id: "y" }) });
  });
  // E–H: belge listesi ve imzalı bağlantı sunucu API'sinden gelir (RLS + sunucuda imza).
  await page.route("**/api/belgeler?**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: (opts.docs ?? []).map((d: any) => ({ ...d, own: d.own ?? true })) }) })
  );
  await page.route("**/api/belgeler/baglanti", (r) => {
    const ids: string[] = r.request().postDataJSON()?.document_ids ?? [];
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ urls: Object.fromEntries(ids.map((id) => [id, `/object/sign/vehicle-documents/${id}?token=t`])), expires_in: 900 }) });
  });
  await page.route("**/api/bireysel/qr", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ codes: [] }) }));
  return writes;
}

async function asOwner(page: Page, baseURL: string) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "nux@ornek.com" }, baseURL);
}

async function noOverflow(page: Page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o, "yatay taşma").toBeLessThanOrEqual(0);
}

const visible = (page: Page, id: string) => page.getByTestId(id).locator("visible=true");

const PDF = { name: "servis-faturasi.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% otoiz test\n") };

async function openHub(page: Page) {
  await page.getByTestId("arac-durumu").waitFor();
  await visible(page, "hizli-islemler").getByTestId("islem-ekle").click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("heading", { name: "Ne eklemek istiyorsunuz?" })).toBeVisible();
  return dlg;
}

test.describe("Hızlı İşlem Alanı — kart ve alt pencere", () => {
  test("kart: başlık, açıklama, tek ana düğme, ikincil geçmiş satırı; durum kartlarının altında; dokunma alanları ≥52 px", async ({ page, baseURL }, info) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    const qa = visible(page, "hizli-islemler");
    await expect(qa.getByRole("heading", { name: "Hızlı İşlemler" })).toBeVisible();
    await expect(qa).toContainText("Bakım, kilometre, belge ve önemli tarihleri buradan kolayca yönetin.");
    await expect(qa.getByTestId("islem-ekle")).toHaveText("İşlem Ekle");
    await expect(qa.getByTestId("gecmis-islem-kisayol")).toContainText("Son 12 aya ait bir işlem eklemek ister misiniz?");
    await expect(qa.getByTestId("gecmis-islem-kisayol")).toContainText("Geçmiş İşlem Ekle");
    for (const b of await qa.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    const radiusPx = await qa.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radiusPx).toBe("18px");
    const q = (await qa.boundingBox())!;
    const dates = (await page.getByTestId("durum-muayene").boundingBox())!;
    const head = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(head.y).toBeLessThan(q.y);
    if (info.project.name !== "desktop-chromium") expect(dates.y).toBeLessThan(q.y);
    await noOverflow(page);
  });

  test("İşlem Ekle → 'Ne eklemek istiyorsunuz?' + 4 seçenek (ikon, başlık, açıklama); mobil tek sütun, masaüstü düzenli ızgara", async ({ page, baseURL }, info) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    const dlg = await openHub(page);
    const opts = dlg.getByRole("listitem");
    await expect(opts).toHaveCount(4);
    await page.waitForTimeout(400); // açılış animasyonu bitsin
    const expected = [
      ["Bakım Kaydı Ekle", "Yapılan bakım işlemlerini kaydedin."],
      ["KM Güncelle", "Aracın güncel kilometresini yazın."],
      ["Belge Ekle", "Fatura, servis fişi veya diğer belgeleri yükleyin."],
      ["Tarihleri Güncelle", "Muayene, kasko ve trafik sigortası tarihlerini güncelleyin."],
    ];
    const boxes = [];
    for (let i = 0; i < 4; i++) {
      await expect(opts.nth(i)).toContainText(expected[i][0]);
      await expect(opts.nth(i)).toContainText(expected[i][1]);
      await expect(opts.nth(i).locator("svg").first()).toBeVisible();
      const b = (await opts.nth(i).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(52);
      boxes.push(b);
    }
    if (info.project.name === "desktop-chromium") {
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2); // 2×2
      expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
    } else {
      for (let i = 1; i < 4; i++) {
        expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThan(1); // tek sütun
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
      }
      const panel = (await dlg.boundingBox())!;
      const vp = page.viewportSize()!;
      expect(Math.round(panel.y + panel.height)).toBe(vp.height); // alttan açılır
    }
    // her seçenek kendi formunu açar; Geri menüye döner
    const forms = [["form-bakim", "Bakım Kaydını Ekle"], ["form-km", "Kilometreyi Güncelle"], ["form-belge", "Belgeyi Ekle"], ["form-tarih", "Tarihleri Kaydet"]];
    for (let i = 0; i < 4; i++) {
      await opts.nth(i).click();
      await expect(dlg.getByRole("heading", { name: expected[i][0] })).toBeVisible();
      await expect(dlg.getByTestId(forms[i][0])).toBeVisible();
      await expect(dlg.getByRole("button", { name: forms[i][1] })).toBeVisible();
      expect((await dlg.getByRole("button", { name: forms[i][1] }).boundingBox())!.height).toBeGreaterThanOrEqual(52);
      await dlg.getByRole("button", { name: "Geri" }).click();
      await expect(dlg.getByRole("heading", { name: "Ne eklemek istiyorsunuz?" })).toBeVisible();
    }
    await dlg.getByRole("button", { name: "Kapat" }).click();
    await expect(dlg).toHaveCount(0);
    await noOverflow(page);
  });
});

test.describe("Hızlı İşlem Alanı — mini akışlar", () => {
  test("Bakım: brifteki işlem listesi; periyodik olmayan işlem mevcut sonraki bakımı korur", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    const dlg = await openHub(page);
    await dlg.getByRole("listitem").filter({ hasText: "Bakım Kaydı Ekle" }).click();
    const grid = dlg.getByTestId("islem-izgarasi");
    await expect(grid.getByRole("button")).toHaveText(["Motor Yağı", "Yağ Filtresi", "Hava Filtresi", "Polen Filtresi", "Yakıt Filtresi", "Fren Balatası", "Fren Diski", "Akü", "Antifriz", "Şanzıman Yağı", "Buji", "Triger", "Lastik", "Diğer"]);
    await expect(dlg.locator("#qa-bakim-km")).toHaveValue("84.200");
    // işlem seçmeden kaydet → uyarı, yazma yok
    await dlg.getByRole("button", { name: "Bakım Kaydını Ekle" }).click();
    await expect(dlg.getByRole("alert")).toContainText("En az bir işlem");
    expect(writes).toEqual([]);
    await grid.getByRole("button", { name: "Akü", exact: true }).click();
    await expect(dlg.getByTestId("sonraki-bakim-onerisi")).toHaveCount(0);
    await dlg.getByRole("button", { name: "Bakım Kaydını Ekle" }).click();
    await expect.poll(() => writes.filter((w) => w.table === "rpc/record_service_visit").length).toBe(1);
    const v = writes.find((w) => w.table === "rpc/record_service_visit")!.body;
    expect(v).toMatchObject({ p_km: 84200, p_next_km: 94200, p_next_date: V1.next_service_date, p_description: "Akü" });
    expect(v.p_items).toEqual([{ key: "aku", interval_km: 30000 }]);
    await expect(page.getByTestId("basari-bildirimi")).toHaveText("Bakım kaydı eklendi.");
  });

  test("Bakım: geçmiş tarih → Bireysel Geçmiş Kaydı (maintenance_records, tenant yok)", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    const dlg = await openHub(page);
    await dlg.getByRole("listitem").filter({ hasText: "Bakım Kaydı Ekle" }).click();
    const past = istToday(-40);
    await dlg.locator("#qa-bakim-tarih").fill(past);
    await expect(dlg.getByTestId("gecmis-tarih-notu")).toBeVisible();
    await dlg.locator("#qa-bakim-km").fill("81000");
    await dlg.getByTestId("islem-izgarasi").getByRole("button", { name: "Fren Balatası", exact: true }).click();
    await dlg.getByRole("button", { name: "Bakım Kaydını Ekle" }).click();
    await expect.poll(() => writes.filter((w) => w.table === "maintenance_records").length).toBe(1);
    const rec = writes.find((w) => w.table === "maintenance_records")!.body;
    const row = Array.isArray(rec) ? rec[0] : rec;
    expect(row).toMatchObject({ vehicle_id: VID, tenant_id: null, service_date: past, km_at_service: 81000, description: "Fren Balatası" });
    expect(writes.filter((w) => w.table === "rpc/record_service_visit")).toHaveLength(0);
    await expect(page.getByTestId("basari-bildirimi")).toHaveText("Bakım kaydı eklendi.");
  });

  test("Belge: tip + dosya zorunlu; PDF özel kovaya yüklenir, kayıt eklenir; Tarihler sekmesinde listelenir", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true, docs: [{ id: "d1", doc_type: "fatura", doc_date: istToday(-1), note: "Periyodik bakım", storage_path: `${VID}/abc.pdf`, file_name: "f.pdf", mime_type: "application/pdf", size_bytes: 204800, created_at: new Date().toISOString() }] });
    await page.goto(`/bireysel/araclar/${VID}`);
    const dlg = await openHub(page);
    await dlg.getByRole("listitem").filter({ hasText: "Belge Ekle" }).click();
    await expect(dlg.getByRole("radio")).toHaveText(["Fatura", "Servis Fişi", "Muayene Belgesi", "Sigorta Belgesi", "Kasko Belgesi", "Diğer"]);
    await dlg.getByRole("button", { name: "Belgeyi Ekle" }).click();
    await expect(dlg.getByText("Belge tipini seçin.")).toBeVisible();
    await expect(dlg.getByText("Yüklenecek dosyayı seçin.")).toBeVisible();
    // izin verilmeyen dosya
    await dlg.getByTestId("belge-dosya").setInputFiles({ name: "x.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
    await expect(dlg.getByText("Yalnız PDF veya fotoğraf")).toBeVisible();
    expect(writes).toEqual([]);
    await dlg.getByRole("radio", { name: "Servis Fişi" }).click();
    await dlg.locator("#qa-belge-tarih").fill(istToday(-2));
    await dlg.locator("#qa-belge-not").fill("60.000 km bakım");
    await dlg.getByTestId("belge-dosya").setInputFiles(PDF);
    await expect(dlg.getByTestId("secilen-dosya")).toHaveText("servis-faturasi.pdf");
    for (const r of await dlg.getByRole("radio").all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    await dlg.getByRole("button", { name: "Belgeyi Ekle" }).click();
    await expect.poll(() => writes.filter((w) => w.table === "vehicle_documents").length).toBe(1);
    const up = writes.find((w) => w.table === "storage")!.body;
    expect(up.path).toMatch(new RegExp(`^vehicle-documents/${VID}/[0-9a-f-]{36}\\.pdf$`));
    const row = writes.find((w) => w.table === "vehicle_documents")!.body;
    expect(row).toMatchObject({ vehicle_id: VID, uploaded_by: OWNER_ID, doc_type: "servis_fisi", doc_date: istToday(-2), note: "60.000 km bakım", file_name: "servis-faturasi.pdf", mime_type: "application/pdf" });
    expect(row.storage_path).toBe(up.path.replace(/^vehicle-documents\//, ""));
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId("basari-bildirimi")).toHaveText("Belge eklendi.");
    await page.getByRole("navigation", { name: "Araç bölümleri" }).getByRole("button", { name: "Tarihler" }).click();
    const list = page.getByTestId("belgeler");
    await expect(list.getByTestId("belge-satir")).toHaveCount(1);
    await expect(list.getByTestId("belge-satir")).toContainText("Fatura");
    await expect(list.getByTestId("belge-satir")).toContainText("200 KB");
    await expect(list.getByTestId("belge-satir").getByRole("link")).toHaveAttribute("href", /token=t/);
    await noOverflow(page);
  });

  test("E–H F1/F2: devralınan belge yeni sahibe listelenir ve açılır, ama silinemez (Sil yok)", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true, docs: [
      { id: "d-aktarilan", doc_type: "servis_fisi", doc_date: istToday(-30), note: null, file_name: "s.pdf", mime_type: "application/pdf", size_bytes: 1024, created_at: new Date().toISOString(), own: false },
      { id: "d-kendi", doc_type: "fatura", doc_date: istToday(-1), note: null, storage_path: `${VID}/k.pdf`, file_name: "k.pdf", mime_type: "application/pdf", size_bytes: 1024, created_at: new Date().toISOString(), own: true },
    ] });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByRole("navigation", { name: "Araç bölümleri" }).getByRole("button", { name: "Tarihler" }).click();
    const rows = page.getByTestId("belgeler").getByTestId("belge-satir");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByRole("link")).toHaveAttribute("href", /d-aktarilan\?token=t/);
    await expect(rows.nth(0).getByTestId("belge-sil")).toHaveCount(0);
    await expect(rows.nth(1).getByTestId("belge-sil")).toHaveCount(1);
  });

  test("Tarihleri Güncelle: üç tarih tek ekranda, yalnız tarih kolonları yazılır", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    const dlg = await openHub(page);
    await dlg.getByRole("listitem").filter({ hasText: "Tarihleri Güncelle" }).click();
    await expect(dlg.getByText("Sonraki Muayene", { exact: true })).toBeVisible();
    await expect(dlg.getByText("Kasko Bitiş Tarihi", { exact: true })).toBeVisible();
    await expect(dlg.getByText("Zorunlu Trafik Sigortası Bitiş Tarihi", { exact: true })).toBeVisible();
    await dlg.locator("#qa-tarih-muayene_tarihi").fill(istToday(200));
    await dlg.locator("#qa-tarih-trafik_sigortasi_bitis").fill(istToday(360));
    await dlg.getByRole("button", { name: "Tarihleri Kaydet" }).click();
    await expect(dlg).toHaveCount(0);
    const w = writes.filter((x) => x.table === "vehicles");
    expect(w).toHaveLength(1);
    expect(Object.keys(w[0].body).sort()).toEqual(["kasko_bitis", "muayene_tarihi", "trafik_sigortasi_bitis", "updated_at"]);
    expect(w[0].body).toMatchObject({ muayene_tarihi: istToday(200), trafik_sigortasi_bitis: istToday(360), kasko_bitis: V1.kasko_bitis });
    await expect(page.getByTestId("basari-bildirimi")).toHaveText("Tarihler güncellendi.");
  });
});
