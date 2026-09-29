// OTOİZ DÜZELTME 01 — Yönetim > Araçlar toplam sayacı (tarayıcı testi).
//
// /api/admin/araclar Playwright ile taklit edilir (25.009 araçlık veri kümesi
// mantığı: 50'lik cursor sayfa, ilk sayfada `total`, aramada eşleşen sayı).
// Test edilen şey gerçek yönetim ekranı kodu: sayacın görünürlüğü, arama
// sonrası metin, "Daha fazla göster" sonrası toplamın korunması ve hızlı
// yazarken eski yanıtın yenisini ezmemesi.
import { test, expect } from "@playwright/test";
import { installMockSession } from "./fixtures/mockAuth";

const N = 25009;
const PAGE = 50;
const plate = (i: number) => `34 T${String.fromCharCode(65 + (i % 26))} ${String(i).padStart(5, "0")}`;
const ALL = Array.from({ length: N }, (_, i) => ({ id: `v-${i}`, plate: plate(i), key: plate(i).replace(/\s/g, "") }));
const SHOTS = process.env.SHOT_DIR;

test.describe("DÜZELTME 01 araç sayacı", () => {
  test("toplam belirgin, aramada doğru, sayfalamada korunur, eski yanıt ezmez", async ({ page, context, baseURL }, info) => {
    await installMockSession(context, { id: "00000000-0000-4000-8000-0000000000ad", email: "admin@example.invalid" }, baseURL!);
    const calls: string[] = [];
    await page.route("**/api/admin/**", async (route) => {
      const url = new URL(route.request().url());
      const json = (b: any) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
      if (url.pathname === "/api/admin/me") return json({ email: "admin@example.invalid" });
      if (url.pathname === "/api/admin/overview") return json({ tenants: [], counts: {} });
      if (url.pathname === "/api/admin/araclar") {
        const q = (url.searchParams.get("q") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const cursor = url.searchParams.get("cursor");
        calls.push(`${q}|${cursor ?? ""}`);
        const rows = q ? ALL.filter((v) => v.key.includes(q)) : ALL;
        const start = cursor ? Number(cursor) : 0;
        const page_ = rows.slice(start, start + PAGE);
        // "3" araması kasıtlı yavaş: kullanıcı "34TA" yazmaya devam ederken geç gelir
        if (q === "3") await new Promise((r) => setTimeout(r, 1500));
        return json({
          total: cursor ? null : rows.length,
          next_cursor: start + PAGE < rows.length ? String(start + PAGE) : null,
          vehicles: page_.map((v) => ({ id: v.id, plate: v.plate, brand: "Fiat", model: "Egea", year: 2020, current_km: 1000, next_service_km: null, owner_type: "bireysel", owner_email: null, tenant_name: null, active_qr: null })),
        });
      }
      return json({});
    });

    await page.goto("/yonetim");
    await page.getByRole("button", { name: "Araçlar", exact: true }).click();

    const box = page.getByTestId("arac-toplam");
    const num = page.getByTestId("arac-toplam-sayi");
    const detail = page.getByTestId("arac-toplam-detay");
    await expect(num).toHaveText("25.009");
    await expect(detail).toHaveText("en yeni önce · 50 gösteriliyor");
    // Belirgin: görünür, ekran içinde, büyük punto
    await expect(box).toBeInViewport();
    const fs = await num.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThanOrEqual(22);
    // Taşma yok (mobil dahil)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/araclar_${info.project.name}_toplam.png` });

    // Sayfalama: "Daha fazla göster" sonrası toplam aynı, gösterilen artar
    await page.getByRole("button", { name: "Daha fazla göster" }).click();
    await expect(detail).toHaveText("en yeni önce · 100 gösteriliyor");
    await expect(num).toHaveText("25.009");

    // Hızlı yazma: "3" (yavaş) → "34TA" (hızlı). Eski "3" yanıtı ekranı ezmemeli.
    const input = page.getByLabel("Plaka ile ara");
    await input.fill("3");
    await input.fill("34TA");
    const expectedTA = ALL.filter((v) => v.key.includes("34TA")).length;
    await expect(detail).toHaveText(`“34TA” için ${expectedTA.toLocaleString("tr-TR")} sonuç · 50 gösteriliyor`);
    await page.waitForTimeout(1800); // yavaş yanıt bu sürede gelir
    await expect(detail).toHaveText(`“34TA” için ${expectedTA.toLocaleString("tr-TR")} sonuç · 50 gösteriliyor`);
    await expect(num).toHaveText("25.009");
    await expect(page.locator("strong", { hasText: /^34 T/ }).first()).toHaveText(/^34 TA /);
    if (SHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${SHOTS}/araclar_${info.project.name}_arama.png` });
    }

    // Sonuçsuz arama
    await input.fill("ZZZ999");
    await expect(detail).toHaveText("“ZZZ999” için 0 sonuç · 0 gösteriliyor");
    await expect(page.getByText("Araç bulunamadı.")).toBeVisible();

    // Aramayı temizle: tüm liste ve toplam geri gelir
    await input.fill("");
    await expect(detail).toHaveText("en yeni önce · 50 gösteriliyor");
    await expect(num).toHaveText("25.009");

    // Sekmeden çıkıp dönünce arama kutusu ile liste tutarlı
    await input.fill("34TA");
    await expect(detail).toContainText("“34TA” için");
    await page.getByRole("button", { name: "Genel Bakış", exact: true }).click();
    await page.getByRole("button", { name: "Araçlar", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(detail).toHaveText("en yeni önce · 50 gösteriliyor");
  });
});
