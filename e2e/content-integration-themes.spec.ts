import { expect, test, type Locator } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Canvas parses modern CSS colors and composites translucent surfaces exactly as
// the browser does. Checks use compiled CSS, never expected utility class strings.
async function colors(node: Locator) {
  return node.evaluate((el) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const pixel = () =>
      Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1, 1);
    const ancestors: Element[] = [];
    for (let item: Element | null = el; item; item = item.parentElement)
      ancestors.unshift(item);
    for (const item of ancestors) {
      ctx.fillStyle = getComputedStyle(item).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
    }
    const background = pixel();
    const css = getComputedStyle(el);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css.color;
    ctx.fillRect(0, 0, 1, 1);
    const foreground = pixel();
    const luminance = (rgb: number[]) =>
      rgb
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    const a = luminance(foreground),
      b = luminance(background);
    return {
      foreground,
      background,
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      color: css.color,
      surface: css.backgroundColor,
    };
  });
}
for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 375, 768, 1280]) {
    test(`${theme} ${width}px request toolbar, icons, highlights and exact clipboard`, async ({
      page,
      context,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/e2e/content-integrations?target=entry&state=draft");
      await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
        "data-ready",
        "true",
      );
      await page.getByRole("button", { name: /Use .* via API/ }).click();
      const dialog = page.getByRole("dialog");
      const copy = dialog.getByRole("button", { name: "Copy", exact: true });
      const code = page.getByLabel("Request code, cURL");
      const metrics: Record<string, unknown> = { theme, width };
      for (const state of ["normal", "hover", "focus"] as const) {
        if (state === "hover") await copy.hover();
        if (state === "focus") {
          await page.keyboard.press("Tab");
          await copy.focus();
        }
        const icon = await colors(copy.locator("svg"));
        metrics[state] = icon;
        expect(icon.ratio).toBeGreaterThanOrEqual(3);
        expect(icon.foreground).toEqual((await colors(copy)).foreground);
        expect((await colors(copy)).ratio).toBeGreaterThanOrEqual(4.5);
      }
      metrics.mark = await colors(code.locator("mark").first());
      expect(
        (await colors(code.locator("mark").first())).ratio,
      ).toBeGreaterThanOrEqual(4.5);
      expect((await colors(code)).ratio).toBeGreaterThanOrEqual(4.5);
      const helper = dialog
        .locator("p")
        .filter({ hasText: "$XYNES_API_KEY is" });
      metrics.helper = await colors(helper);
      expect((await colors(helper)).ratio).toBeGreaterThanOrEqual(4.5);
      expect((await colors(helper)).foreground).not.toEqual(
        (await colors(code)).foreground,
      );
      for (const radio of await dialog.getByRole("radio").all())
        expect((await colors(radio)).ratio).toBeGreaterThanOrEqual(4.5);
      const selected = dialog.getByRole("radio", { name: "cURL" });
      expect(
        await selected.evaluate((el) => getComputedStyle(el).borderTopColor),
      ).toBe((await colors(selected)).color);
      expect(
        await copy.evaluate((el) => getComputedStyle(el).boxShadow),
      ).not.toBe("none");
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const expected = await code.textContent();
      await copy.click();
      const copied = dialog.getByRole("button", {
        name: "Copied",
        exact: true,
      });
      await expect(copied).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        expected,
      );
      metrics.copied = await colors(copied.locator("svg"));
      expect(
        (await colors(copied.locator("svg"))).ratio,
      ).toBeGreaterThanOrEqual(3);
      await dialog.screenshot({
        path: testInfo.outputPath(`${theme}-${width}-request.png`),
      });
      await writeFile(
        testInfo.outputPath(`${theme}-${width}-computed-colors.json`),
        JSON.stringify(metrics, null, 2),
      );
      await testInfo.attach("computed-colors", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });
    });
  }
  test(`${theme} all shared Alert variants and explicit theme preference`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/e2e/lumia-alerts");
    for (const variant of ["info", "success", "warning", "error"]) {
      const alert = page.locator(
        `[data-lumia-alert][data-variant="${variant}"]`,
      );
      expect((await colors(alert)).ratio).toBeGreaterThanOrEqual(4.5);
      expect((await colors(alert.locator("svg"))).ratio).toBeGreaterThanOrEqual(
        3,
      );
      expect((await colors(alert.locator("svg"))).foreground).toEqual(
        (await colors(alert)).foreground,
      );
    }
    await page.screenshot({ path: testInfo.outputPath(`${theme}-alerts.png`) });
    await page.evaluate(
      (theme) =>
        (document.documentElement.dataset.theme =
          theme === "dark" ? "light" : "dark"),
      theme,
    );
    expect(
      (await colors(page.locator('[data-variant="info"]'))).ratio,
    ).toBeGreaterThanOrEqual(4.5);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} publication, invalid input and pending copy states`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 375, height: 900 });
    for (const state of [
      "published",
      "changes",
      "draft",
      "scheduled",
      "archived",
      "legacy",
      "unknown",
    ]) {
      await page.goto(`/e2e/content-integrations?target=entry&state=${state}`);
      await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
        "data-ready",
        "true",
      );
      await page.getByRole("button", { name: /Use .* via API/ }).click();
      const status = page.getByRole("dialog").locator("[data-lumia-alert]");
      expect((await colors(status)).ratio).toBeGreaterThanOrEqual(4.5);
      expect(
        (await colors(status.locator("svg"))).ratio,
      ).toBeGreaterThanOrEqual(3);
      await page
        .getByRole("dialog")
        .screenshot({ path: testInfo.outputPath(`${theme}-${state}.png`) });
    }
    await page.goto("/e2e/content-integrations?config=invalid");
    await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.getByRole("button", { name: /Use .* via API/ }).click();
    const error = page.getByRole("alert");
    expect((await colors(error)).ratio).toBeGreaterThanOrEqual(4.5);
    await expect(
      page.getByRole("button", { name: "Copy", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .screenshot({ path: testInfo.outputPath(`${theme}-invalid-config.png`) });
    await page.goto("/e2e/content-integrations");
    await expect(page.getByTestId("integration-fixture")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => new Promise<void>(() => {}) },
      }),
    );
    await page.getByRole("button", { name: /Use .* via API/ }).click();
    const copy = page.getByRole("button", { name: "Copy", exact: true });
    await copy.click();
    await expect(copy).toBeDisabled();
    await expect(copy).toHaveAttribute("aria-busy", "true");
    await expect
      .poll(async () => (await colors(copy)).color)
      .toBe(theme === "dark" ? "rgb(183, 190, 202)" : "rgb(82, 82, 91)");
    await expect
      .poll(async () => (await colors(copy.locator("svg"))).foreground)
      .toEqual((await colors(copy)).foreground);
    expect((await colors(copy)).ratio).toBeGreaterThanOrEqual(4.5);
    expect(await copy.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await expect(page.getByRole("status")).toContainText("Copying…");
    await page
      .getByRole("dialog")
      .screenshot({ path: testInfo.outputPath(`${theme}-pending-copy.png`) });
  });
}

for (const theme of ["light", "dark"] as const)
  for (const width of [320, 375, 768, 1280]) {
    test(`${theme} ${width}px all four hosts restore focus above editor`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      for (const host of ["folder", "list", "grid", "editor"] as const) {
        await page.goto(
          `/e2e/content-integration-hosts?host=${host === "folder" ? "list" : host}`,
        );
        await expect(
          page.getByTestId("integration-hosts-fixture"),
        ).toHaveAttribute("data-ready", "true");
        let trigger;
        if (host === "folder")
          trigger = page.getByRole("button", {
            name: 'Use folder "News" via API',
          });
        else if (host === "list")
          trigger = page.getByRole("button", {
            name: 'Use "First story" via API',
          });
        else if (host === "grid") {
          trigger = page.getByRole("button", {
            name: "Actions for content First story",
          });
          await trigger.click();
          await page
            .getByRole("menuitem", { name: 'Use "First story" via API' })
            .click();
        } else if (width < 768)
          trigger = page.getByRole("button", { name: "API", exact: true });
        else {
          await page.getByRole("tab", { name: "API", exact: true }).click();
          trigger = page.getByRole("button", { name: "Open API panel" });
        }
        if (host !== "grid") await trigger.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        expect(
          await dialog.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
        ).toBe(true);
        await dialog.screenshot({
          path: testInfo.outputPath(`${theme}-${width}-${host}.png`),
        });
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
      }
    });
  }

for (const theme of ["light", "dark"] as const) {
  test(`${theme} open panel retains its paint order across responsive breakpoints`, async ({page}, testInfo) => {
    await page.emulateMedia({colorScheme:theme});
    await page.setViewportSize({width:1280,height:900});
    await page.goto('/e2e/content-integrations?target=entry');
    await expect(page.getByTestId('integration-fixture')).toHaveAttribute('data-ready','true');
    await page.getByRole('button',{name:/Use .* via API/}).click();
    const dialog=page.getByRole('dialog');
    for(const width of [720,1280,375]) {
      await page.setViewportSize({width,height:400});
      await expect.poll(()=>dialog.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      const close=dialog.getByRole('button',{name:'Close',exact:true});
      await expect(close).toBeVisible();
      await expect.poll(()=>close.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      await dialog.screenshot({path:testInfo.outputPath(`${theme}-${width}-resize-open.png`)});
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:/Use .* via API/})).toBeFocused();
  });
}
