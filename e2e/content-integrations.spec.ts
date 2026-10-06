import { expect, test } from "@playwright/test";
import path from "node:path";

test("B2 desktop request controls, tabs, copy fallback and modal focus", async ({
  page,
}) => {
  const errors: string[] = [];
  const deliveryRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.url().includes("/delivery/"))
      deliveryRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("fixture-denial")) },
    });
  });
  await page.goto("/e2e/content-integrations");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute("data-ready", "true");
  const trigger = page.getByRole("button", {
    name: "Content integrations",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("editorial");
  await expect(dialog).toContainText("News");
  await expect(page.getByRole("tab", { name: "Customize" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByLabel("Items per request").fill("5");
  await page.screenshot({
    path: path.join("output/playwright/b2-desktop-customize.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Customize" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "REST API" })).toBeFocused();
  await expect(page.getByLabel("Request URL")).toHaveValue(/limit=5/);
  await page.getByRole("button", { name: "Copy example" }).click();
  await expect(page.getByText(/Copy manually:/)).toBeVisible();
  await page.screenshot({
    path: path.join("output/playwright/b2-desktop-rest.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "REST API" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "SDK" })).toBeFocused();
  await expect(page.getByRole("tabpanel").getByText("Coming soon", { exact: true })).toBeVisible();
  await page.getByRole("tabpanel").getByRole("button", { name: "Use REST API" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "REST API" })).toBeFocused();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
  expect(deliveryRequests).toEqual([]);
});

test("B2 mobile pseudo locale stays within viewport with scrollable request preview", async ({
  page,
  context,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await context.addCookies([
    {
      name: "xynes_locale",
      value: "en-XA",
      url: baseURL ?? "http://127.0.0.1:3202",
    },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e/content-integrations?target=entry&state=legacy");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("button", { name: /CCoonntteenntt iinntteeggrraattiioonnss/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
  await expect(page.getByRole("status")).toContainText("lleeggaaccyy");
  await page.screenshot({
    path: path.join("output/playwright/b2-mobile-pseudo-customize.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: /RREESSTT AAPPII/ }).click();
  await expect(page.getByLabel(/RReeqquueesstt UURRLL/)).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join("output/playwright/b2-mobile-pseudo-rest.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /CClloossee iinntteeggrraattiioonnss/ })
    .click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test("B2 invalid configuration blocks copy, draft requests stay syntactically usable", async ({
  page,
}) => {
  await page.goto("/e2e/content-integrations?config=invalid");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("button", { name: "Content integrations", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Public API address");
  await page.getByRole("tab", { name: "REST API" }).click();
  await expect(
    page.getByRole("button", { name: "Copy example" }),
  ).toBeDisabled();
  await page.goto("/e2e/content-integrations?target=entry&state=draft");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("button", { name: "Content integrations", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Publish this content");
  await page.getByRole("tab", { name: "REST API" }).click();
  await expect(
    page.getByRole("button", { name: "Copy example" }),
  ).toBeEnabled();
  await expect(
    page.getByText("Static example — not live content"),
  ).toBeVisible();
});

declare global {
  interface Window {
    b2ClipboardFixture?: {
      calls: string[];
      lastWritten: string;
      finish: () => void;
    };
  }
}

test("B2 reopening during copy preserves the newest clipboard example", async ({ page }) => {
  await page.addInitScript(() => {
    let complete: (() => void) | undefined;
    const calls: string[] = [];
    const state = { calls, lastWritten: "", finish: () => complete?.() };
    window.b2ClipboardFixture = state;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => {
        state.calls.push(text);
        if (state.calls.length === 1) return new Promise<void>(resolve => {
          complete = () => { state.lastWritten = text; resolve(); };
        });
        state.lastWritten = text;
        return Promise.resolve();
      } },
    });
  });
  await page.goto("/e2e/content-integrations");
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute("data-ready", "true");
  const trigger = page.getByRole("button", { name: "Content integrations", exact: true });
  await trigger.click();
  await page.getByRole("tab", { name: "REST API" }).click();
  await page.getByRole("button", { name: "Copy example" }).click();
  await expect(page.getByRole("button", { name: "Copying…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await trigger.click();
  await page.getByRole("tab", { name: "REST API" }).click();
  await page.getByLabel("Code format").selectOption("url");
  const expected = await page.getByLabel("Request URL").inputValue();
  await page.getByRole("button", { name: "Copy example" }).click();
  expect(await page.evaluate(() => window.b2ClipboardFixture?.calls.length)).toBe(1);
  await page.evaluate(() => window.b2ClipboardFixture?.finish());
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.b2ClipboardFixture?.calls.length)).toBe(2);
  expect(await page.evaluate(() => window.b2ClipboardFixture?.lastWritten)).toBe(expected);
});
