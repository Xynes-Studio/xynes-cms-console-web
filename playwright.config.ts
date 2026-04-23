import { defineConfig } from "@playwright/test";

const e2ePort = 3200;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: {
        browserName: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command:
      "CMS_CONSOLE_PORT=3200 NEXT_PUBLIC_SUPABASE_URL=https://fixtures.supabase.local NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key NEXT_PUBLIC_API_URL=http://127.0.0.1:3200/api/unused NEXT_PUBLIC_AUTH_APP_URL=http://127.0.0.1:3100 NEXT_PUBLIC_APP_URL=http://127.0.0.1:3200 NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS=127.0.0.1:3200,localhost:3200 NEXT_PUBLIC_ENABLE_E2E_FIXTURES=1 node ../infra/scripts/with-env.mjs next dev --hostname 127.0.0.1 --port 3200",
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
