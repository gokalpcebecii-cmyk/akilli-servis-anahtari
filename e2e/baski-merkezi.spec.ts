// OTOİZ Aşama B — Baskı Merkezi uçtan uca (tarayıcı) testi.
//
// Sunucu API'si (/api/admin/*) Playwright ile taklit edilir; test edilen şey
// gerçek tarayıcı kodu: parti üretim ekranı, otomatik doğrulama (QR'ların
// jsQR ile geri okunması, adres/ortam kontrolleri, 7 dosyanın üretilmesi),
// sonuç paneli ve indirmeler. Veritabanı tarafı (admin_verify_product_batch)
// staging'de ayrıca SQL ile test edilir.
//
// Build: NEXT_PUBLIC_QR_BASE_URL=https://go.otoizgo.com (production tabanı).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { installMockSession } from "./fixtures/mockAuth";
const { generateQrCode } = require("../lib/qrToken");
const { generateActivationCode } = require("../lib/activationCodeGen");

const BATCH_ID = "3f1c2d9e-0000-4000-8000-00000000b001";

test.describe("Baskı Merkezi", () => {
  test.skip(({ isMobile }) => !!isMobile, "masaüstü yönetim ekranı");
  test.setTimeout(120_000);

  test("100 ürün: otomatik doğrulama BASKIYA HAZIR + 7 dosya ZIP", async ({ page, context, baseURL }) => {
    await installMockSession(context, { id: "00000000-0000-4000-8000-0000000000ad", email: "admin@example.invalid" }, baseURL!);
    const N = 100;
    const items = Array.from({ length: N }, (_, i) => ({
      id: `id-${i}`,
      serial_no: `OTZ-${String(22 + i).padStart(6, "0")}`,
      token: generateQrCode(),
      activation_code: generateActivationCode(),
    }));
    const serverV = {
      ready: false, server_ok: true, client_ok: false, count: N,
      serial_first: items[0].serial_no, serial_last: items[N - 1].serial_no,
      checks: {
        count_match: { ok: true, expected: N, actual: N },
        serial_unique: { ok: true, passed: N, total: N },
        serial_contiguous: { ok: true, warning_only: true },
        token_unique: { ok: true, passed: N, total: N, duplicates: 0 },
        batch_consistent: { ok: true, mismatch: 0 },
        no_missing: { ok: true, missing: 0 },
        code_match: { ok: true, passed: N, total: N },
      },
      client: null,
    };
    let clientReport: any = null;
    let stored: any = null;

    await page.route("**/api/admin/**", async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const json = (b: any) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
      if (url.pathname === "/api/admin/me") return json({ email: "admin@example.invalid" });
      if (url.pathname === "/api/admin/overview") return json({ tenants: [], counts: {} });
      if (url.pathname === "/api/admin/urunler" && method === "GET") {
        return json({ batches: stored ? [{ id: BATCH_ID, label: "Test 100", quantity: N, default_channel: null, created_at: new Date().toISOString(), verification: stored, counts: { created: N }, serial_first: items[0].serial_no, serial_last: items[N - 1].serial_no, channels: [] }] : [] });
      }
      if (url.pathname === "/api/admin/urunler" && method === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        if (body.action === "generate") {
          expect(body.count).toBe(N);
          stored = serverV;
          return json({ ok: true, batch_id: BATCH_ID, label: "Test 100", channel: null, items: items.map(({ id, serial_no, token, activation_code }) => ({ id, serial_no, token, activation_code })), verification: serverV });
        }
        if (body.action === "verify") {
          clientReport = body.client;
          stored = { ...serverV, client: clientReport, client_ok: !!clientReport.ok, ready: serverV.server_ok && !!clientReport.ok };
          return json({ ok: true, verification: stored });
        }
      }
      return json({});
    });

    await page.goto("/yonetim");
    await page.getByRole("button", { name: /Ürünler \/ Baskı Merkezi/ }).click();
    await page.getByRole("button", { name: "100 adet" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "100 ürün üret" }).click();

    const panel = page.getByTestId("batch-result").getByTestId("batch-verification");
    await expect(panel.getByTestId("batch-ready")).toHaveText(/BASKIYA HAZIR$/, { timeout: 90_000 });
    await expect(panel).toContainText("QR doğrulama");
    await expect(panel).toContainText("100/100 PASS");
    await expect(panel).toContainText(`${items[0].serial_no} – ${items[N - 1].serial_no}`);
    await page.screenshot({ path: "test-results/baski-merkezi-hazir.png", fullPage: true });

    // Tarayıcı raporu gerçek ölçüm içeriyor ve kod/token taşımıyor.
    expect(clientReport.ok).toBe(true);
    expect(clientReport.checks.qr_decode.passed).toBe(N);
    expect(clientReport.checks.url_format.passed).toBe(N);
    expect(Object.keys(clientReport.files).sort()).toEqual(["packing_csv", "packing_pdf", "print_csv", "qr_pdf", "secret_csv", "serial_txt", "svg_zip"]);
    const reportText = JSON.stringify(clientReport);
    for (const it of items.slice(0, 10)) {
      expect(reportText).not.toContain(it.activation_code);
      expect(reportText).not.toContain(it.token);
    }

    // Tüm dosyalar (ZIP)
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-all").click()]);
    const zipPath = await dl.path();
    const files = unzipSync(new Uint8Array(fs.readFileSync(zipPath!)));
    const names = Object.keys(files).sort();
    expect(names.length).toBe(7);
    expect(names.every((n) => n.startsWith("Test_100_"))).toBe(true);
    const printCsv = strFromU8(files[names.find((n) => n.includes("_3_baski_listesi"))!]);
    expect(printCsv).toContain(`https://go.otoizgo.com/${items[5].token}`);
    expect(printCsv).not.toContain(items[5].activation_code);
    const svgZip = unzipSync(files[names.find((n) => n.endsWith("_6_QR_SVG.zip"))!]);
    expect(Object.keys(svgZip).length).toBe(N);
    const serials = strFromU8(files[names.find((n) => n.includes("_5_seri_listesi"))!]);
    expect(serials).toContain(`${items[0].serial_no} – ${items[N - 1].serial_no} (100 adet)`);
    const qrPdf = files[names.find((n) => n.endsWith("_1_QR_baski.pdf"))!];
    expect(strFromU8(qrPdf.slice(0, 5))).toBe("%PDF-");
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync("test-results/baski-merkezi-e2e.zip", fs.readFileSync(zipPath!));
    fs.writeFileSync("test-results/baski-merkezi-e2e-items.json", JSON.stringify(items.map(({ serial_no, token }) => ({ serial_no, token }))));

    // Parti listesinde rozet
    await page.getByRole("button", { name: /Kapat/ }).click({ trial: true });
    await expect(page.getByTestId("batch-ready-badge").first()).toHaveText("BASKIYA HAZIR");
  });
});
