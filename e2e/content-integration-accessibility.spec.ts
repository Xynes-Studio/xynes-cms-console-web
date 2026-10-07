import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const entries: string[] = [];
  errors.set(page, entries);
  page.on("pageerror", (error) => entries.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") entries.push(message.text());
  });
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function open(page: Page) {
  await page.goto("/e2e/content-integrations?target=entry&long=1");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", {
      name: /Content integrations|CCoonntteenntt iinntteeggrraattiioonnss/,
    })
    .click();
}
for (const locale of ["en-US", "en-XA"]) {
  test(`B4 ${locale} 320px long context keeps close and Copy visible while body scrolls`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: "xynes_locale",
        value: locale,
        url: baseURL ?? "http://127.0.0.1:3207",
      },
    ]);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("fixture-denial")) },
      });
    });
    await open(page);
    await page.getByRole("tab", { name: /REST API|RREESSTT AAPPII/ }).click();
    const copy = page.getByRole("button", {
      name: /Copy example|CCooppyy eexxaammppllee/,
    });
    await copy.scrollIntoViewIfNeeded();
    const close = page.getByRole("button", {
      name: /Close integrations|CClloossee iinntteeggrraattiioonnss/,
    });
    const box = await close.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(640);
    const dialog = page.getByRole("dialog");
    const body = page.getByRole("region", {
      name: /Integration options and request|IInntteeggrraattiioonn ooppttiioonnss aanndd rreeqquueesstt/,
    });
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const bounds = await dialog.boundingBox();
    for (const button of await dialog.getByRole("button").all()) {
      if (await button.isVisible()) {
        const b = await button.boundingBox();
        expect(b?.x).toBeGreaterThanOrEqual(bounds?.x ?? 0);
        expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(
          (bounds?.x ?? 0) + (bounds?.width ?? 0),
        );
      }
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await copy.click();
    await expect(
      page.getByText(/Copy manually:|CCooppyy mmaannuuaallllyy:/),
    ).toBeVisible();
    const code = page.getByLabel(/Code example|CCooddee eexxaammppllee/);
    await code.focus();
    await code.press("ControlOrMeta+A");
    expect(
      await code.evaluate(
        (el) =>
          el instanceof HTMLTextAreaElement &&
          el.selectionEnd > el.selectionStart,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    const fields = page.getByRole("region", {
      name: /Selected response fields|SSeelleecctteedd rreessppoonnssee ffiieellddss/,
    });
    await fields.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => fields.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    await page.screenshot({
      path: path.join(`output/playwright/b4-${locale}-320px.png`),
      fullPage: true,
    });
    await close.click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", {
        name: /Content integrations|CCoonntteenntt iinntteeggrraattiioonnss/,
      }),
    ).toBeFocused();
  });
}
test("B4 keyboard dialog contains focus and Coming soon hands focus back to REST", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const dialog = page.getByRole("dialog");
  const customize = page.getByRole("tab", { name: "Customize" });
  await customize.focus();
  await page.keyboard.press("End");
  const sdk = page.getByRole("tab", { name: "SDK" });
  await expect(sdk).toBeFocused();
  await expect(page.getByRole("tabpanel").getByRole("status")).toHaveText(
    "Coming soon",
  );
  await page.getByRole("button", { name: "Use REST API" }).click();
  await expect(page.getByRole("tab", { name: "REST API" })).toBeFocused();
  const response = page.getByLabel("Example response");
  await response.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("B4 desktop pseudo-locale compact sidebar keeps tabs and actions inside its bounds", async ({
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
  const tab = page.getByRole("tab", { name: /IInntteeggrraattiioonnss/ });
  await tab.click();
  const sidebar = page.locator("aside");
  const box = await sidebar.boundingBox();
  const roles: Array<"tab" | "button"> = ["tab", "button"];
  for (const role of roles) {
    for (const el of await sidebar.getByRole(role).all()) {
      const bounds = await el.boundingBox();
      expect(bounds?.x).toBeGreaterThanOrEqual(box?.x ?? 0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
        (box?.x ?? 0) + (box?.width ?? 0),
      );
    }
  }
  const customize = page.getByRole("button", {
    name: /CCuussttoommiizzee rreeqquueesstt/,
  });
  await customize.scrollIntoViewIfNeeded();
  await expect(customize).toBeVisible();
  const customizeBounds = await customize.boundingBox();
  expect(customizeBounds?.y).toBeGreaterThanOrEqual(0);
  expect(
    (customizeBounds?.y ?? 0) + (customizeBounds?.height ?? 0),
  ).toBeLessThanOrEqual(900);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(900);
  expect(await sidebar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: path.join("output/playwright/b4-editor-pseudo-sidebar.png"),
    fullPage: true,
  });
});

test("B4 pseudo-locale mobile metadata dialog has a translated name and close action", async ({
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
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/e2e/content-integration-hosts?host=editor");
  await expect(page.getByTestId("integration-hosts-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const trigger = page.getByRole("button", {
    name: /OOppeenn mmeettaaddaattaa ppaanneell/,
  });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: /CCoonntteenntt ppaanneellss/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /CClloossee mmeettaaddaattaa ppaanneell/ })
    .click();
  await expect(trigger).toBeFocused();
});

test("B4 short CSS viewport after 200% reflow keeps the header fixed when keyboard focuses a tall response", async ({
  page,
}) => {
  await page.setViewportSize({ width: 756, height: 366 });
  await open(page);
  await page.getByRole("tab", { name: "REST API" }).click();
  await page
    .getByRole("button", { name: "Copy example" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Copy example" }).press("Tab");
  const close = page.getByRole("button", { name: "Close integrations" });
  const bounds = await close.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollTop)).toBe(0);
  await page.screenshot({
    path: path.join("output/playwright/b4-zoom-reflow-regression.png"),
    fullPage: true,
  });
});
