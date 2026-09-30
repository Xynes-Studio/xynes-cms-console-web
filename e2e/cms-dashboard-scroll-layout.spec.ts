import { expect, test } from "@playwright/test";

test.describe("CMS dashboard scroll layout fixture", () => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`@i18n renders pseudo-locale CMS toolbar copy on ${viewport.name}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await context.addCookies([
        {
          name: "xynes_locale",
          value: "en-XA",
          url: "http://127.0.0.1:3200",
          sameSite: "Lax",
        },
      ]);

      await page.goto("/e2e/cms-dashboard-scroll");

      await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
      await expect(
        page.getByRole("region", { name: "[CCoonntteenntt ttoooollbbaarr]" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "[CCrreeaattee ccoonntteenntt]" }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", {
          name: "[SSeeaarrcchh ffoorr ccoonntteennttss]",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "[TTooggggllee ffaavvoorriitteess ffiilltteerr]",
        }),
      ).toBeVisible();
    });
  }

  test("exposes named sidebar and results regions that can receive keyboard focus", async ({
    page,
  }) => {
    await page.goto("/e2e/cms-dashboard-scroll");

    const sidebar = page.getByRole("complementary", {
      name: "Dashboard sidebar",
    });
    const navigation = page.getByRole("navigation", {
      name: "Dashboard navigation",
    });
    const sidebarScrollRegion = page.getByTestId("dashboard-sidebar-scroll-region");
    const resultsScrollRegion = page.getByRole("region", {
      name: "Content results",
    });

    await expect(sidebar).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(resultsScrollRegion).toBeVisible();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(sidebarScrollRegion).toBeFocused();

    await resultsScrollRegion.focus();
    await expect(resultsScrollRegion).toBeFocused();
  });

  test("keeps the primary toolbar pinned, hides and reopens the filter row, and isolates sidebar scrolling", async ({
    page,
  }) => {
    await page.goto("/e2e/cms-dashboard-scroll");

    const primaryRow = page.getByTestId("cms-content-toolbar-primary-row");
    const secondaryRow = page.getByTestId("cms-content-toolbar-secondary-row");
    const resultsScrollRegion = page.getByTestId("content-results-scroll-region");
    const sidebarScrollRegion = page.getByTestId("dashboard-sidebar-scroll-region");

    await expect(primaryRow).toBeVisible();
    await expect(secondaryRow).toBeVisible();
    await expect(resultsScrollRegion).toBeVisible();
    await expect(sidebarScrollRegion).toBeVisible();

    const primaryTopBefore = (await primaryRow.boundingBox())?.y ?? 0;
    await resultsScrollRegion.evaluate((element) => {
      [20, 24].forEach((scrollTop) => {
        element.scrollTo({ top: scrollTop, behavior: "instant" });
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
    });

    await expect(secondaryRow).toHaveAttribute("aria-hidden", "true");

    const primaryTopAfter = (await primaryRow.boundingBox())?.y ?? 0;
    expect(Math.abs(primaryTopAfter - primaryTopBefore)).toBeLessThanOrEqual(2);

    await resultsScrollRegion.evaluate((element) => {
      element.scrollTo({ top: 20, behavior: "instant" });
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    await expect(secondaryRow).not.toHaveAttribute("aria-hidden", "true");

    const sidebarScrollState = await sidebarScrollRegion.evaluate((element) => {
      const hasOverflow = element.scrollHeight > element.clientHeight;
      element.scrollTo({ top: 300, behavior: "instant" });
      return {
        hasOverflow,
        scrollTop: element.scrollTop,
      };
    });

    expect(sidebarScrollState.hasOverflow).toBe(true);
    expect(sidebarScrollState.scrollTop).toBeGreaterThan(0);
  });

  test("BUG-006: remains stable after five rapid desktop scrolls to the bottom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/e2e/cms-dashboard-scroll");

    const secondaryRow = page.getByTestId("cms-content-toolbar-secondary-row");
    const secondaryShell = page.getByTestId(
      "cms-content-toolbar-secondary-shell",
    );
    const resultsScrollRegion = page.getByTestId(
      "content-results-scroll-region",
    );

    await expect
      .poll(async () =>
        secondaryShell.evaluate(
          (element) => getComputedStyle(element).transitionProperty,
        ),
      )
      .not.toContain("max-height");

    for (let repetition = 0; repetition < 5; repetition += 1) {
      await resultsScrollRegion.evaluate((element) => {
        element.scrollTo({ top: 0, behavior: "instant" });
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect(secondaryRow).not.toHaveAttribute("aria-hidden", "true");

      const sample = await page.evaluate(async () => {
        const row = document.querySelector<HTMLElement>(
          '[data-testid="cms-content-toolbar-secondary-row"]',
        );
        const results = document.querySelector<HTMLElement>(
          '[data-testid="content-results-scroll-region"]',
        );
        const shell = document.querySelector<HTMLElement>(
          '[data-testid="cms-content-toolbar-secondary-shell"]',
        );
        if (!row || !results || !shell) {
          throw new Error("Scroll fixture is incomplete");
        }

        const ariaHiddenChanges: Array<string | null> = [];
        const observer = new MutationObserver(() => {
          ariaHiddenChanges.push(row.getAttribute("aria-hidden"));
        });
        observer.observe(row, {
          attributes: true,
          attributeFilter: ["aria-hidden"],
        });

        results.scrollTo({ top: results.scrollHeight, behavior: "instant" });
        results.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        observer.disconnect();

        return {
          ariaHidden: row.getAttribute("aria-hidden"),
          ariaHiddenChanges,
          maxScrollTop: results.scrollHeight - results.clientHeight,
          scrollTop: results.scrollTop,
          resultsClientHeight: results.clientHeight,
          resultsScrollHeight: results.scrollHeight,
          rowHeight: row.getBoundingClientRect().height,
          rowScrollHeight: row.scrollHeight,
          shellHeight: shell.getBoundingClientRect().height,
          shellInlineMaxHeight: shell.style.maxHeight,
          shellComputedMaxHeight: getComputedStyle(shell).maxHeight,
        };
      });

      expect(sample.maxScrollTop).toBeGreaterThan(0);
      expect(sample.scrollTop, JSON.stringify(sample)).toBe(
        sample.maxScrollTop,
      );
      expect(sample.ariaHidden).toBe("true");
      expect(sample.ariaHiddenChanges.filter((value) => value === "true")).toHaveLength(1);
      expect(sample.ariaHiddenChanges.filter((value) => value !== "true")).toHaveLength(0);
    }
  });

  test("keeps the zero state visible below the sticky stack", async ({ page }) => {
    await page.goto("/e2e/cms-dashboard-scroll-empty");

    const primaryRow = page.getByTestId("cms-content-toolbar-primary-row");
    const secondaryRow = page.getByTestId("cms-content-toolbar-secondary-row");
    const emptyTitle = page.getByText("No content entries yet");

    await expect(primaryRow).toBeVisible();
    await expect(secondaryRow).toBeVisible();
    await expect(emptyTitle).toBeVisible();

    const primaryBox = await primaryRow.boundingBox();
    const secondaryBox = await secondaryRow.boundingBox();
    const emptyTitleBox = await emptyTitle.boundingBox();

    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(emptyTitleBox).not.toBeNull();

    const stickyBottom = Math.max(primaryBox!.y + primaryBox!.height, secondaryBox!.y + secondaryBox!.height);
    expect(emptyTitleBox!.y).toBeGreaterThanOrEqual(stickyBottom - 1);
  });
});
