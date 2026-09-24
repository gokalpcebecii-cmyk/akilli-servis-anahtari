import { test, expect } from "@playwright/test";

// 04A-S — bu dosya, e2e testlerinin artık gerçek Production Supabase
// alan adına (sbfsiwqxbsojcxdutnem.supabase.co) HİÇ istek atmadığını
// doğrudan ağ seviyesinde kanıtlar. NEXT_PUBLIC_SUPABASE_URL artık
// `.invalid` kullanıyor — RFC 2606 gereği bu TLD ağda ASLA çözülemez, bu
// yüzden mock'lanmamış/eksik bir page.route() olsa bile istek Production'a
// (veya herhangi bir gerçek sunucuya) ulaşamaz; yalnızca DNS/ağ hatası
// alır. Bu test o garantiyi varsaymak yerine ÖLÇER: uygulamanın fiilen
// hangi host'a istek attığını yakalar ve gerçek Production host'unun asla
// göründüğünü doğrulamaz.

test.describe("Takip turu — e2e testleri Production Supabase'den izole", () => {
  test("Supabase'e giden istekler yalnızca .invalid test alanını hedefler; Production host'una (sbfsiwqxbsojcxdutnem.supabase.co) hiçbir istek gitmez", async ({
    page,
  }) => {
    const supabaseHosts = new Set<string>();

    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname.includes("supabase")) {
        supabaseHosts.add(url.hostname);
        // .invalid gerçekten çözülemeyeceği için burada sahte bir yanıt
        // döndürüyoruz — bu testin amacı sayfanın işlevsel çalışması
        // değil, İSTEĞİN HANGİ HOST'A gittiğinin kanıtlanmasıdır.
        await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        return;
      }
      await route.continue();
    });

    // /p/[code] — hiçbir mock kurulmadan, RPC çağrısını (get_public_vehicle_passport)
    // koşulsuz tetikleyen genel pasaport sayfası.
    await page.goto("/p/herhangi-bir-test-kodu");
    await page.waitForTimeout(500);

    expect(supabaseHosts.size, "en az bir Supabase isteği yakalanmalıydı (aksi halde bu test hiçbir şey kanıtlamıyor)").toBeGreaterThan(0);

    for (const host of supabaseHosts) {
      expect(host, `Supabase isteği GERÇEK Production hostuna gitti: ${host}`).not.toContain("sbfsiwqxbsojcxdutnem");
      expect(host.endsWith(".supabase.invalid"), `Beklenmeyen/tanınmayan host: ${host}`).toBe(true);
    }
  });

  test("Mock kurulmamış bir tabloya giden istek bile .invalid dışına çıkmaz (herhangi bir sızıntı yolu yok)", async ({ page, baseURL }) => {
    const { installMockSession } = await import("./fixtures/mockAuth");
    const leakedToRealHost: string[] = [];

    await installMockSession(page.context(), { id: "eeeeeeee-1111-1111-1111-111111111111", email: "izolasyon@ornek.com" }, baseURL!);

    // Kasıtlı olarak mockSupabaseRest KURULMUYOR — yalnızca gerçek/harici
    // bir hosta giden herhangi bir isteği yakalayıp işaretleyen bir gözlemci
    // route'u var. Uygulama qr_keys/vehicles gibi tablolara istek atsa bile
    // bunlar yalnızca .invalid'e gider, asla gerçek bir sunucuya ulaşmaz.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname.includes("supabase") && !url.hostname.endsWith(".supabase.invalid")) {
        leakedToRealHost.push(url.href);
      }
      if (url.hostname.includes("supabase")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      }
      await route.continue();
    });

    await page.goto("/panel/dashboard");
    await page.waitForTimeout(500);

    expect(leakedToRealHost, "hiçbir Supabase isteği .invalid dışında bir hosta gitmemeli: " + JSON.stringify(leakedToRealHost)).toEqual([]);
  });
});
