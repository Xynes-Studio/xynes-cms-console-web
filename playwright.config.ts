import { defineConfig } from "@playwright/test";

const e2ePort = Number(process.env.PLAYWRIGHT_E2E_PORT ?? "3200");
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Next.js fixture compilation can exceed the per-test timeout when several
  // cold routes are requested in parallel. Match CI locally for determinism.
  workers: 1,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chrome",
      use: {
        browserName: "chromium",
        ...(chromiumExecutablePath
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : { channel: "chrome" }),
      },
    },
  ],
  webServer: {
    command:
      `node ../infra/scripts/with-env.mjs next dev --hostname 127.0.0.1 --port ${e2ePort}`,
    env: {
      ...process.env,
      CMS_CONSOLE_PORT: String(e2ePort),
      NEXT_PUBLIC_SUPABASE_URL: "https://fixtures.supabase.local",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
      NEXT_PUBLIC_API_URL: `${e2eBaseUrl}/api/e2e`,
      NEXT_PUBLIC_AUTH_APP_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_APP_URL: e2eBaseUrl,
      NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS: `127.0.0.1:${e2ePort},localhost:${e2ePort}`,
      NEXT_PUBLIC_ENABLE_E2E_FIXTURES: "1",
    },
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
