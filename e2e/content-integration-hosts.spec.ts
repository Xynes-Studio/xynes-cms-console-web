import { expect, test } from "@playwright/test";
import path from "node:path";
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  test.info().annotations.push({
    type: "browser-errors",
    description: "page and console errors checked after every test",
  });
  pageErrors.set(page, errors);
});
const pageErrors = new WeakMap<import("@playwright/test").Page, string[]>();
test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});
const ENTRY = "33333333-3333-4333-8333-333333333333",
  DIRECTORY = "22222222-2222-4222-8222-222222222222";
async function ready(
  page: import("@playwright/test").Page,
  host: string,
  query = "",
) {
  await page.goto(`/e2e/content-integration-hosts?host=${host}${query}`);
  await expect(page.getByTestId("integration-hosts-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
}
test("B3 folder/list/grid IDs, action isolation and focus restoration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ready(page, "list");
  const folder = page.getByRole("button", {
    name: "Integrations for folder News",
  });
  await folder.click();
  await page.getByRole("tab", { name: "REST API" }).click();
  expect(
    new URL(await page.getByLabel("Request URL").inputValue()).searchParams.get(
      "directoryId",
    ),
  ).toBe(DIRECTORY);
  await page.keyboard.press("Escape");
  await expect(folder).toBeFocused();
  const entry = page.getByRole("button", {
    name: "Integrations for First story",
  });
  await entry.click();
  await page.getByRole("tab", { name: "REST API" }).click();
  expect(
    new URL(await page.getByLabel("Request URL").inputValue()).pathname,
  ).toContain(`/delivery/entries/${ENTRY}`);
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await ready(page, "grid");
  const trigger = page.getByRole("button", {
    name: "Actions for content First story",
  });
  await trigger.click();
  await page
    .getByRole("menuitem", { name: "Integrations for First story" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await ready(page, "root");
  await expect(
    page.getByRole("button", { name: "Integrations", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Open a folder first.")).toBeVisible();
});
test("B3 desktop editor preserves draft/canvas and restores Customize focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ready(page, "editor");
  await page.getByLabel("Content title").fill("Unsaved local title");
  const canvas = page.getByRole("textbox", { name: "Rich Text Editor" });
  await canvas.fill("Unsaved document text");
  const canvasHandle = await canvas.elementHandle();
  await page.getByRole("tab", { name: "Integrations", exact: true }).click();
  const customize = page.getByRole("button", { name: "Customize request" });
  await page.screenshot({
    path: path.join("output/playwright/b3-editor-desktop-panel.png"),
    fullPage: true,
  });
  await customize.click();
  await expect(page.getByRole("dialog")).toContainText("Unsaved local title");
  await expect(page.getByRole("dialog")).toContainText(
    "Saved edits are excluded",
  );
  await page.keyboard.press("Escape");
  await expect(customize).toBeFocused();
  expect(
    await canvas.evaluate((node, previous) => node === previous, canvasHandle),
  ).toBe(true);
  await expect(canvas).toContainText("Unsaved document text");
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Content title")).toHaveValue(
    "Unsaved local title",
  );
  await expect(page.getByTestId("fixture-save-calls")).toHaveText("0");
  await expect(page.getByTestId("fixture-publish-calls")).toHaveText("0");
  await page.screenshot({
    path: path.join("output/playwright/b3-editor-desktop.png"),
    fullPage: true,
  });
});
test("B3 mobile drawer hands off to one full modal and restores metadata focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "editor");
  const metadata = page.getByRole("button", { name: "Open metadata panel" });
  await metadata.click();
  await page.keyboard.press("Escape");
  await expect(metadata).toBeFocused();
  await metadata.click();
  await page.getByRole("tab", { name: "Integrations", exact: true }).click();
  await page.screenshot({
    path: path.join("output/playwright/b3-editor-mobile-panel.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Customize request" }).click();
  await expect(page.locator("[data-lumia-drawer-root]")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(metadata).toBeFocused();
  await expect(page.getByTestId("fixture-save-calls")).toHaveText("0");
  await expect(page.getByTestId("fixture-publish-calls")).toHaveText("0");
  await page.screenshot({
    path: path.join("output/playwright/b3-editor-mobile.png"),
    fullPage: true,
  });
});
test("B3 rollout off leaves editor, toolbar and cards without dead integrations controls", async ({
  page,
}) => {
  for (const host of ["list", "grid", "editor"]) {
    await ready(page, host, "&disabled=1");
    await expect(
      page.getByRole("button", { name: /Integrations/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("tab", { name: "Integrations", exact: true }),
    ).toHaveCount(0);
  }
});

test("B3 mobile pseudo locale renders the shared panel and dialog without page overflow", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "xynes_locale",
      value: "en-XA",
      url: baseURL ?? "http://127.0.0.1:3206",
    },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "editor");
  await page.getByRole("button", { name: "Open metadata panel" }).click();
  await page.getByRole("tab", { name: /IInntteeggrraattiioonnss/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
  await page
    .getByRole("button", { name: /CCuussttoommiizzee rreeqquueesstt/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: path.join("output/playwright/b3-editor-mobile-pseudo.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open metadata panel" }),
  ).toBeFocused();
});
