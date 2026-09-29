import { test, expect, Page } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";
import { pickBrandModel } from "./fixtures/brandModel";

// OTOİZ son cila — production öncesi kapanış kontrolü. pilot-fix-03-round2 ve
// vehicle-form-bugfix içindeki eski testler, uygulama sonradan değiştiği için
// (servis kaydı tek RPC'ye taşındı, km binlik ayraçla gösteriliyor, devir ve
// QR eşleştirme pilotta açıldı) artık eski seçici/istekleri bekliyor. Bu dosya
// o testlerin koruduğu pilot kritik davranışları BUGÜNKÜ akış üzerinden
// yeniden doğrular. Yalnız ağ katmanı mock; gerçek component kodu.

const OWNER_ID = "5c5c5c5c-0000-4000-8000-000000000001";
const STAFF_ID = "5c5c5c5c-0000-4000-8000-000000000002";
const TENANT_ID = "5c5c5c5c-0000-4000-8000-000000000003";
const VEHICLE_ID = "5c5c5c5c-0000-4000-8000-000000000004";
const CREATED_ID = "5c5c5c5c-0000-4000-8000-000000000005";

const vehicle = {
  id: VEHICLE_ID,
  plate: "34 SC 001",
  brand: "Renault",
  model: "Clio",
  year: 2019,
  current_km: 77000,
  next_service_km: 87650,
  next_service_date: "2027-03-15",
  muayene_tarihi: null,
  trafik_sigortasi_bitis: null,
  kasko_bitis: null,
  notes: null,
};

type RpcReply = { status: number; body: unknown } | "abort";

async function setupServis(page: Page, baseURL: string, rpc: RpcReply, opts: { failRefresh?: boolean } = {}) {
  await installMockSession(page.context(), { id: STAFF_ID, email: "kapanis.servis@ornek.com" }, baseURL);
  const v = { ...vehicle, tenant_id: TENANT_ID, owner_user_id: null };
  await mockSupabaseRest(page, {
    vehicles: { single: v, list: [v] },
    maintenance_records: { list: [] },
    qr_keys: { single: null, list: [] },
    staff_users: { single: { id: STAFF_ID, tenant_id: TENANT_ID } },
    tenants: { single: { id: TENANT_ID, name: "Kapanış Test Servis" } },
    "rpc/vehicle_timeline": { raw: { rows: [], has_more: false, total: 0 } },
  });
  const state = { rpcCalls: [] as any[], afterRpc: false };
  await page.route("**/rest/v1/maintenance_items**", async (route) => {
    if (opts.failRefresh && state.afterRpc) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "okuma hatası" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/rest/v1/rpc/record_service_visit", async (route) => {
    state.rpcCalls.push(route.request().postDataJSON());
    state.afterRpc = true;
    if (rpc === "abort") return route.abort();
    await route.fulfill({ status: rpc.status, contentType: "application/json", body: JSON.stringify(rpc.body) });
  });
  await page.goto(`/panel/araclar/${VEHICLE_ID}`);
  await page.getByText(v.plate).first().waitFor();
  return state;
}

const OK = { status: 200, body: { ok: true, duplicate: false, record_id: "x", service_verified: true } };

async function expectNoSuccessAndRetryable(page: Page) {
  await expect(page.getByText(/Kayıt tamamlandı/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "KAYDET" })).toBeEnabled();
}

test.describe("Kapanış — servis hızlı bakım kaydı (tek RPC)", () => {
  test("çoklu işlem + not tek RPC çağrısında, tüm adlar açıklamada; başarı mesajı çıkar", async ({ page, baseURL }) => {
    const s = await setupServis(page, baseURL!, OK);
    for (const name of ["Motor Yağı", "Yağ Filtresi", "Hava Filtresi"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await page.getByTestId("servis-not").fill("ön lastikler 3 mm");
    await page.getByRole("button", { name: "KAYDET" }).click();
    await expect(page.getByText(/Kayıt tamamlandı/)).toBeVisible();
    expect(s.rpcCalls.length).toBe(1);
    const body = s.rpcCalls[0];
    expect(body.p_items.map((i: any) => i.key).sort()).toEqual(["hava_filtresi", "motor_yagi", "yag_filtresi"]);
    for (const label of ["Motor Yağı", "Yağ Filtresi", "Hava Filtresi", "Not: ön lastikler 3 mm"]) expect(body.p_description).toContain(label);
    expect(body.p_vehicle_id).toBe(VEHICLE_ID);
    expect(body.p_request_id).toBeTruthy();
  });

  test("sunucu hatası: başarı yok, açık Türkçe hata, KAYDET yeniden kullanılabilir", async ({ page, baseURL }) => {
    await setupServis(page, baseURL!, { status: 500, body: { message: "internal" } });
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("Kayıt yapılamadı; hiçbir değişiklik kaydedilmedi.");
    await expect(page.locator('p[role="alert"]')).not.toContainText("internal");
    await expectNoSuccessAndRetryable(page);
  });

  test("düşük kilometre (sunucu reddi): anlaşılır mesaj", async ({ page, baseURL }) => {
    await setupServis(page, baseURL!, { status: 400, body: { message: "km_lower_than_current", code: "P0001" } });
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("düşük olamaz");
    await expectNoSuccessAndRetryable(page);
  });

  test("yetki yok / onaysız işletme: anlaşılır mesaj", async ({ page, baseURL }) => {
    await setupServis(page, baseURL!, { status: 403, body: { message: "forbidden", code: "42501" } });
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("yetkiniz yok");
    await expectNoSuccessAndRetryable(page);
  });

  test("bağlantı kopması: başarı yok, bağlantı hatası, KAYDET yeniden etkin", async ({ page, baseURL }) => {
    await setupServis(page, baseURL!, "abort");
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("bağlantı hatası");
    await expectNoSuccessAndRetryable(page);
  });

  test("kayıt sonrası ekran yenilenemezse: normal başarı yok, 'yeniden göndermeyin' uyarısı, seçim korunur", async ({ page, baseURL }) => {
    await setupServis(page, baseURL!, OK, { failRefresh: true });
    await page.getByRole("button", { name: "Motor Yağı", exact: true }).click();
    await page.getByRole("button", { name: "KAYDET" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("Yeniden göndermeyin");
    await expect(page.getByText(/Kayıt tamamlandı/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Motor Yağı", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
});

async function setupOwnerEdit(page: Page, baseURL: string, patchStatus: number) {
  await installMockSession(page.context(), { id: OWNER_ID, email: "kapanis.sahip@ornek.com" }, baseURL);
  const v = { ...vehicle, tenant_id: null, owner_user_id: OWNER_ID };
  await mockSupabaseRest(page, {
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: null, list: [] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
    "rpc/vehicle_timeline": { raw: { rows: [], has_more: false, total: 0 } },
  });
  const patches: any[] = [];
  await page.route("**/rest/v1/vehicles**", async (route) => {
    if (route.request().method() === "PATCH") {
      patches.push(route.request().postDataJSON());
      await route.fulfill({ status: patchStatus, contentType: "application/json", body: patchStatus === 200 ? "[]" : JSON.stringify({ message: "hata" }) });
      return;
    }
    const single = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single ? v : [v]) });
  });
  await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
  await page.getByText(vehicle.plate).first().waitFor();
  await page.getByRole("button", { name: "Düzenle" }).click();
  await page.getByTestId("arac-formu").waitFor();
  return patches;
}

test.describe("Kapanış — bireysel araç düzenleme", () => {
  test("hiçbir şey değiştirmeden Kaydet: mevcut bakım planı AYNEN korunur", async ({ page, baseURL }) => {
    const patches = await setupOwnerEdit(page, baseURL!, 200);
    await expect(page.locator("#arac-next-km")).toHaveValue("87.650");
    await expect(page.locator("#arac-next-date")).toHaveValue("2027-03-15");
    await page.getByTestId("arac-formu").getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0].next_service_km).toBe(87650);
    expect(patches[0].next_service_date).toBe("2027-03-15");
    expect(patches[0].current_km).toBe(77000);
  });

  test("kayıt hatası: form açık kalır, başarı izlenimi verilmez", async ({ page, baseURL }) => {
    const patches = await setupOwnerEdit(page, baseURL!, 500);
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      d.accept();
    });
    await page.getByTestId("arac-formu").getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => patches.length).toBe(1);
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain("Kaydedilemedi");
    await expect(page.getByRole("button", { name: "Kapat" })).toBeVisible();
    await expect(page.getByTestId("arac-formu")).toBeVisible();
  });
});

test.describe("Kapanış — yeni araç ve yönlendirmeler", () => {
  test("Aracı Oluştur'a aynı anda iki tıklama tek POST üretir", async ({ page, baseURL }) => {
    let posts = 0;
    await installMockSession(page.context(), { id: OWNER_ID, email: "kapanis.yeni@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, { vehicles: { list: [] }, "rpc/list_my_pending_outgoing_transfers": { list: [] } });
    await page.route("**/api/vehicles", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ vehicle: { id: CREATED_ID } }) });
    });
    await page.goto("/bireysel/araclar/yeni");
    await page.locator("#arac-plate").fill("34 SC 002");
    await pickBrandModel(page, "Fiat", "Egea");
    await page.locator("#arac-year").fill("2020");
    await page.locator("#arac-km").pressSequentially("40000");
    // İki tıklama aynı olay döngüsünde: React yeniden çizmeden ikincisi gelir.
    await page.getByRole("button", { name: "Aracı Oluştur" }).evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
    await page.waitForURL(new RegExp(`/bireysel/araclar/${CREATED_ID}$`));
    expect(posts).toBe(1);
  });

  test("eski /panel/araclar adresi servis paneline yönlenir", async ({ request }) => {
    const res = await request.get("/panel/araclar", { maxRedirects: 0 });
    expect([307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toMatch(/\/panel\/dashboard$/);
  });

  test("QR eşleştirme API'si kimliksiz isteği reddeder", async ({ request }) => {
    const res = await request.post("/api/qr-eslestir", { data: { code: "x", vehicle_id: VEHICLE_ID } });
    expect(res.status()).toBe(401);
  });
});

test.describe("Kapanış — sahiplik devri (pilotta açık)", () => {
  async function setupDevret(page: Page, baseURL: string, rpc: { status: number; body: unknown }) {
    await installMockSession(page.context(), { id: OWNER_ID, email: "kapanis.devir@ornek.com" }, baseURL);
    const v = { ...vehicle, tenant_id: null, owner_user_id: OWNER_ID };
    await mockSupabaseRest(page, { vehicles: { single: v, list: [v] } });
    const calls: any[] = [];
    await page.route("**/rest/v1/rpc/initiate_ownership_transfer", async (route) => {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ status: rpc.status, contentType: "application/json", body: JSON.stringify(rpc.body) });
    });
    await page.goto(`/bireysel/araclar/${VEHICLE_ID}/devret`);
    await page.getByRole("heading", { name: "Aracı Devret / Elden Çıkar" }).waitFor();
    return calls;
  }

  test("devret: onay kutusu olmadan başlamaz; başlatınca tek RPC ve paylaşım bağlantısı", async ({ page, baseURL }) => {
    const calls = await setupDevret(page, baseURL!, { status: 200, body: { token: "tok-123", expires_at: "2026-10-03T10:00:00Z" } });
    const start = page.getByRole("button", { name: "Devri Başlat" });
    await expect(start).toBeDisabled();
    await page.getByRole("checkbox").check();
    await start.click();
    await expect(page.getByRole("heading", { name: "Devir Başlatıldı" })).toBeVisible();
    await expect(page.getByText(/devir-kabul\/tok-123/).first()).toBeVisible();
    expect(calls).toEqual([{ p_vehicle_id: VEHICLE_ID }]);
  });

  test("devret: sunucu hatasında anlaşılır mesaj", async ({ page, baseURL }) => {
    await setupDevret(page, baseURL!, { status: 400, body: { message: "not_owner" } });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Devri Başlat" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Devir başlatılamadı. Lütfen tekrar deneyin.");
  });

  async function setupKabul(page: Page, baseURL: string, accept: { status: number; body: unknown }, loggedIn = true) {
    if (loggedIn) await installMockSession(page.context(), { id: CREATED_ID, email: "kapanis.alici@ornek.com" }, baseURL);
    await mockSupabaseRest(page, {
      "rpc/preview_ownership_transfer": { raw: { plate: "34 SC 001", brand: "Renault", model: "Clio", current_km: 77000, is_initiator: false } },
    });
    await page.route("**/rest/v1/rpc/accept_ownership_transfer", async (route) => {
      await route.fulfill({ status: accept.status, contentType: "application/json", body: JSON.stringify(accept.body) });
    });
    await page.goto("/bireysel/devir-kabul/tok-123");
    await page.getByText("34 SC 001").waitFor();
  }

  test("devir kabul: giriş yapmamış alıcı giriş/kayıt seçeneği görür", async ({ page, baseURL }) => {
    await setupKabul(page, baseURL!, { status: 200, body: {} }, false);
    await expect(page.getByRole("button", { name: "Giriş Yap" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hesap Oluştur" })).toBeVisible();
  });

  test("devir kabul: kabul edince tamamlandı ekranı", async ({ page, baseURL }) => {
    await setupKabul(page, baseURL!, { status: 200, body: { ok: true, vehicle_id: VEHICLE_ID } });
    await page.getByRole("button", { name: "Devri Kabul Et" }).click();
    await expect(page.getByRole("heading", { name: "Devir Tamamlandı" })).toBeVisible();
  });

  test("devir kabul: süresi dolmuş bağlantıda anlaşılır mesaj", async ({ page, baseURL }) => {
    await setupKabul(page, baseURL!, { status: 400, body: { message: "transfer_expired" } });
    await page.getByRole("button", { name: "Devri Kabul Et" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Bu devir bağlantısının süresi dolmuş.");
  });
});

test("Kapanış — QR kendi kendine üretim kapalı: araç detayı qr_keys'e yazma isteği göndermez", async ({ page, baseURL }) => {
  await installMockSession(page.context(), { id: OWNER_ID, email: "kapanis.qr@ornek.com" }, baseURL!);
  const v = { ...vehicle, tenant_id: null, owner_user_id: OWNER_ID };
  await mockSupabaseRest(page, {
    vehicles: { single: v, list: [v] },
    maintenance_records: { list: [] },
    maintenance_items: { list: [] },
    qr_keys: { single: null, list: [] },
    "rpc/list_my_pending_outgoing_transfers": { list: [] },
    "rpc/vehicle_timeline": { raw: { rows: [], has_more: false, total: 0 } },
  });
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/qr_keys") && !["GET", "HEAD"].includes(r.method())) writes.push(r.method());
  });
  await page.goto(`/bireysel/araclar/${VEHICLE_ID}`);
  await page.getByText(vehicle.plate).first().waitFor();
  await expect(page.getByText("QR Durumu").first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(writes).toEqual([]);
});

test("Kapanış — Yönetim > İşlem Kaydı: görüşler konu, kullanıcı, tarih, ekran ve metinle ayrışır ve aranır", async ({ page, context, baseURL }) => {
  await installMockSession(context, { id: "00000000-0000-4000-8000-0000000000ad", email: "admin@example.invalid" }, baseURL!);
  const fb = (i: number, category: string, screen: string, email: string, message: string) => ({
    id: `fb-${i}`, created_at: `2026-09-2${i}T10:1${i}:00Z`, action: "user_feedback", target_table: "auth.users", target_id: null,
    tenant_id: null, tenant_name: null, actor_email: email, detail: { category, screen, message, via: "gorus_bildir" },
  });
  const rows = [
    fb(9, "sorun", "arac_detay", "ayse@ornek.com", "Belgeler sekmesinde tarih kayboldu"),
    fb(8, "oneri", "ana_ekran", "mehmet@ornek.com", "Karanlık tema çok güzel olmuş"),
    fb(7, "soru", "qr", "ayse@ornek.com", "Anahtarlığı ikinci araca bağlayabilir miyim?"),
  ];
  const asked: string[] = [];
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (b: any) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (url.pathname === "/api/admin/me") return json({ email: "admin@example.invalid" });
    if (url.pathname === "/api/admin/overview") return json({ tenants: [], counts: {} });
    if (url.pathname === "/api/admin/islem-kaydi") {
      asked.push(url.searchParams.get("action") || "");
      return json({ rows: url.searchParams.get("action") === "user_feedback" ? rows : [], next_cursor: null });
    }
    return json({});
  });
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "İşlem Kaydı", exact: true }).click();
  await page.getByRole("button", { name: "Görüşler" }).click();
  const items = page.getByTestId("gorus-kaydi");
  await expect(items).toHaveCount(3);
  expect(asked).toContain("user_feedback");
  await expect(items.nth(0)).toContainText("Belgeler sekmesinde tarih kayboldu");
  await expect(items.nth(0).getByTestId("gorus-konu")).toHaveText("Sorun / hata");
  await expect(items.nth(0).getByTestId("gorus-ekran")).toHaveText("Ekran: Araç detayı");
  const row0 = page.locator("div").filter({ has: items.nth(0) }).last();
  await expect(row0).toContainText("ayse@ornek.com");
  await expect(row0).toContainText("Görüş bildirildi");
  await expect(row0).toContainText(/29\.09\.2026|2026/);

  await page.getByLabel("Görüşlerde ara").fill("ayse@");
  await expect(items).toHaveCount(2);
  await page.getByLabel("Görüşlerde ara").fill("anahtarlık");
  await expect(items).toHaveCount(1);
  await page.getByLabel("Görüşlerde ara").fill("");
  await page.getByLabel("Konu").selectOption("oneri");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Karanlık tema");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/yonetim_gorusler.png`, fullPage: true });
});
