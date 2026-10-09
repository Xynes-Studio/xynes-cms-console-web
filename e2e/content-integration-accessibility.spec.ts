import { expect, test, type Page } from "@playwright/test";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") list.push(m.text());
  });
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function open(page: Page, long = false) {
  await page.goto(
    `/e2e/content-integrations?target=entry${long ? "&long=1" : ""}`,
  );
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: /Use .* via API|UUssee .* vviiaa AAPPII/ })
    .click();
}
for (const locale of ["en-US", "en-XA"]) {
  test(`${locale} long content wraps at 320px; close stays fixed and manual copy remains selectable`, async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await context.addCookies([
      {
        name: "xynes_locale",
        value: locale,
        url: baseURL ?? "http://127.0.0.1:3207",
      },
    ]);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("fixture-denial")) },
      }),
    );
    await open(page, true);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("data-lumia-sheet-side", "bottom");
    const copy = page.getByRole("button", { name: /^Copy$|^\[CCooppyy\]$/ });
    await copy.scrollIntoViewIfNeeded();
    const close = page.getByRole("button", {
      name: /^Close$|^\[CClloossee\]$/,
    });
    const box = await close.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(640);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await copy.click();
    const code = page.getByLabel(/Request code, cURL|RReeqquueesstt ccooddee/);
    await expect(code).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      await code.textContent(),
    );
    await page.screenshot({
      path: testInfo.outputPath(`fixture-${locale}-320.png`),
    });
    await close.click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", {
        name: /Use .* via API|UUssee .* vviiaa AAPPII/,
      }),
    ).toBeFocused();
  });
}
for (const width of [375, 721, 768, 1280]) {
  test(`keyboard Copy within four Tabs and responsive bounds at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute(
      "data-lumia-sheet-side",
      width < 768 ? "bottom" : "right",
    );
    await expect(
      page.getByRole("heading", {
        name: 'Use "First story" via API',
        exact: true,
      }),
    ).toBeFocused();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      if (await page.getByRole("button", { name: "Copy", exact: true }).evaluate(el => el === document.activeElement)) break;
    }
    await expect(
      page.getByRole("button", { name: "Copy", exact: true }),
    ).toBeFocused();
    const copyBounds = await page
      .getByRole("button", { name: "Copy", exact: true })
      .boundingBox();
    const codeBounds = await page
      .getByRole("region", { name: "Request code, cURL", exact: true })
      .boundingBox();
    expect(copyBounds).not.toBeNull();
    expect(codeBounds).not.toBeNull();
    expect(copyBounds!.y + copyBounds!.height).toBeLessThanOrEqual(codeBounds!.y);
    expect(copyBounds!.x + copyBounds!.width).toBeLessThanOrEqual(codeBounds!.x + codeBounds!.width + 4);
    const bounds = await dialog.boundingBox();
    expect(Math.round(bounds?.width ?? 0)).toBe(
      width < 768 ? width : width < 1024 ? 420 : 480,
    );
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.screenshot({
      path: testInfo.outputPath(`fixture-api-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
}
test("200% CSS reflow keeps Close visible while options and JavaScript scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await open(page);
  await page.getByRole("radio", { name: "JavaScript", exact: true }).click();
  await page.getByRole("button", { name: "Adjust" }).click();
  await page.getByRole("button", { name: "What you'll get back" }).click();
  await page
    .locator('pre[aria-label="What you\'ll get back"]')
    .scrollIntoViewIfNeeded();
  const close = page.getByRole("button", { name: "Close", exact: true });
  const bounds = await close.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(450);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});
test("pseudo desktop sidebar fits API tab and secondary panel action without inline code", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "xynes_locale",
      value: "en-XA",
      url: baseURL ?? "http://127.0.0.1:3207",
    },
  ]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/e2e/content-integration-hosts?host=editor&long=1");
  await expect(page.getByTestId("integration-hosts-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("tab", { name: /AAPPII/ }).click();
  const sidebar = page.locator("aside");
  expect(await sidebar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(sidebar.locator("pre:visible,textarea:visible")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /OOppeenn AAPPII ppaanneell/ }),
  ).toBeVisible();
});
test("pseudo mobile metadata and direct API controls retain separate names and focus", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "xynes_locale",
      value: "en-XA",
      url: baseURL ?? "http://127.0.0.1:3207",
    },
  ]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/e2e/content-integration-hosts?host=editor");
  await expect(page.getByTestId("integration-hosts-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const metadata = page.getByRole("button", {
    name: /OOppeenn mmeettaaddaattaa ppaanneell/,
  });
  await metadata.click();
  await expect(
    page.getByRole("dialog", { name: /CCoonntteenntt ppaanneellss/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /CClloossee mmeettaaddaattaa ppaanneell/ })
    .click();
  await expect(metadata).toBeFocused();
  const api = page.getByRole("button", { name: /^\[AAPPII\]$/ });
  await api.click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "data-lumia-sheet-side",
    "bottom",
  );
  await page.keyboard.press("Escape");
  await expect(api).toBeFocused();
});

test("expanded options keep every button, link and checkbox hit area at least32px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/e2e/content-integrations");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: 'Use "News" via API', exact: true })
    .click();
  await page.getByRole("button", { name: "Adjust" }).click();
  const dialog = page.getByRole("dialog");
  for (const checkbox of await dialog.getByRole("checkbox").all()) {
    expect(
      await checkbox.evaluate(
        (el) => el.closest("label")?.getBoundingClientRect().height,
      ),
    ).toBeGreaterThanOrEqual(32);
  }
  for (const target of await dialog.locator("button,a").all()) {
    expect(
      await target.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(32);
  }
});

test("native action links retain readable contrast in the dark theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/e2e/content-integrations?target=entry&state=draft");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: /Use .* via API/ }).click();
  const ratios = await page.getByRole("dialog").evaluate((dialog) => {
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
      const linear = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance(getComputedStyle(dialog).backgroundColor);
    return [...dialog.querySelectorAll("a")].map((link) => {
      const foreground = luminance(getComputedStyle(link).color);
      return (
        (Math.max(background, foreground) + 0.05) /
        (Math.min(background, foreground) + 0.05)
      );
    });
  });
  expect(ratios).toHaveLength(2);
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});
