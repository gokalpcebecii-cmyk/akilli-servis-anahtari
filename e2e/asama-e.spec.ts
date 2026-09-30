import { test, expect, Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ Aşama E — Araç Durumu, Zaman Çizelgesi, servis 15–20 sn akış,
// bireysel UX, düzeltme görünümü, mobil. Gerçek component kodu; yalnız ağ
// katmanı mock (bkz. e2e/fixtures/mockAuth.ts). Ekran görüntüleri
// E2E_SHOT_DIR verilirse oraya yazılır.

const OWNER_ID = "e1e1e1e1-0000-4000-8000-000000000001";
const STAFF_ID = "e1e1e1e1-0000-4000-8000-000000000002";
const TENANT_ID = "e1e1e1e1-0000-4000-8000-000000000003";
const VEHICLE_ID = "e1e1e1e1-0000-4000-8000-000000000004";
const REC_REVISED = "e1e1e1e1-0000-4000-8000-00000000000a";
const SHOT_DIR = process.env.E2E_SHOT_DIR;

function isoInDays(n: number) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

const baseVehicle = {
  id: VEHICLE_ID,
  plate: "34 OTZ 084",
  brand: "Volkswagen",
  model: "Passat",
  year: 2019,
  current_km: 84200,
  next_service_km: 85000, // 800 km kaldı → SARI
  next_service_date: isoInDays(200),
  muayene_tarihi: isoInDays(-5), // geçti → KIRMIZI
  trafik_sigortasi_bitis: isoInDays(120),
  kasko_bitis: null,
  notes: "",
};

function timelineRows() {
  const rows: any[] = [
    { id: REC_REVISED, kind: "record", source: "service", event_date: "2027-03-02", event_ts: "2027-03-02T09:00:00Z", km: 84200, title: "Motor Yağı, Yağ Filtresi", revised: true, revision: 1, service_name: "Güven Oto Servis" },
    { id: "e1e1e1e1-0000-4000-8000-00000000000b", kind: "record", source: "owner", event_date: "2027-01-10", event_ts: "2027-01-10T09:00:00Z", km: 80100, title: "Araç muayenesi", revised: false, revision: 0, service_name: null },
    { id: "e1e1e1e1-0000-4000-8000-00000000000c", kind: "record", source: "service", event_date: "2026-11-05", event_ts: "2026-11-05T09:00:00Z", km: 78000, title: "Seramik kaplama", revised: false, revision: 0, service_name: "Güven Oto Servis" },
    { id: "e1e1e1e1-0000-4000-8000-00000000000d", kind: "ownership_transfer", source: "system", event_date: "2026-08-01", event_ts: "2026-08-01T09:00:00Z", km: 73800, title: "Sahiplik devredildi", revised: false, revision: 0, service_name: null },
    { id: "e1e1e1e1-0000-4000-8000-00000000000e", kind: "record", source: "owner", event_date: "2026-07-15", event_ts: "2026-07-15T09:00:00Z", km: 73800, title: "Ön Fren Balatası", revised: false, revision: 0, service_name: null },
    { id: "e1e1e1e1-0000-4000-8000-00000000000f", kind: "qr_linked", source: "system", event_date: "2026-05-01", event_ts: "2026-05-01T09:00:00Z", km: null, title: "OTOİZ anahtarlık bağlandı", revised: false, revision: 0, service_name: null },
  ];
  for (let i = 0; i < 24; i++) {
    rows.push({ id: `e1e1e1e1-0000-4000-8001-${String(i).padStart(12, "0")}`, kind: "record", source: i % 2 ? "service" : "owner", event_date: `2025-${String(12 - (i % 12)).padStart(2, "0")}-01`, event_ts: "2025-01-01T09:00:00Z", km: 60000 - i * 1000, title: `Eski kayıt ${i + 1}`, revised: false, revision: 0, service_name: null });
  }
  return rows;
}

const revision = {
  record_id: REC_REVISED,
  revision: 1,
  changed_at: "2027-03-02T12:00:00Z",
  changed_by: "Ahmet Usta",
  changed_fields: ["km_at_service"],
  old_values: { km_at_service: 84000 },
  new_values: { km_at_service: 84200 },
};

async function mockTimeline(page: Page, rows = timelineRows()) {
  const calls: any[] = [];
  await page.route("**/rest/v1/rpc/vehicle_timeline**", async (route) => {
    const body = route.request().postDataJSON() || {};
    calls.push(body);
    const off = body.p_offset ?? 0;
    const lim = body.p_limit ?? 20;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: rows.slice(off, off + lim), has_more: rows.length > off + lim, total: rows.length, viewer: "x" }),
    });
  });
  return calls;
}

async function setupServis(page: Page, baseURL: string, vehicle: any = baseVehicle, opts: { delayMs?: number } = {}) {
  await installMockSession(page.context(), { id: STAFF_ID, email: "asamae.servis@ornek.com" }, baseURL);
  const v = { ...vehicle, tenant_id: TENANT_ID, owner_user_id: null };
  await mockSupabaseRest(page, {
    vehicles: { single: v, list: [v] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [{ vehicle_id: VEHICLE_ID, item_key: "motor_yagi", interval_km: 10000, last_service_km: 74500, last_service_date: "2026-03-01" }] },
    qr_keys: { single: null, list: [] },
    staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
    tenants: { single: { id: TENANT_ID, name: "Güven Oto Servis" } },
    "rpc/maintenance_record_history": { raw: [revision] },
  });
  const timelineCalls = await mockTimeline(page);
  const visits: any[] = [];
  await page.route("**/rest/v1/rpc/record_service_visit", async (route) => {
    visits.push(route.request().postDataJSON());
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, duplicate: false, record_id: REC_REVISED, service_verified: true }) });
  });
  await page.goto(`/panel/araclar/${VEHICLE_ID}`);
  await page.getByText(v.plate).first().waitFor();
  await page.getByTestId("zaman-olay").first().waitFor();
  return { visits, timelineCalls };
}

async function setupBireysel(page: Page, baseURL: string, vehicle: any = baseVehicle, rows = timelineRows()) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "asamae.sahip@ornek.com" }, baseURL);
  const v = { ...vehicle, tenant_id: null, owner_user_id: OWNER_ID };
  const historyCalls: string[] = [];
  await mockSupabaseRest(page, {
    vehicles: { single: v, list: [v] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: { code: "abc123def456" }, list: [] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
  });
  await page.route("**/rest/v1/rpc/maintenance_record_history**", async (route) => {
    historyCalls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([revision]) });
  });
  const timelineCalls = await mockTimeline(page, rows);
  await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
  await page.getByText(v.plate).first().waitFor();
  await page.getByTestId("arac-durumu").waitFor();
  return { historyCalls, timelineCalls };
}

async function shot(page: Page, name: string, full = true) {
  if (!SHOT_DIR) return;
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: full });
}

async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, `yatay taşma: scrollWidth ${o.sw} > ${o.cw}`).toBeLessThanOrEqual(o.cw);
}

test.describe("Aşama E — servis", () => {
  test("Araç Durumu: renkler yalnız km/tarihten (bakım SARI, muayene KIRMIZI, trafik YEŞİL, kasko GRİ, detailing GRİ)", async ({ page, baseURL }, info) => {
    await setupServis(page, baseURL!);
    await expect(page.getByTestId("sonraki-bakim")).toHaveAttribute("data-level", "soon");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("Bakım yaklaşıyor");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("800 km kaldı");
    await expect(page.getByTestId("durum-muayene")).toHaveAttribute("data-level", "late");
    await expect(page.getByTestId("durum-trafik")).toHaveAttribute("data-level", "ok");
    await expect(page.getByTestId("durum-kasko")).toHaveAttribute("data-level", "none");
    await expect(page.getByTestId("durum-yaklasan")).toHaveAttribute("data-level", "late");
    await expect(page.getByTestId("arac-durumu")).toContainText("mekanik değerlendirme değildir");
    await noHorizontalOverflow(page);
    await shot(page, `servis-arac-${info.project.name}`);
  });

  test("15–20 sn akış: KM → 2 işlem → varsayılan plan → KAYDET (tek RPC, otomatik sonraki bakım)", async ({ page, baseURL }, info) => {
    const { visits, timelineCalls } = await setupServis(page, baseURL!);
    const t0 = Date.now();
    const km = page.getByRole("textbox", { name: "Güncel kilometre" });
    await km.fill("86500");
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "Yağ Filtresi", exact: true }).click();
    await expect(page.getByTestId("plan-onizleme")).toContainText("96.500 km");
    await page.getByRole("button", { name: "Bakımı Kaydet" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kayıt tamamlandı" })).toBeVisible();
    const ms = Date.now() - t0;
    test.info().annotations.push({ type: "akış süresi (otomasyon)", description: `${ms} ms, 1 km girişi + 3 dokunuş` });
    expect(visits.length).toBe(1);
    expect(visits[0].p_km).toBe(86500);
    expect(visits[0].p_next_km).toBe(96500);
    expect(visits[0].p_next_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(visits[0].p_description).toBe("Motor Yağı, Yağ Filtresi");
    expect(visits[0].p_items.map((i: any) => i.key)).toEqual(["motor_yagi", "yag_filtresi"]);
    // Kayıt sonrası zaman çizelgesi yenilenir
    await expect.poll(() => timelineCalls.length).toBeGreaterThan(1);
    await shot(page, `servis-kayit-tamam-${info.project.name}`, false);
  });

  test("yeni hızlı seçimler + Sonra belirle: plan boş gider", async ({ page, baseURL }) => {
    const { visits } = await setupServis(page, baseURL!);
    for (const l of ["Yakıt Filtresi", "Ön Fren Balatası", "Şanzıman Yağı", "Antifriz"]) {
      await page.getByRole("button", { name: l, exact: true }).click();
    }
    await page.getByRole("radio", { name: "Sonra belirle" }).click();
    await expect(page.getByTestId("plan-onizleme")).toContainText("sonra belirlenecek");
    await page.getByRole("button", { name: "Bakımı Kaydet" }).click();
    await expect.poll(() => visits.length).toBe(1);
    expect(visits[0].p_next_km).toBeNull();
    expect(visits[0].p_next_date).toBeNull();
    expect(visits[0].p_items.map((i: any) => i.key)).toEqual(["yakit_filtresi", "fren_on_balata", "sanziman_yagi", "antifriz"]);
  });

  test("+15.000 km / 12 ay ve Özel plan (geçersiz km engellenir)", async ({ page, baseURL }) => {
    const { visits } = await setupServis(page, baseURL!);
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("radio", { name: "Özel" }).click();
    await page.getByPlaceholder("Örn. 95.000").fill("80000");
    await page.getByRole("button", { name: "Bakımı Kaydet" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("güncel kilometreden büyük");
    expect(visits.length).toBe(0);
    await page.getByRole("radio", { name: "+15.000 km / 12 ay" }).click();
    await page.getByRole("button", { name: "Bakımı Kaydet" }).click();
    await expect.poll(() => visits.length).toBe(1);
    expect(visits[0].p_next_km).toBe(84200 + 15000);
  });

  test("double-submit engeli: hızlı çift tıklama tek kayıt", async ({ page, baseURL }) => {
    const { visits } = await setupServis(page, baseURL!, baseVehicle, { delayMs: 400 });
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    const save = page.getByRole("button", { name: "Bakımı Kaydet" });
    await Promise.all([save.click(), save.click({ force: true }).catch(() => {})]);
    await page.waitForTimeout(700);
    expect(visits.length).toBe(1);
  });

  test("zaman çizelgesi: kaynaklar ayrışır, servis revizyon ayrıntısını görür, sayfalı yükleme", async ({ page, baseURL }, info) => {
    const { timelineCalls } = await setupServis(page, baseURL!);
    const tl = page.getByTestId("zaman-cizelgesi");
    await expect(tl.getByTestId("zaman-olay")).toHaveCount(20);
    await expect(tl.locator('[data-source="service"]').first()).toContainText("Servis Doğrulamalı");
    await expect(tl.locator('span[data-source="owner"]').first()).toContainText("Bireysel Kayıt");
    await expect(tl.locator('span[data-source="system"]').first()).toContainText("Sistem / Araç Olayı");
    await expect(tl).toContainText("Muayene");
    await expect(tl).toContainText("Detailing");
    await expect(tl).toContainText("2027");
    await tl.getByText("Düzeltme geçmişi (1)").click();
    await expect(tl).toContainText("Revizyon 1 · Ahmet Usta");
    await expect(tl).toContainText("84.000 km");
    await tl.getByTestId("zaman-daha-fazla").click();
    await expect(tl.getByTestId("zaman-olay")).toHaveCount(30);
    expect(timelineCalls.some((c) => c.p_offset === 20)).toBeTruthy();
    await expect(tl.getByTestId("zaman-daha-fazla")).toHaveCount(0);
    await shot(page, `servis-zaman-cizelgesi-${info.project.name}`);
  });

  test("mobil klavye: km alanı odaktayken KAYDET görünür (sticky), yatay taşma yok", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "mobile-390", "yalnız mobil");
    await setupServis(page, baseURL!);
    await page.getByRole("textbox", { name: "Güncel kilometre" }).focus();
    // Klavye açıkken görünür alanın ~yarıya inmesini taklit et.
    await page.setViewportSize({ width: 390, height: 420 });
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Bakımı Kaydet" })).toBeInViewport();
    await noHorizontalOverflow(page);
    for (const w of [360, 412]) {
      await page.setViewportSize({ width: w, height: 800 });
      await noHorizontalOverflow(page);
    }
  });
});

test.describe("Aşama E — bireysel", () => {
  test("ilk bakış: araç, km, sonraki bakım, kaynak sayıları, QR, son işlemler", async ({ page, baseURL }, info) => {
    await setupBireysel(page, baseURL!);
    await expect(page.getByText("34 OTZ 084").first()).toBeVisible();
    await expect(page.getByTestId("sonraki-bakim")).toHaveAttribute("data-level", "soon");
    await expect(page.getByTestId("bireysel-ozet")).toContainText("Servis doğrulamalı");
    await expect(page.getByTestId("bireysel-ozet")).toContainText("Bireysel kayıt");
    await expect(page.getByTestId("bireysel-ozet")).toContainText(/QR durumu/i);
    const preview = page.getByTestId("zaman-cizelgesi");
    await expect(preview).toContainText("Son İşlemler");
    await expect(preview.getByTestId("zaman-olay")).toHaveCount(5);
    // Sonraki bakım görseli ilk ekranda (fold üstü) görünür.
    await expect(page.getByTestId("sonraki-bakim")).toBeInViewport();
    await noHorizontalOverflow(page);
    await shot(page, `bireysel-genel-${info.project.name}`);
  });

  test("düzeltilen kayıt: sahip yalnız sade not görür, teknik audit ayrıntısı yok", async ({ page, baseURL }, info) => {
    const { historyCalls } = await setupBireysel(page, baseURL!);
    await expect(page.getByTestId("duzeltildi-notu").first()).toHaveText("Bu kayıt sonradan düzeltildi.");
    await expect(page.getByText(/Revizyon \d/)).toHaveCount(0);
    await expect(page.getByText("Ahmet Usta")).toHaveCount(0);
    expect(historyCalls.length, "sahip ekranı revizyon RPC'sini çağırmamalı").toBe(0);
    await page.getByRole("button", { name: /Tüm geçmişi gör/ }).click();
    // Nihai UX: serbest not yerine "Geçmiş İşlem Ekle" (bakım/parça ya da diğer kayıt).
    await expect(page.getByTestId("gecmis-islem-ekle")).toContainText("Geçmiş İşlem Ekle");
    await expect(page.getByRole("button", { name: "Bakım / Parça Değişimi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Diğer Araç Kaydı" })).toBeVisible();
    await expect(page.getByText("Kendi kaydını ekle (serbest not)")).toHaveCount(0);
    await expect(page.getByTestId("zaman-cizelgesi").getByTestId("zaman-olay")).toHaveCount(20);
    await shot(page, `bireysel-zaman-cizelgesi-${info.project.name}`);
  });

  test("boş veri: plan yok, kayıt yok → GRİ kartlar ve boş çizelge mesajı", async ({ page, baseURL }, info) => {
    await setupBireysel(page, baseURL!, { ...baseVehicle, next_service_km: null, next_service_date: null, muayene_tarihi: null, trafik_sigortasi_bitis: null }, []);
    await expect(page.getByTestId("sonraki-bakim")).toHaveAttribute("data-level", "none");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("Plan belirlenmedi");
    // Nihai UX: bakım yalnız "Sonraki Bakım" kartında (durum-bakim tekrarı yok).
    await expect(page.getByTestId("durum-bakim")).toHaveCount(0);
    for (const k of ["muayene", "trafik", "kasko", "detailing", "yaklasan"]) {
      await expect(page.getByTestId(`durum-${k}`)).toHaveAttribute("data-level", "none");
    }
    await expect(page.getByTestId("zaman-bos")).toBeVisible();
    await shot(page, `bireysel-bos-${info.project.name}`, false);
  });

  test("gecikmiş bakım: km aşıldı → KIRMIZI", async ({ page, baseURL }, info) => {
    await setupBireysel(page, baseURL!, { ...baseVehicle, current_km: 86100, next_service_km: 85000, next_service_date: isoInDays(90) });
    await expect(page.getByTestId("sonraki-bakim")).toHaveAttribute("data-level", "late");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("Bakım gecikti");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("1.100 km aşıldı");
    await shot(page, `bireysel-gecikmis-${info.project.name}`, false);
  });

  test("tarih + km çakışması: km uzak ama tarih geçti → KIRMIZI (en erken kritik koşul)", async ({ page, baseURL }) => {
    await setupBireysel(page, baseURL!, { ...baseVehicle, current_km: 70000, next_service_km: 85000, next_service_date: isoInDays(-3) });
    await expect(page.getByTestId("sonraki-bakim")).toHaveAttribute("data-level", "late");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("3 gün geçti");
  });

  test("yeşil: plan uzak → Bakım için zaman var", async ({ page, baseURL }) => {
    await setupBireysel(page, baseURL!, { ...baseVehicle, next_service_km: 95000, next_service_date: isoInDays(300) });
    await expect(page.getByTestId("sonraki-bakim")).toHaveAttribute("data-level", "ok");
    await expect(page.getByTestId("sonraki-bakim")).toContainText("Bakım için zaman var");
  });
});

test.describe("Aşama E — QR kısayolu ve panel listesi", () => {
  test("QR okutan onaylı servis: pasaportta 'Hızlı Bakım Kaydı Gir'", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "asamae.servis@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      "rpc/get_public_vehicle_passport": { raw: { vehicle: { plate: "34 *** 084", brand: "Volkswagen", model: "Passat", current_km: 84200 }, maintenance_records: [], maintenance_items: [] } },
      "rpc/vehicle_for_qr_viewer": { raw: { vehicle_id: VEHICLE_ID, role: "service" } },
    });
    await page.goto("/p/abc123def456");
    await expect(page.getByTestId("qr-kisayol")).toHaveText("Hızlı Bakım Kaydı Gir");
    await expect(page.getByTestId("qr-kisayol")).toHaveAttribute("href", `/panel/araclar/${VEHICLE_ID}`);
  });

  test("QR okutan anonim ziyaretçi: kısayol yok, RPC çağrılmaz", async ({ page }) => {
    let called = 0;
    await mockSupabaseRest(page, {
      "rpc/get_public_vehicle_passport": { raw: { vehicle: { plate: "34 *** 084", brand: "Volkswagen", model: "Passat", current_km: 84200 }, maintenance_records: [], maintenance_items: [] } },
    });
    await page.route("**/rest/v1/rpc/vehicle_for_qr_viewer", async (r) => {
      called++;
      await r.fulfill({ status: 200, contentType: "application/json", body: "null" });
    });
    await page.goto("/p/abc123def456");
    await page.getByText("Volkswagen").first().waitFor();
    await expect(page.getByTestId("qr-kisayol")).toHaveCount(0);
    expect(called).toBe(0);
  });

  test("servis araç listesi: sonraki bakım renk noktası", async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: STAFF_ID, email: "asamae.servis@ornek.com" }, baseURL!);
    const rows = [
      { id: "a1", plate: "34 AA 001", brand: "Fiat", model: "Egea", current_km: 86100, next_service_km: 85000, next_service_date: isoInDays(90), created_at: "2026-09-01T00:00:00Z" },
      { id: "a2", plate: "34 AA 002", brand: "Fiat", model: "Egea", current_km: 10000, next_service_km: 20000, next_service_date: isoInDays(300), created_at: "2026-08-01T00:00:00Z" },
    ];
    await mockSupabaseRest(page, {
      staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
      tenants: { single: { approval_status: "approved" } },
      vehicles: { list: rows },
    });
    await page.goto("/panel/dashboard");
    await page.getByText("34 AA 001").waitFor();
    await expect(page.locator('li:has-text("34 AA 001") [data-level]')).toHaveAttribute("data-level", "late");
    await expect(page.locator('li:has-text("34 AA 002") [data-level]')).toHaveAttribute("data-level", "ok");
  });
});
