import { expect, test } from "@playwright/test";

test.describe("CMS dashboard scroll layout fixture", () => {
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
