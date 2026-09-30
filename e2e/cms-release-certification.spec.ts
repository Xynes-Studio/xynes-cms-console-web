import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const E2E_PORT = Number(process.env.PLAYWRIGHT_E2E_PORT ?? "3200");
const CMS_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;
const ALLOWED_CMS_RETURN_ORIGINS = new Set([
  CMS_ORIGIN,
  `http://localhost:${E2E_PORT}`,
]);
const AUTH_ORIGIN = "http://127.0.0.1:3100";
const LOCALES = ["en-US", "en-XA"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const SECRET_OR_INTERNAL_PATTERNS = [
  /xynes_live_[A-Za-z0-9_-]+/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /\$argon2(?:id|i|d)\$/i,
  /service[_-]?role/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /host\.docker\.internal/i,
  /https?:\/\/(?:gateway|db\.local|localhost:4100)\b/i,
] as const;

type Locale = (typeof LOCALES)[number];

async function setLocaleCookie(context: BrowserContext, locale: Locale) {
  await context.addCookies([
    {
      name: "xynes_locale",
      value: locale,
      url: CMS_ORIGIN,
      sameSite: "Lax",
    },
  ]);
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const source = message.location().url;
      errors.push(`${message.text()}${source ? ` @ ${source}` : ""}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function expectNoSecretOrInternalData(text: string) {
  for (const pattern of SECRET_OR_INTERNAL_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

async function expectSafeAuthCtas(page: Page) {
  const ctas = page.locator(
    '[data-cta-id="hero-signin"], [data-cta-id="hero-signup"]',
  );
  await expect(ctas).toHaveCount(2);

  const hrefs = await ctas.evaluateAll((elements) =>
    elements.map((element) => (element as HTMLAnchorElement).href),
  );
  expect(hrefs).toHaveLength(2);

  for (const href of hrefs) {
    const url = new URL(href);
    expect(url.origin).toBe(AUTH_ORIGIN);
    expect(["/login", "/signup"]).toContain(url.pathname);
    expect(url.username).toBe("");
    expect(url.password).toBe("");
    expect(url.searchParams.has("api_key")).toBe(false);
    expect(url.searchParams.has("token")).toBe(false);
  }
}

async function expectKeyboardReachesHeroActions(page: Page) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.focus();
  });

  const reached = new Set<string>();
  for (let index = 0; index < 20 && reached.size < 2; index += 1) {
    await page.keyboard.press("Tab");
    const activeCtaId = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-cta-id"),
    );
    if (activeCtaId === "hero-signin" || activeCtaId === "hero-signup") {
      reached.add(activeCtaId);
    }
  }

  expect([...reached].sort()).toEqual(["hero-signin", "hero-signup"]);
}

test.describe("@release public landing certification", () => {
  // A cold Next.js development compile is materially slower in the
  // containerized browser-certification environment. Keep the limit bounded
  // while allowing assertions and browser-context teardown to complete.
  test.describe.configure({ timeout: 180_000 });

  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`@release landing is safe and usable on ${viewport.name} (${locale})`, async ({
        context,
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await setLocaleCookie(context, locale);
        const browserErrors = captureBrowserErrors(page);

        const response = await page.goto("/", { waitUntil: "domcontentloaded" });
        expect(response?.ok()).toBe(true);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByTestId("cms-landing-screen")).toBeVisible();
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const bodyText = await page.locator("body").innerText();
        expect(bodyText.trim().length).toBeGreaterThan(200);
        expect(bodyText).not.toMatch(/\bcms\.landing\./);
        expect(bodyText).not.toMatch(/\bcms\.(?:shell|content|integrations)\./);
        expectNoSecretOrInternalData(bodyText);

        await expectSafeAuthCtas(page);

        const visibleInteractiveControls = page.locator(
          'a[href]:visible, button:visible, input:visible, select:visible, textarea:visible, [role="button"]:visible',
        );
        const unlabeledControls = await visibleInteractiveControls.evaluateAll(
          (elements) =>
            elements
              .filter((element) => {
                const aria = element.getAttribute("aria-label")?.trim();
                const title = element.getAttribute("title")?.trim();
                const text = element.textContent?.replace(/\s+/g, " ").trim();
                return !aria && !title && !text;
              })
              .map((element) => element.outerHTML.slice(0, 160)),
        );
        expect(unlabeledControls).toEqual([]);

        const ctaOverlaps = await page
          .locator('[data-cta-id^="hero-"]:visible')
          .evaluateAll((elements) => {
            const rectangles = elements.map((element) => ({
              id: element.getAttribute("data-cta-id") ?? "unknown",
              rect: element.getBoundingClientRect(),
            }));
            const overlaps: string[] = [];
            for (let left = 0; left < rectangles.length; left += 1) {
              for (let right = left + 1; right < rectangles.length; right += 1) {
                const a = rectangles[left];
                const b = rectangles[right];
                const horizontal =
                  Math.min(a.rect.right, b.rect.right) -
                    Math.max(a.rect.left, b.rect.left) >
                  1;
                const vertical =
                  Math.min(a.rect.bottom, b.rect.bottom) -
                    Math.max(a.rect.top, b.rect.top) >
                  1;
                if (horizontal && vertical) overlaps.push(`${a.id}:${b.id}`);
              }
            }
            return overlaps;
          });
        expect(ctaOverlaps).toEqual([]);

        const securityLinks = page.locator('a[href="/SECURITY.md"]:visible');
        expect(await securityLinks.count()).toBeGreaterThan(0);

        await expectKeyboardReachesHeroActions(page);

        const blockingErrors = browserErrors.filter(
          (line) => !/Download the React DevTools/i.test(line),
        );
        expectNoSecretOrInternalData(blockingErrors.join("\n"));
        expect(blockingErrors, blockingErrors.join("\n")).toEqual([]);
      });
    }
  }

  test("@release hostile landing redirects fail closed", async ({ page }) => {
    for (const hostileRedirect of [
      "javascript:alert(1)",
      "//attacker.example/steal",
      "/\\attacker.example/steal",
      "https://user:password@attacker.example/steal",
    ]) {
      await page.goto(`/?redirect=${encodeURIComponent(hostileRedirect)}`);
      await expectSafeAuthCtas(page);
      const hrefs = await page
        .locator('[data-cta-id="hero-signin"], [data-cta-id="hero-signup"]')
        .evaluateAll((elements) =>
          elements.map((element) => (element as HTMLAnchorElement).href),
        );
      expect(hrefs.join("\n")).not.toContain("attacker.example");
      expect(hrefs.join("\n")).not.toMatch(/javascript:|user:password/i);
    }
  });

  test("@release the linked security policy is reachable anonymously", async ({
    request,
  }) => {
    const response = await request.get("/SECURITY.md");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/markdown");
  });
});

test.describe("@release protect-all redirect certification", () => {
  test("@release anonymous protected navigation uses a safe encoded CMS return URL", async ({
    page,
  }) => {
    const protectedPath = "/dashboard/fixture-slug/content?tab=recent";
    const response = await page.request.get(protectedPath, { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    const location = response.headers().location;
    expect(location).toBeTruthy();
    const loginUrl = new URL(location!);
    expect(loginUrl.origin).toBe(AUTH_ORIGIN);
    expect(loginUrl.pathname).toBe("/login");

    const encodedReturnUrl = loginUrl.searchParams.get("redirect");
    expect(encodedReturnUrl).toBeTruthy();
    const returnUrl = new URL(encodedReturnUrl!);
    expect(ALLOWED_CMS_RETURN_ORIGINS.has(returnUrl.origin)).toBe(true);
    expect(returnUrl.username).toBe("");
    expect(returnUrl.password).toBe("");
    expect(returnUrl.pathname).toBe("/dashboard/fixture-slug/content");
    expect(returnUrl.searchParams.get("tab")).toBe("recent");
  });

  test("@release hostile nested redirect input cannot change either trusted origin", async ({
    page,
  }) => {
    for (const hostileRedirect of [
      "https://attacker.example/steal",
      "//attacker.example/steal",
      "/\\attacker.example/steal",
    ]) {
      const protectedPath = `/dashboard/fixture-slug/content?redirect=${encodeURIComponent(hostileRedirect)}`;
      const response = await page.request.get(protectedPath, { maxRedirects: 0 });
      const loginUrl = new URL(response.headers().location!);
      const returnUrl = new URL(loginUrl.searchParams.get("redirect")!);

      expect(response.status()).toBe(307);
      expect(loginUrl.origin).toBe(AUTH_ORIGIN);
      expect(ALLOWED_CMS_RETURN_ORIGINS.has(returnUrl.origin)).toBe(true);
      expect(returnUrl.username).toBe("");
      expect(returnUrl.password).toBe("");
      expect(returnUrl.pathname).toBe("/dashboard/fixture-slug/content");
    }
  });
});

test.describe("@release deterministic dashboard fixture", () => {
  for (const locale of LOCALES) {
    test(`@release representative authenticated shell renders with fixture data (${locale})`, async ({
      context,
      page,
    }) => {
      await setLocaleCookie(context, locale);
      const browserErrors = captureBrowserErrors(page);

      await page.goto("/e2e/cms-dashboard-scroll", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(
        page.getByRole("navigation", { name: /Dashboard navigation/i }),
      ).toBeVisible();
      await expect(page.getByTestId("content-results-scroll-region")).toBeVisible();

      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toMatch(/\bcms\.(?:shell|content)\./);
      expectNoSecretOrInternalData(bodyText);
      expectNoSecretOrInternalData(browserErrors.join("\n"));
      expect(browserErrors, browserErrors.join("\n")).toEqual([]);
    });
  }
});
