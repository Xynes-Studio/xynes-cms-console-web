import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  fixtureControlUrl,
  readIntegrationFixture,
} from "../src/lib/testing/cms-integration-fixture";

test.use({ trace: "off", actionTimeout: 15000 });
const provisioned = process.env.RUN_CMS_INTEGRATIONS_BROWSER === "1";
const executedSchema = z.strictObject({
  status: z.number().int(),
  response: z.unknown(),
});
const item = z.strictObject({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  publishedAt: z.string().optional(),
});
const feed = z
  .object({
    ok: z.literal(true),
    data: z.strictObject({
      items: z.array(item),
      page: z.strictObject({
        limit: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
      }),
    }),
    meta: z.unknown().optional(),
  })
  .strict();
const detail = z
  .object({
    ok: z.literal(true),
    data: z.strictObject({
      entry: z.strictObject({
        id: z.string().uuid(),
        title: z.string(),
        body: z.unknown().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        publishedAt: z.string().optional(),
      }),
    }),
    meta: z.unknown().optional(),
  })
  .strict();
async function control(payload: unknown): Promise<unknown> {
  const token = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(process.env.CMS_INTEGRATIONS_FIXTURE_CONTROL_TOKEN);
  const response = await fetch(fixtureControlUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Owned fixture control failed (${response.status})`);
  return response.json();
}
async function ready(
  page: Page,
  host: "list" | "grid" | "editor",
  suffix = "",
) {
  await page.goto(`/e2e/cms-content-integrations?host=${host}${suffix}`);
  await expect(page.getByTestId("integration-hosts-fixture")).toHaveAttribute(
    "data-ready",
    "true",
  );
}
async function openEntry(
  page: Page,
  host: "list" | "grid" | "editor",
  title: string,
) {
  if (host === "editor") {
    await page.getByRole("tab", { name: "Integrations", exact: true }).click();
    await page.getByRole("button", { name: "Customize request" }).click();
  } else if (host === "grid") {
    await page
      .getByRole("button", { name: `Actions for content ${title}` })
      .click();
    await page
      .getByRole("menuitem", { name: `Integrations for ${title}` })
      .click();
  } else
    await page
      .getByRole("button", { name: `Integrations for ${title}` })
      .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function capture(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "REST API" }).click();
  return copiedRequest(page, dialog);
}
async function copiedRequest(page: Page, scope: Locator) {
  const displayedUrl = await scope.getByLabel("Request URL").inputValue();
  const displayedCode = await scope.getByLabel("Code example").inputValue();
  await scope.getByRole("button", { name: "Copy example" }).click();
  await expect(scope.getByText("Copied", { exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(displayedCode);
  // Parse the producer's fixed cURL representation. Never run it in a shell or rebuild its URL.
  const match =
    /^curl --fail --silent --show-error --request GET \\\n  --url '([^']+)' \\\n  --header "Authorization: (Bearer \$\{XYNES_API_KEY\})"$/.exec(
      copied,
    );
  if (!match) throw new Error("Unexpected copied request structure");
  const [, url, authorization] = match;
  expect(url).toBe(displayedUrl);
  return { action: "execute" as const, url, authorization };
}
async function execute(
  request: Awaited<ReturnType<typeof capture>>,
  credential: "current" | "old" | "revoked" | "expired" | "wrong" = "current",
) {
  return executedSchema.parse(await control({ ...request, credential }));
}
const pageErrors = new WeakMap<Page, string[]>();
test.describe("B5 provisioned copied-request acceptance", () => {
  test.skip(
    !provisioned,
    "B5 needs the explicitly isolated live-service harness; this skip is not acceptance evidence.",
  );
  test.describe.configure({ mode: "serial", timeout: 180000 });

  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      let copied = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            copied = text;
          },
          readText: async () => copied,
        },
      });
    });
  });
  test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([]);
  });

  test("exact folder and all entry-host clipboard requests execute against issued readonly keys", async ({
    page,
  }) => {
    const context = readIntegrationFixture();
    if (!context) throw new Error("Missing provisioned context");
    await page.setViewportSize({ width: 1280, height: 900 });
    const before = await control({ action: "evidence" });
    await ready(page, "list");
    const folder = page.getByRole("button", {
      name: "Integrations for folder News",
    });
    await folder.click();
    await page.getByLabel("Order by").selectOption("title");
    await page.getByLabel("Direction").selectOption("asc");
    await page.getByLabel("Items per request").fill("1");
    for (const name of ["Description", "Tags", "Published date"]) {
      const box = page.getByRole("checkbox", { name, exact: true });
      await box.focus();
      await page.keyboard.press("Space");
      await expect(box).not.toBeChecked();
    }
    const folderRequest = await capture(page);
    let result = await execute(folderRequest);
    expect(result.status).toBe(200);
    expect(feed.parse(result.response).data).toMatchObject({
      items: [{ id: context.entryId, title: "Publication A" }],
      page: { limit: 1, offset: 0, hasMore: true },
    });
    const parsed = new URL(folderRequest.url);
    expect(parsed.searchParams.get("directoryId")).toBe(context.directoryId);
    expect(parsed.searchParams.get("sortBy")).toBe("title");
    expect(parsed.searchParams.get("sortDirection")).toBe("asc");
    await page.getByRole("tab", { name: "Customize" }).click();
    await page.getByLabel("Direction").selectOption("desc");
    const descending = await execute(await capture(page));
    expect(feed.parse(descending.response).data.items[0]?.title).toBe(
      "Zulu publication",
    );
    await page.getByRole("tab", { name: "Customize" }).click();
    await page.getByLabel("Items per request").fill("100");
    await page.getByText("Advanced", { exact: true }).click();
    await page.getByLabel("Skip items").fill("1");
    await page.getByLabel("Search title").fill("Publication");
    await page.getByLabel("Direction").selectOption("asc");
    await page.getByLabel("Items per request").fill("1");
    const offset = feed.parse(
      (await execute(await capture(page))).response,
    ).data;
    expect(offset.items[0]?.title).toBe("Zulu publication");
    expect(offset.page.offset).toBe(1);
    expect(Object.keys(offset.items[0] ?? {}).sort()).toEqual(["id", "title"]);
    await page
      .getByRole("dialog")
      .getByRole("tab", { name: "Customize" })
      .click();
    await page.getByLabel("Skip items").fill("0");
    await page.getByLabel("Search title").fill("no-match-B5");
    expect(
      feed.parse((await execute(await capture(page))).response).data.items,
    ).toEqual([]);
    await page
      .getByRole("dialog")
      .getByRole("tab", { name: "Customize" })
      .click();
    await page.getByLabel("Search title").fill("");
    await page.getByLabel("Items per request").fill("100");
    const all = feed.parse((await execute(await capture(page))).response).data
      .items;
    expect(all.map((row) => row.id)).not.toContain(context.childEntryId);
    expect(all.map((row) => row.id)).not.toContain(context.legacyEntryId);
    expect(all.map((row) => row.id)).not.toContain(context.foreignEntryId);
    await page.keyboard.press("Escape");
    await expect(folder).toBeFocused();
    let entryRequest: Awaited<ReturnType<typeof capture>> | undefined;
    for (const host of ["list", "grid", "editor"] as const) {
      await ready(page, host);
      if (host === "editor") {
        await page
          .getByRole("tab", { name: "Integrations", exact: true })
          .click();
        const compact = await copiedRequest(
          page,
          page.getByRole("tabpanel", { name: "Integrations", exact: true }),
        );
        expect(compact).toEqual(entryRequest);
        expect((await execute(compact)).status).toBe(200);
      }
      await openEntry(page, host, "Publication A");
      const request = await capture(page);
      if (entryRequest) expect(request).toEqual(entryRequest);
      else entryRequest = request;
      result = await execute(request);
      expect(result.status).toBe(200);
      expect(detail.parse(result.response).data.entry.title).toBe(
        "Publication A",
      );
      await page.keyboard.press("Escape");
    }
    if (!entryRequest) throw new Error("No captured entry request");
    for (const [credential, status] of [
      ["old", 403],
      ["wrong", 401],
      ["revoked", 401],
      ["expired", 401],
    ] as const)
      expect((await execute(entryRequest, credential)).status).toBe(status);
    // Scope isolation uses the captured request path with only its target changed, never an authoring fallback.
    expect(
      (
        await execute({
          ...entryRequest,
          url: entryRequest.url.replace(
            context.workspaceId,
            context.foreignWorkspaceId,
          ),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await execute({
          ...entryRequest,
          url: entryRequest.url.replace(
            context.entryId,
            context.foreignEntryId,
          ),
        })
      ).status,
    ).toBe(404);
    await ready(page, "list", "&folder=empty");
    await page
      .getByRole("button", { name: "Integrations for folder Empty" })
      .click();
    const empty = await execute(await capture(page));
    expect(empty.status).toBe(200);
    expect(feed.parse(empty.response).data.items).toEqual([]);
    const link = page.getByRole("link", { name: /Get a read-only API key/ });
    await expect(link).toHaveAttribute(
      "href",
      /preset=cms_readonly&workspace=editorial/,
    );
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const deniedWrite = executedSchema.parse(
      await control({ action: "readonlyProbe" }),
    );
    expect(deniedWrite.status).toBe(403);
    expect(
      z
        .object({
          ok: z.literal(false),
          error: z.object({ code: z.literal("FORBIDDEN") }),
        })
        .parse(deniedWrite.response).ok,
    ).toBe(false);
    const after = await control({ action: "evidence" });
    expect(
      z.object({ contentDigest: z.string() }).parse(after).contentDigest,
    ).toBe(z.object({ contentDigest: z.string() }).parse(before).contentDigest);
    expect(z.object({ mutations: z.number() }).parse(after).mutations).toBe(
      z.object({ mutations: z.number() }).parse(before).mutations,
    );
    expect(await page.locator("body").innerText()).not.toMatch(
      /xynes_live_[0-9a-f]{64}|\$argon2id\$/,
    );
  });

  test("saved editor B stays private until republish, including folder move and withdrawal", async ({
    page,
  }) => {
    const context = readIntegrationFixture();
    if (!context) throw new Error("Missing provisioned context");
    await ready(page, "editor");
    await openEntry(page, "editor", "Publication A");
    const request = await capture(page);
    const publishedA = detail.parse((await execute(request)).response).data
      .entry;
    expect(JSON.stringify(publishedA.body)).toContain("Publication A body");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    await page.getByLabel("Content title").fill("Publication B");
    const editor = page.getByRole("textbox", { name: "Rich Text Editor" });
    await editor.fill("Body B from editor");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByTestId("fixture-save-calls")).toHaveText("1");
    const afterSave = detail.parse((await execute(request)).response).data
      .entry;
    expect(afterSave).toEqual(publishedA);
    await control({ action: "move" });
    expect(detail.parse((await execute(request)).response).data.entry).toEqual(
      publishedA,
    );
    await ready(page, "list");
    await page
      .getByRole("button", { name: "Integrations for folder News" })
      .click();
    const newsRequest = await capture(page);
    expect(
      feed
        .parse((await execute(newsRequest)).response)
        .data.items.map((row) => row.id),
    ).toContain(context.entryId);
    await ready(page, "list", "&folder=moved");
    await page
      .getByRole("button", { name: "Integrations for folder Moved" })
      .click();
    const movedRequest = await capture(page);
    expect(
      feed.parse((await execute(movedRequest)).response).data.items,
    ).toEqual([]);
    await ready(page, "editor");
    await page
      .getByRole("button", {
        name: /Republish|Manage|Update live/,
        exact: false,
      })
      .click();
    const republish = page.getByRole("menuitem", { name: /Republish|Publish/ });
    await republish.click();
    await expect(page.getByTestId("fixture-publish-calls")).toHaveText("1");
    const publishedB = detail.parse((await execute(request)).response).data
      .entry;
    expect(publishedB.title).toBe("Publication B");
    expect(JSON.stringify(publishedB.body)).toContain("Body B from editor");
    expect(
      feed
        .parse((await execute(newsRequest)).response)
        .data.items.map((row) => row.id),
    ).not.toContain(context.entryId);
    expect(
      feed
        .parse((await execute(movedRequest)).response)
        .data.items.map((row) => row.id),
    ).toEqual([context.entryId]);
    for (const action of ["archive", "unpublish"] as const) {
      await control({ action });
      expect((await execute(request)).status).toBe(404);
      expect(
        feed.parse((await execute(movedRequest)).response).data.items,
      ).toEqual([]);
      await control({ action: "publish" });
      expect((await execute(request)).status).toBe(200);
    }
  });

  test("legacy guidance requires actual republish and retains scripts/SDK unavailability", async ({
    page,
  }) => {
    await ready(page, "list", "&entry=legacy");
    await openEntry(page, "list", "Legacy publication");
    await expect(page.getByText(/Republish this legacy content/)).toBeVisible();
    const request = await capture(page);
    expect((await execute(request)).status).toBe(404);
    await control({ action: "legacyRepublish" });
    expect((await execute(request)).status).toBe(200);
    await ready(page, "list", "&entry=legacy");
    await openEntry(page, "list", "Legacy publication");
    await expect(page.getByText(/Republish this legacy content/)).toHaveCount(
      0,
    );
    expect((await execute(await capture(page))).status).toBe(200);
    for (const name of ["Scripts", "SDK"]) {
      await page.getByRole("tab", { name }).click();
      await expect(
        page.getByRole("tabpanel").getByText("Coming soon", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("tabpanel").locator("textarea,pre,script"),
      ).toHaveCount(0);
    }
    const evidence = process.env.CMS_B5_EVIDENCE_DIR;
    if (!evidence) throw new Error("Missing owned evidence output");
    await mkdir(evidence, { recursive: true });
    await writeFile(
      path.join(evidence, "copied-request-transcript.json"),
      JSON.stringify(await control({ action: "evidence" }), null, 2),
      { mode: 0o600 },
    );
    await page.screenshot({
      path: path.join("output/playwright", "b5-live-legacy-sdk.png"),
      fullPage: true,
    });
  });
});
