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
async function open(page: Page, query = "") {
  await page.goto(`/e2e/content-integrations${query}`);
  await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: /Use .* via API|UUssee .* vviiaa AAPPII/ })
    .click();
}
test("copy-ready request, progressive controls, invalid-field recovery and session memory", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/delivery/")) requests.push(r.url());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("workspace editorial");
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "cURL" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("Items per page")).toHaveCount(0);
  await page.getByRole("button", { name: "Adjust" }).click();
  await page.getByLabel("Items per page").fill("500");
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Fix Items per page to update the request."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjust" }).click();
  await page.getByRole("button", { name: "Go to field" }).click();
  await expect(page.getByLabel("Items per page")).toBeFocused();
  await page.getByLabel("Items per page").fill("5");
  await expect(page.getByLabel("Request code, cURL")).toContainText("limit=5");
  await expect(
    page.getByLabel("Request code, cURL").locator("span.bg-warning\\/20"),
  ).toHaveText("limit=5");
  await expect(
    page.getByLabel("Request code, cURL").locator("span.bg-warning\\/20"),
  ).toHaveCount(0);
  await page.getByLabel("Sort", { exact: true }).selectOption("title:asc");
  await page.getByLabel("Skip first").fill("3");
  await page.getByLabel("Title or description contains").fill("design");
  await page.getByRole("radio", { name: "URL", exact: true }).click();
  const expected = await page.getByLabel("Request code, URL").textContent();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: 'Use "News" via API', exact: true })
    .click();
  await expect(page.getByLabel("Request code, URL")).toHaveText(expected ?? "");
  await page.getByRole("button", { name: "What you'll get back" }).click();
  await expect(
    page.getByText(
      "Example only, not your live content. Fields match your selection.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("table")).toHaveCount(0);
  expect(requests).toEqual([]);
});
test("denied clipboard selects the complete code and traps focus without exposing errors", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("private-fixture-denial")),
      },
    }),
  );
  await open(page);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByText("Couldn't copy. Select the code and copy it manually."),
  ).toBeVisible();
  const code = page.getByLabel("Request code, cURL");
  await expect(code).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
    await code.textContent(),
  );
  await expect(page.getByRole("dialog")).not.toContainText(
    "private-fixture-denial",
  );
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: 'Use "News" via API', exact: true }),
  ).toBeFocused();
});
test("unsafe config hides copy; unpublished entries still permit copying with guidance", async ({
  page,
}) => {
  await open(page, "?config=invalid");
  await expect(page.getByRole("alert")).toContainText("Public API address");
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toHaveCount(0);
  await open(page, "?target=entry&state=draft");
  await expect(page.getByRole("dialog")).toContainText("Not live yet.");
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Publish from the editor" }),
  ).toHaveAttribute("href", /edit\?panel=api$/);
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
test("reopening during a pending copy serializes writes and leaves the latest complete example", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let complete: (() => void) | undefined;
    const state = {
      calls: [] as string[],
      lastWritten: "",
      finish: () => complete?.(),
    };
    window.b2ClipboardFixture = state;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          state.calls.push(text);
          if (state.calls.length === 1)
            return new Promise<void>((resolve) => {
              complete = () => {
                state.lastWritten = text;
                resolve();
              };
            });
          state.lastWritten = text;
          return Promise.resolve();
        },
      },
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: 'Use "News" via API', exact: true })
    .click();
  await page.getByRole("radio", { name: "URL", exact: true }).click();
  const expected = await page.getByLabel("Request code, URL").textContent();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  expect(
    await page.evaluate(() => window.b2ClipboardFixture?.calls.length),
  ).toBe(1);
  await page.evaluate(() => window.b2ClipboardFixture?.finish());
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.b2ClipboardFixture?.calls.length),
  ).toBe(2);
  expect(
    await page.evaluate(() => window.b2ClipboardFixture?.lastWritten),
  ).toBe(expected);
});
