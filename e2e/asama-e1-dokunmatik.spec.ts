import { test, expect, Page, Locator } from "@playwright/test";
import { installMockSession, mockSupabaseRest } from "./fixtures/mockAuth";

// OTOİZ Aşama E.1 telefon testi düzeltmesi: tek dokunuşta imleç dokunulan
// harfe gelir. iPhone Safari tek dokunuşta imleci en yakın KELİME sınırına
// atar; burada bu davranış taklit edilir (dokunuştan hemen sonra imleci kelime
// sınırına taşıyan bir dinleyici) ve düzeltmenin imleci yine dokunulan harfe
// koyduğu doğrulanır. Düzeltme olmasa bu testler düşer.

test.use({ hasTouch: true });

const OWNER_ID = "e1e1e1e1-2222-4000-8000-000000000001";

// iOS'un "kelime sınırına yapış" davranışını taklit eder.
async function simulateWordSnap(page: Page) {
  await page.evaluate(() => {
    document.addEventListener("touchend", () => {
      // iPhone imleci dokunuştan hemen sonra VE çift dokunuş beklemesinden
      // sonra (~420 ms) kelime sınırına koyar; ikisi de taklit edilir.
      const snapLater = (delay: number) => setTimeout(() => {
        const el = document.activeElement as HTMLInputElement;
        if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
        const v = el.value;
        const at = el.selectionStart ?? v.length;
        // en yakın kelime sınırı (harf/rakam olmayan karakter ya da uç)
        const isW = (c: string) => /[\p{L}\p{N}]/u.test(c);
        let l = at;
        while (l > 0 && isW(v[l - 1])) l--;
        let r = at;
        while (r < v.length && isW(v[r])) r++;
        const snap = at - l <= r - at ? l : r;
        try {
          el.setSelectionRange(snap, snap);
        } catch {}
      }, delay);
      snapLater(20);
      snapLater(420);
    });
  });
}

// k. karakter sınırının hemen sağına (bir sonraki harfin %25'ine) dokun.
async function tapAtChar(page: Page, input: Locator, k: number) {
  const pt = await input.evaluate((el: HTMLInputElement, k: number) => {
    const cs = getComputedStyle(el);
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ls = parseFloat(cs.letterSpacing) || 0;
    const w = (s: string) => c.measureText(s).width + ls * s.length;
    const r = el.getBoundingClientRect();
    const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft) - el.scrollLeft;
    const x = left + w(el.value.slice(0, k)) + w(el.value[k] || " ") * 0.25;
    return { x, y: r.top + r.height / 2 };
  }, k);
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForTimeout(1000);
}

async function caret(input: Locator) {
  return input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]);
}

test("E-posta: ortadaki harfe dokununca imleç tam oraya gelir ve yazılan harf oraya girer", async ({ page }) => {
  await page.goto("/bireysel/kayit");
  const email = page.locator("#kayit-email");
  await email.fill("gokalp.cebeci@gmail.com");
  await page.locator("#kayit-ad").click();
  await simulateWordSnap(page);
  // "gokalp.ce|beci" → 9
  await tapAtChar(page, email, 9);
  await expect(email).toBeFocused();
  expect(await caret(email)).toEqual([9, 9]);
  await page.keyboard.type("X");
  await expect(email).toHaveValue("gokalp.ceXbeci@gmail.com");
  expect(await caret(email)).toEqual([10, 10]);
  // odaktayken ikinci dokunuş: "gok|alp" → 3
  await tapAtChar(page, email, 3);
  expect(await caret(email)).toEqual([3, 3]);
  await page.keyboard.type("Y");
  await expect(email).toHaveValue("gokYalp.ceXbeci@gmail.com");
});

for (const [path, id] of [
  ["/bireysel/giris", "#bireysel-email"],
  ["/panel/login", "#panel-email"],
] as const) {
  test(`Giriş ekranı ${path}: e-postada ortadaki harfe dokunup ekleme`, async ({ page }) => {
    await page.goto(path);
    const email = page.locator(id);
    await email.fill("gokalpcebecii1@gmail.com");
    await page.locator('input[type="password"]').first().click();
    await simulateWordSnap(page);
    // "gokalpce|becii1" → 8
    await tapAtChar(page, email, 8);
    await expect(email).toBeFocused();
    expect(await caret(email)).toEqual([8, 8]);
    await page.keyboard.type("Z");
    await expect(email).toHaveValue("gokalpceZbecii1@gmail.com");
  });
}

test("E-posta alanı e-posta klavyesi açar ve imleç seçimini destekler", async ({ page }) => {
  await page.goto("/bireysel/kayit");
  const email = page.locator("#kayit-email");
  await expect(email).toHaveAttribute("inputmode", "email");
  await expect(email).toHaveAttribute("type", "text");
  await email.fill("a@b.co");
  expect(await email.evaluate((el: HTMLInputElement) => el.selectionStart)).not.toBeNull();
});

test.describe("araç formu", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installMockSession(page.context(), { id: OWNER_ID, email: "e1.dokun@ornek.com" }, baseURL!);
    await mockSupabaseRest(page, {
      vehicles: { single: null, list: [] },
      maintenance_records: { list: [] },
      maintenance_items: { list: [] },
      "rpc/list_my_pending_outgoing_transfers": { list: [] },
    });
    await page.goto("/bireysel/araclar/yeni");
    await page.getByTestId("marka-model").waitFor();
    await simulateWordSnap(page);
  });

  test("Km: 84.200 içinde ortadaki rakama dokunup düzeltme", async ({ page }) => {
    const km = page.getByPlaceholder("Örn. 52430");
    await km.pressSequentially("84200");
    await expect(km).toHaveValue("84.200");
    await page.locator('[data-field="plate"]').click();
    // "84.2|00" → 4; 2'yi silip 5 yaz
    await tapAtChar(page, km, 4);
    expect(await caret(km)).toEqual([4, 4]);
    await page.keyboard.press("Backspace");
    await page.keyboard.type("5");
    await expect(km).toHaveValue("84.500");
    expect(await caret(km)).toEqual([4, 4]);
    // "8|4.500" → 1; araya 1 ekle → 814.500
    await tapAtChar(page, km, 1);
    expect(await caret(km)).toEqual([1, 1]);
    await page.keyboard.type("1");
    await expect(km).toHaveValue("814.500");
    expect(await caret(km)).toEqual([2, 2]);
  });

  test("Plaka: ortadaki harfe dokunup ekleme", async ({ page }) => {
    const plate = page.locator('[data-field="plate"]');
    await plate.fill("34 OTZ 084");
    await page.getByPlaceholder("Örn. 52430").click();
    // "34 OT|Z 084" → 5
    await tapAtChar(page, plate, 5);
    expect(await caret(plate)).toEqual([5, 5]);
    await page.keyboard.type("a");
    await expect(plate).toHaveValue("34 OTAZ 084");
    expect(await caret(plate)).toEqual([6, 6]);
  });

  test("Uzun basma ve sürükleme tarayıcıya bırakılır", async ({ page }) => {
    const plate = page.locator('[data-field="plate"]');
    await plate.fill("34 OTZ 084");
    await plate.evaluate((el: HTMLInputElement) => {
      el.focus();
      el.setSelectionRange(0, 2);
    });
    // seçim varken zamanlayıcılar seçimi bozmaz
    const box = (await plate.boundingBox())!;
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    expect(await caret(plate)).toEqual([0, 2]);
    expect(box.width).toBeGreaterThan(0);
  });
});
