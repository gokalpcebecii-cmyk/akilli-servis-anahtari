import { test, expect, Page } from "@playwright/test";
import { installMockSession } from "./fixtures/mockAuth";
import { pickBrandModel } from "./fixtures/brandModel";

// OTOİZ Nihai UX + 12 aylık başlangıç geçmişi. Gerçek component kodu; yalnız
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

test.describe("Nihai UX — bireysel ana ekran", () => {
  test("sıra: araç kimliği → kritik özet → 4 durum kartı → yaklaşan + son kayıtlar → QR kartı", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: false });
    await page.goto("/bireysel/araclar");
    await page.getByTestId("kritik-ozet").waitFor();
    await expect(page.getByTestId("aktif-plaka")).toHaveText("34 NUX 001");
    await expect(page.getByTestId("aktif-km")).toHaveText("84.200 km");
    await expect(page.getByTestId("kritik-ozet")).toContainText("2 işlem dikkatinizi bekliyor");
    await expect(page.getByTestId("kritik-ozet")).toContainText("Trafik sigortası gecikti · Kasko 18 gün sonra");
    await expect(page.getByTestId("durum-dortlu").locator("[data-testid^=dortlu-]")).toHaveCount(4);
    // QR yok: tek kompakt aksiyon kartı, tekrar eden QR açıklaması yok
    await expect(page.getByTestId("qr-durumu")).toContainText("OTOİZ anahtarlığı henüz bağlı değil");
    await expect(page.getByRole("link", { name: "Anahtarlığı Etkinleştir" })).toHaveAttribute("href", "/aktivasyon");
    await expect(page.getByText("QR anahtarlığınızı etkinleştirin")).toHaveCount(0);
    await expect(page.getByText("QR okutulduğunda")).toHaveCount(0);
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
    expect(await y("arac-kimligi")).toBeLessThan(await y("kritik-ozet"));
    expect(await y("kritik-ozet")).toBeLessThan(await y("durum-dortlu"));
    expect(await y("durum-dortlu")).toBeLessThan(await y("yaklasan-islemler"));
    expect(await y("yaklasan-islemler")).toBeLessThan(await y("qr-durumu"));
    await noOverflow(page);
  });

  test("masaüstü: 4 kart tek satır, yaklaşan + son kayıtlar iki sütun, sayfa ~1240px; mobil 2x2 ve alt alta", async ({ page, baseURL }, info) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto("/bireysel/araclar");
    await page.getByTestId("kritik-ozet").waitFor();
    const boxes = await Promise.all(["bakim", "muayene", "kasko", "trafik"].map((k) => page.getByTestId(`dortlu-${k}`).boundingBox()));
    const yak = (await page.getByTestId("yaklasan-islemler").boundingBox())!;
    const son = (await page.getByTestId("zaman-cizelgesi").boundingBox())!;
    if (info.project.name === "desktop-chromium") {
      expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1);
      expect(Math.abs(yak.y - son.y)).toBeLessThan(2);
      const w = (await page.getByTestId("kritik-ozet").boundingBox())!.width;
      expect(w).toBeGreaterThan(1100);
      expect(w).toBeLessThanOrEqual(1240);
    } else {
      expect(Math.round(boxes[0]!.y)).toBe(Math.round(boxes[1]!.y));
      expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);
      expect(son.y).toBeGreaterThan(yak.y + yak.height - 1);
    }
    await expect(page.getByTestId("qr-aktif")).toBeVisible();
  });

  test("Araç Değiştir: küçük aksiyon, seçilen araç aktif olur", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto("/bireysel/araclar");
    await page.getByTestId("kritik-ozet").waitFor();
    await expect(page.getByTestId("arac-secici")).toHaveCount(0);
    await page.getByTestId("arac-degistir").click();
    await page.getByRole("option", { name: /06 NUX 002/ }).click();
    await expect(page.getByTestId("aktif-plaka")).toHaveText("06 NUX 002");
    await expect(page.getByTestId("arac-secici")).toHaveCount(0);
  });
});

test.describe("Nihai UX — araç detay", () => {
  test("Genel Bakış: bakım tek yerde; Sonraki Bakım → Muayene/Kasko/Trafik → Yaklaşan → Detailing/Belgeler", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await expect(page.getByTestId("sonraki-bakim")).toHaveCount(1);
    await expect(page.getByTestId("durum-bakim")).toHaveCount(0);
    await expect(page.getByTestId("bireysel-ozet").getByText("SONRAKİ BAKIM")).toHaveCount(1);
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
    expect(await y("sonraki-bakim")).toBeLessThan(await y("durum-muayene"));
    expect(await y("durum-muayene")).toBeLessThan(await y("durum-yaklasan"));
    expect(await y("durum-yaklasan")).toBeLessThan(await y("durum-detailing"));
    await expect(page.getByRole("button", { name: "Tarihler", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Belgeler", exact: true })).toHaveCount(0);
    await noOverflow(page);
  });

  test("Tarihler: Önemli Tarihler okunur satırlar, Tarihleri Güncelle yok, Düzenle ile alanlar açılır, Not alanı yok", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { qr: true });
    await page.goto(`/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    await page.getByRole("button", { name: "Tarihler", exact: true }).click();
    const box = page.getByTestId("tarihler-belgeler");
    await expect(box.getByTestId("belge-satir-muayene_tarihi")).toContainText("Muayene");
    await expect(box.getByTestId("belge-satir-kasko_bitis")).toContainText("18 gün kaldı");
    await expect(box.getByTestId("belge-satir-trafik_sigortasi_bitis")).toContainText("Zorunlu Trafik Sigortası");
    await expect(page.getByRole("button", { name: "Tarihleri Güncelle" })).toHaveCount(0);
    await expect(page.locator('[data-field="muayene_tarihi"]')).toHaveCount(0);
    await box.getByRole("button", { name: "Tarihleri düzenle" }).click();
    await page.locator('[data-field="muayene_tarihi"]').fill(istToday(100));
    await box.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => writes.filter((w) => w.table === "vehicles").length).toBe(1);
    expect(writes[0].body.muayene_tarihi).toBe(istToday(100));
    await expect(box.getByTestId("belge-satir-muayene_tarihi")).toHaveAttribute("data-level", "ok");
    await expect(box.getByRole("heading", { name: "Önemli Tarihler" })).toBeVisible();
    await expect(page.locator("#arac-notlar")).toHaveCount(0);
  });
});

test.describe("Nihai UX — servis hızlı kayıt", () => {
  test("kompakt ızgara: 15 işlem + Diğer; masaüstü 4, mobil 2 sütun; seçili yeşil + onay; Bakımı Kaydet", async ({ page, baseURL }, info) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "nux.servis@ornek.com" }, baseURL!);
    const writes = await mockAll(page, { role: "servis" });
    await page.goto(`/panel/araclar/${VID}`);
    const grid = page.getByTestId("islem-izgarasi");
    await grid.waitFor();
    await expect(grid.getByRole("button")).toHaveCount(16);
    await expect(page.getByText("Daha fazla işlem")).toHaveCount(0);
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(info.project.name === "desktop-chromium" ? 4 : 2);
    const width = (await page.getByTestId("hizli-kayit").boundingBox())!.width;
    if (info.project.name === "desktop-chromium") {
      expect(width).toBeGreaterThanOrEqual(740);
      expect(width).toBeLessThanOrEqual(820);
    }
    // Sıra: Araç → KM → İşlemler → Not → Sonraki bakım → Bakımı Kaydet
    const y = async (l: any) => (await l.boundingBox())!.y;
    expect(await y(page.getByTestId("servis-arac"))).toBeLessThan(await y(page.getByLabel("Güncel kilometre")));
    expect(await y(page.getByLabel("Güncel kilometre"))).toBeLessThan(await y(grid));
    expect(await y(grid)).toBeLessThan(await y(page.getByTestId("servis-not")));
    expect(await y(page.getByTestId("servis-not"))).toBeLessThan(await y(page.getByRole("radiogroup", { name: "Sonraki bakım" })));

    const chip = grid.getByRole("button", { name: "Motor Yağı", exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(chip).toHaveCSS("border-top-color", "rgb(34, 197, 94)");
    await grid.getByRole("button", { name: "Triger", exact: true }).click();
    await page.getByRole("button", { name: "Bakımı Kaydet" }).click();
    await expect.poll(() => writes.filter((w) => w.table === "rpc/record_service_visit").length).toBe(1);
    const v = writes.find((w) => w.table === "rpc/record_service_visit")!.body;
    expect(v.p_items.map((i: any) => i.key)).toEqual(["motor_yagi", "triger_seti"]);
    expect(v.p_description).toBe("Motor Yağı, Triger Seti");
    await noOverflow(page);
  });
});

test.describe("Nihai UX — 12 aylık başlangıç geçmişi", () => {
  test("yeni araç oluşturulunca geçmiş başlangıç ekranı açılır", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    await mockAll(page, { vehicles: [V1] });
    await page.route("**/api/vehicles", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ vehicle: { id: VID } }) }));
    await page.goto("/bireysel/araclar/yeni");
    await page.locator("#arac-plate").fill("34 NUX 001");
    await pickBrandModel(page, "Toyota", "Corolla");
    await page.locator("#arac-year").fill("2019");
    await page.locator("#arac-km").fill("84200");
    await page.getByRole("button", { name: "Aracı Oluştur" }).click();
    await page.waitForURL(`**/bireysel/araclar/${VID}/gecmis`);
    await expect(page.getByRole("heading", { name: "Aracınızın geçmişini başlatalım" })).toBeVisible();
    await expect(page.getByText("Son 12 ayda yapılan önemli bakım ve işlemleri ekleyin. OTOİZ sonraki bakım takibini bu geçmişe göre başlatsın.")).toBeVisible();
  });

  test("Geçmişi bilmiyorum, şimdi başla: hiçbir şey yazılmaz, araca geçilir", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { vehicles: [V1] });
    await page.goto(`/bireysel/araclar/${VID}/gecmis`);
    await expect(page.getByRole("button", { name: "Şimdilik Atla" })).toHaveCount(0);
    await page.getByRole("button", { name: "Geçmişi bilmiyorum, şimdi başla" }).click();
    await page.waitForURL(`**/bireysel/araclar/${VID}`);
    await page.getByTestId("arac-durumu").waitFor();
    expect(writes).toEqual([]);
  });

  test("geçmiş kaydı: Bireysel Geçmiş Kaydı yazılır, sonraki bakım en son periyodik kaydın tarih/km'sinden", async ({ page, baseURL }, info) => {
    await asOwner(page, baseURL!);
    const writes = await mockAll(page, { vehicles: [V1] });
    await page.goto(`/bireysel/araclar/${VID}/gecmis`);
    await expect(page.getByTestId("onboarding-adimlar").locator("li")).toHaveText(["Araç", "Geçmiş", "Hazır"].map((t) => new RegExp(t)));

    // boş gönderim: hata, yazma yok
    await page.getByRole("button", { name: "Geçmişi Kaydet ve OTOİZ'i Başlat" }).click();
    await expect(page.getByRole("alert").first()).toContainText("en az bir geçmiş işlem");
    expect(writes).toEqual([]);
    // eksik işlem: düzenleyicide hata
    await page.locator("#gecmis-0-tarih").fill(istToday(-10));
    await page.getByTestId("islemi-ekle").click();
    await expect(page.getByRole("alert").first()).toContainText("kilometreyi girin");

    const d1 = istToday(-300);
    const d2 = istToday(-120);
    await page.locator("#gecmis-0-tarih").fill(d1);
    await page.locator("#gecmis-0-km").fill("70000");
    const ed = page.getByTestId("gecmis-duzenleyici");
    await ed.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await ed.getByRole("button", { name: "Akü", exact: true }).click();
    await page.getByTestId("islemi-ekle").click();
    await expect(page.getByTestId("gecmis-ozet")).toHaveCount(1);
    await expect(page.getByTestId("gecmis-ozet").first()).toContainText("70.000 km");
    await expect(page.getByTestId("gecmis-ozet").first()).toContainText("Motor Yağı · Akü");

    await page.getByRole("button", { name: "+ Bir geçmiş işlem daha ekle" }).click();
    await page.locator("#gecmis-0-tarih").fill(d2);
    await page.locator("#gecmis-0-km").fill("78000");
    await ed.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await ed.getByRole("button", { name: "Yağ Filtresi", exact: true }).click();
    await page.locator("#gecmis-0-not").fill("yetkili serviste");
    await noOverflow(page);
    await page.getByRole("button", { name: "Geçmişi Kaydet ve OTOİZ'i Başlat" }).click();
    await page.getByTestId("gecmis-kaydedildi").waitFor();

    const rec = writes.filter((w) => w.table === "maintenance_records");
    expect(rec).toHaveLength(1); // tek insert (hepsi ya da hiçbiri)
    expect(rec[0].body).toHaveLength(2);
    expect(rec[0].body[0]).toMatchObject({ vehicle_id: VID, tenant_id: null, service_date: d1, km_at_service: 70000, description: "Motor Yağı, Akü", created_by: OWNER_ID });
    expect(rec[0].body[1]).toMatchObject({ service_date: d2, km_at_service: 78000, description: "Motor Yağı, Yağ Filtresi — Not: yetkili serviste" });
    expect(rec[0].body[0].client_request_id).toMatch(/[0-9a-f-]{36}/);

    const items = writes.find((w) => w.table === "maintenance_items")!.body;
    const byKey = Object.fromEntries(items.map((i: any) => [i.item_key, i]));
    expect(byKey.motor_yagi).toMatchObject({ last_service_date: d2, last_service_km: 78000 });
    expect(byKey.aku).toMatchObject({ last_service_date: d1, last_service_km: 70000 });

    // KRİTİK: plan kayıt tarihinden değil, en son periyodik geçmişten (d2 / 78.000 km)
    const veh = writes.find((w) => w.table === "vehicles")!.body;
    expect(veh.next_service_km).toBe(88000);
    const [yy, mm, dd] = d2.split("-").map(Number);
    const exp = `${yy + 1}-${String(mm).padStart(2, "0")}-${String(Math.min(dd, new Date(Date.UTC(yy + 1, mm, 0)).getUTCDate())).padStart(2, "0")}`;
    expect(veh.next_service_date).toBe(exp);
    await expect(page.getByTestId("gecmis-plan")).toContainText("88.000 km");
  });
});

test.describe("Nihai UX — zaman çizelgesi", () => {
  test("Geçmiş İşlem Ekle: serbest not yok; Diğer Araç Kaydı geçmiş tarihle yazılır; geçmiş rozeti görünür", async ({ page, baseURL }) => {
    await asOwner(page, baseURL!);
    const timeline = [
      { id: "h1", kind: "record", source: "owner", event_date: istToday(-120), event_ts: `${istToday(-1)}T09:00:00Z`, km: 78000, title: "Motor Yağı", revised: false },
      { id: "o1", kind: "record", source: "owner", event_date: istToday(-5), event_ts: `${istToday(-5)}T09:00:00Z`, km: 83000, title: "Akü", revised: false },
      { id: "s1", kind: "record", source: "service", event_date: istToday(-2), event_ts: `${istToday(-2)}T09:00:00Z`, km: 84000, title: "Fren Diski", revised: false, service_name: "Güven Oto" },
    ];
    const writes = await mockAll(page, { vehicles: [V1], timeline });
    await page.goto(`/bireysel/araclar/${VID}#servis-gecmisi`);
    const tl = page.locator("#servis-gecmisi");
    await tl.getByTestId("zaman-olay").first().waitFor();
    await expect(tl.getByText("Bireysel Geçmiş Kaydı").first()).toBeVisible();
    await expect(tl.getByText("Bireysel Kayıt", { exact: true })).toBeVisible();
    await expect(tl.getByText("Servis Doğrulamalı")).toBeVisible();
    await expect(page.getByText("Kendi kaydını ekle (serbest not)")).toHaveCount(0);

    await page.getByRole("button", { name: "Diğer Araç Kaydı" }).click();
    await page.locator("#ekle-diger-tarih").fill(istToday(-40));
    await page.locator("#ekle-diger-aciklama").fill("Araç muayenesi");
    await page.getByRole("button", { name: "Kaydı Ekle" }).click();
    await expect.poll(() => writes.filter((w) => w.table === "maintenance_records").length).toBe(1);
    const body = writes.find((w) => w.table === "maintenance_records")!.body[0];
    expect(body).toMatchObject({ tenant_id: null, service_date: istToday(-40), km_at_service: null, description: "Araç muayenesi" });
    // Periyodik bakım değil: plan değişmez
    expect(writes.filter((w) => w.table === "vehicles")).toHaveLength(0);
  });
});
