import { test, expect, Page } from "@playwright/test";
import { installMockSession } from "./fixtures/mockAuth";
import { pickBrandModel } from "./fixtures/brandModel";

// OTOİZ Nihai UX son düzenleme (Hızlı İşlemler, bakım penceresi, QR bağla, Tarihler, giriş). Gerçek component kodu; yalnız
// ağ katmanı mock. Yazma istekleri yakalanır, hiçbir yere gitmez.

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

async function mockAll(page: Page, opts: { vehicles?: any[]; qr?: boolean; records?: any[]; timeline?: any[]; role?: "owner" | "servis" } = {}) {
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
    if (table === "staff_users") return j(single ? { id: STAFF_ID, tenant_id: TENANT_ID, role: "owner" } : [{ id: STAFF_ID, tenant_id: TENANT_ID, role: "owner" }]);
    if (table === "tenants") return j(single ? { id: TENANT_ID, name: "Güven Oto", approval_status: "approved" } : []);
    return j(single ? null : []);
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

test.describe("Nihai UX son düzenleme — araç detay / Genel Bakış", () => {
  test("form yok; masaüstü sol bilgi + sağ dar kolon (Hızlı İşlemler → Son Kayıtlar → QR); mobil sıra", async ({ page, baseURL }, info) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.locator("#anahtarlik").waitFor();
    // Genel Bakış'ta bakım formu yok
    await expect(page.locator("#owner-quick-km")).toHaveCount(0);
    await expect(page.getByTestId("islem-izgarasi")).toHaveCount(0);
    await expect(page.getByText("Kayıt kaynakları")).toHaveCount(0);
    const qa = visible(page, "hizli-islemler");
    await expect(qa).toHaveCount(1);
    await expect(qa.getByRole("button")).toHaveText(["KM Güncelle", "Bakım Kaydı Ekle", "Geçmiş İşlem Ekle", "QR Yönetimi"]);
    const box = async (l: any) => (await l.boundingBox())!;
    const hero = await box(page.getByTestId("sonraki-bakim"));
    const dates = await box(page.getByTestId("durum-muayene"));
    const yak = await box(page.getByTestId("durum-yaklasan"));
    const q = await box(qa);
    const son = await box(page.getByTestId("zaman-cizelgesi"));
    const qr = await box(page.locator("#anahtarlik"));
    if (info.project.name === "desktop-chromium") {
      expect(q.x).toBeGreaterThan(hero.x + hero.width);
      expect(q.width).toBeLessThanOrEqual(362);
      expect(Math.abs(q.y - hero.y)).toBeLessThan(2);
      expect(son.x).toBe(q.x);
      expect(q.y).toBeLessThan(son.y);
      expect(son.y).toBeLessThan(qr.y);
      expect(hero.y).toBeLessThan(dates.y);
      expect(dates.y).toBeLessThan(yak.y);
    } else {
      for (const [a, b] of [[hero, dates], [dates, q], [q, yak], [yak, son], [son, qr]] as const) expect(a.y).toBeLessThan(b.y);
    }
    await noOverflow(page);
  });

  test("Bakım Kaydı Ekle penceresi: KM → işlem → not → sonraki bakım → Bakımı Kaydet; kayıt sonra kapanır", async ({ page, baseURL }, info) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await visible(page, "hizli-islemler").getByRole("button", { name: "Bakım Kaydı Ekle" }).click();
    const dlg = page.getByRole("dialog", { name: "Bakım Kaydı Ekle" });
    await expect(dlg).toBeVisible();
    const vp = page.viewportSize()!;
    const d = (await dlg.boundingBox())!;
    if (info.project.name === "desktop-chromium") {
      expect(d.width).toBeLessThanOrEqual(560);
      expect(Math.round(d.x + d.width)).toBe(vp.width);
    } else {
      expect(Math.round(d.width)).toBe(vp.width); // telefonda tam ekran odaklı ekran
    }
    const y = async (l: any) => (await l.boundingBox())!.y;
    const km = dlg.locator("#owner-quick-km");
    const grid = dlg.getByTestId("islem-izgarasi");
    const note = dlg.locator("#owner-quick-not");
    const plan = dlg.getByRole("radiogroup", { name: "Sonraki bakım" });
    const save = dlg.getByRole("button", { name: "Bakımı Kaydet" });
    expect(await y(km)).toBeLessThan(await y(grid));
    expect(await y(grid)).toBeLessThan(await y(note));
    expect(await y(note)).toBeLessThan(await y(plan));
    expect(await y(plan)).toBeLessThan(await y(save));
    await km.fill("85000");
    await grid.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await note.fill("yetkili serviste");
    await expect(dlg.getByTestId("bireysel-plan-onizleme")).toContainText("95.000 km");
    await save.click();
    await expect.poll(() => writes.filter((w) => w.table === "rpc/record_service_visit").length).toBe(1);
    const v = writes.find((w) => w.table === "rpc/record_service_visit")!.body;
    expect(v).toMatchObject({ p_km: 85000, p_next_km: 95000, p_description: "Motor Yağı — Not: yetkili serviste" });
    await expect(dlg).toHaveCount(0);
    await expect(visible(page, "hizli-islemler")).toContainText("Bakım kaydedildi.");
  });

  test("KM Güncelle: düşük km reddedilir; geçerli km yalnız current_km yazar; Esc kapatır", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    const qa = visible(page, "hizli-islemler");
    await qa.getByRole("button", { name: "KM Güncelle" }).click();
    const dlg = page.getByRole("dialog", { name: "KM Güncelle" });
    await page.keyboard.press("Escape");
    await expect(dlg).toHaveCount(0);
    await qa.getByRole("button", { name: "KM Güncelle" }).click();
    await dlg.locator("#km-guncelle").fill("80000");
    await dlg.getByRole("button", { name: "Kilometreyi Kaydet" }).click();
    await expect(dlg.getByRole("alert")).toContainText("84.200 km");
    expect(writes).toEqual([]);
    await dlg.locator("#km-guncelle").fill("86500");
    await dlg.getByRole("button", { name: "Kilometreyi Kaydet" }).click();
    await expect(dlg).toHaveCount(0);
    const w = writes.filter((x) => x.table === "vehicles");
    expect(w).toHaveLength(1);
    expect(Object.keys(w[0].body).sort()).toEqual(["current_km", "updated_at"]);
    expect(w[0].body.current_km).toBe(86500);
    await expect(page.getByText("86.500 km").first()).toBeVisible();
  });

  test("Geçmiş İşlem Ekle → Geçmiş sekmesi; beyan açıklaması; sekmeler Genel Bakış / Geçmiş / Tarihler", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    const nav = page.getByRole("navigation", { name: "Araç bölümleri" });
    await expect(nav.getByRole("button")).toHaveText(["Genel Bakış", "Geçmiş", "Tarihler"]);
    await expect(nav.getByText("Belgeler")).toHaveCount(0);
    await visible(page, "hizli-islemler").getByRole("button", { name: "Geçmiş İşlem Ekle" }).click();
    await expect(nav.getByRole("button", { name: "Geçmiş" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("gecmis-beyan")).toHaveText("Bu kayıt sizin beyanınızla eklenir ve Bireysel Geçmiş Kaydı olarak görünür.");
    await expect(page.getByRole("button", { name: "Bakım / Parça Değişimi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Diğer Araç Kaydı" })).toBeVisible();
    await expect(page.locator("#servis-gecmisi").getByRole("heading", { name: "Zaman Çizelgesi" })).toBeVisible();
  });
});

test.describe("Nihai UX son düzenleme — QR bağlı değil", () => {
  test("normal görünüm: durum + tek cümle + Anahtarlığı Bağla; kod alanı ancak tıklayınca açılır", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: false });
    await page.goto(`/bireysel/araclar/${VID}`);
    const card = page.locator("#anahtarlik");
    await card.waitFor();
    await expect(card.getByRole("heading", { name: "QR Durumu" })).toBeVisible();
    await expect(card.getByTestId("anahtarlik-durum")).toHaveText("Bağlı değil");
    await expect(card).toContainText("OTOİZ anahtarlığınızı bu araca bağlayın.");
    await expect(card.locator("#owner-qr-code")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Anahtarlığımı bu araca bağla" })).toHaveCount(0);
    await card.getByRole("button", { name: "Anahtarlığı Bağla" }).click();
    await expect(card.locator("#owner-qr-code")).toBeVisible();
    await expect(card.getByRole("button", { name: "Anahtarlığımı bu araca bağla" })).toBeVisible();
    await card.getByRole("button", { name: "Vazgeç" }).click();
    await expect(card.locator("#owner-qr-code")).toHaveCount(0);
    // Hızlı İşlemler > QR Yönetimi kod alanını açar
    await visible(page, "hizli-islemler").getByRole("button", { name: "QR Yönetimi" }).click();
    await expect(card.locator("#owner-qr-code")).toBeVisible();
    await noOverflow(page);
  });
});

test.describe("Nihai UX son düzenleme — onboarding özet kartları", () => {
  test("özet kart: tarih · km, işlemler, Düzenle / Sil", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { vehicles: [V1] });
    await page.goto(`/bireysel/araclar/${VID}/gecmis`);
    await expect(page.getByTestId("onboarding-adimlar").locator('[aria-current="step"]')).toContainText("Geçmiş");
    const ed = page.getByTestId("gecmis-duzenleyici");
    await page.locator("#gecmis-0-tarih").fill("2026-03-20");
    await page.locator("#gecmis-0-km").fill("68000");
    await ed.getByRole("button", { name: "Hava Filtresi", exact: true }).click();
    await ed.getByRole("button", { name: "Ön Fren Balatası", exact: true }).click();
    await page.getByTestId("islemi-ekle").click();
    const card = page.getByTestId("gecmis-ozet");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("20 Mart 2026 · 68.000 km");
    await expect(card).toContainText("Hava Filtresi · Ön Fren Balatası");
    await card.getByRole("button", { name: "Düzenle" }).click();
    await expect(page.locator("#gecmis-0-km")).toHaveValue("68.000");
    await page.locator("#gecmis-0-km").fill("69000");
    await page.getByRole("button", { name: "Değişikliği Kaydet" }).click();
    await expect(card).toContainText("69.000 km");
    await card.getByRole("button", { name: "Sil" }).click();
    await expect(page.getByTestId("gecmis-ozet")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Bir geçmiş işlem daha ekle" })).toBeVisible();
    expect(writes).toEqual([]);
    await noOverflow(page);
  });
});

test.describe("Nihai UX son düzenleme — ana ekran ve giriş", () => {
  test("ana ekran: kompakt başlık, Araç Değiştir ikincil (çerçevesiz), yapı korunur", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto("/bireysel/araclar");
    await page.getByTestId("kritik-ozet").waitFor();
    const btn = page.getByTestId("arac-degistir");
    await expect(btn).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(btn).toHaveCSS("border-top-width", "0px");
    const fs = await page.getByTestId("aktif-plaka").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeLessThanOrEqual(24);
    for (const id of ["kritik-ozet", "durum-dortlu", "yaklasan-islemler", "zaman-cizelgesi", "qr-durumu"]) await expect(page.getByTestId(id)).toBeVisible();
  });

  test("giriş (masaüstü): marka alanı login kartıyla dikey ortalı", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chromium", "yalnız masaüstü");
    await page.goto("/bireysel/giris");
    const card = (await page.locator(".otoiz-auth2-card").boundingBox())!;
    const brand = (await page.locator(".otoiz-auth2-brand").boundingBox())!;
    expect(Math.abs(card.y + card.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(6);
    expect(card.x - (brand.x + brand.width)).toBeLessThanOrEqual(80);
    await noOverflow(page);
  });
});
