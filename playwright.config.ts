import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
    screenshot: "off",
    // Bu ortamda önceden kurulu Chromium sürümü, @playwright/test'in
    // varsayılan olarak indirmeye çalıştığı sürümle eşleşmiyor; egress
    // politikası indirmeyi zaten engelliyor. Önceden kurulu ikiliyi
    // doğrudan kullanıyoruz (npx playwright install ÇALIŞTIRILMADI).
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    },
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-390",
      use: {
        viewport: { width: 390, height: 844 },
        userAgent: devices["iPhone 13"].userAgent,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // 04A-S: e2e testleri artık gerçek Production Supabase alan adını
      // (sbfsiwqxbsojcxdutnem.supabase.co) HİÇ KULLANMIYOR. `.invalid`,
      // RFC 2606 gereği ağda asla çözülemeyen (DNS resolve edilemeyen)
      // ayrılmış bir TLD'dir — bu yüzden mock'lanmamış/eksik bir
      // page.route() olsa bile istek Production'a (veya herhangi bir
      // gerçek sunucuya) ULAŞAMAZ, yalnızca DNS/network hatası alır.
      // Mock storage key'i (e2e/fixtures/mockAuth.ts) bu ref'le uyumlu.
      NEXT_PUBLIC_SUPABASE_URL: "https://otoiz-e2e-test.supabase.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90b2l6LWUyZS10ZXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzI3OTYsImV4cCI6MjEwNDk0ODc5Nn0.mock-signature-not-real-never-sent-to-a-server",
      SUPABASE_SERVICE_ROLE_KEY: "unavailable-in-this-session-placeholder",
    },
  },
});
