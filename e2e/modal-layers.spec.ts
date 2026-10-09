import { expect, test } from "@playwright/test";

for (const parent of ["sheet", "dialog"] as const) {
  test(`nested modal scrim paints above its parent ${parent}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/e2e/modal-layers?parent=${parent}`);
    const parentTrigger = page.getByRole("button", { name: "Open parent" });
    await parentTrigger.click();
    const parentModal = page.getByTestId("parent-modal");
    await expect(parentModal).toBeVisible();
    const nestedTrigger = page.getByRole("button", { name: "Open nested" });
    await nestedTrigger.click();
    const nestedModal = page.getByTestId("nested-modal");
    await expect(nestedModal).toBeVisible();
    const order = await parentModal.evaluate((parentElement, parentKind) => {
      const childOverlay = document.querySelector(
        parentKind === "sheet"
          ? "[data-lumia-dialog-overlay]"
          : "[data-lumia-sheet-overlay]",
      )!;
      const childContent = document.querySelector(
        '[data-testid="nested-modal"]',
      )!;
      return {
        parentLayer: Number(getComputedStyle(parentElement).zIndex),
        overlayLayer: Number(getComputedStyle(childOverlay).zIndex),
        contentLayer: Number(getComputedStyle(childContent).zIndex),
        overlayFollowsParent: Boolean(
          parentElement.compareDocumentPosition(childOverlay) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        contentFollowsOverlay: Boolean(
          childOverlay.compareDocumentPosition(childContent) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      };
    }, parent);
    expect(order.parentLayer).toBeGreaterThan(50);
    expect(order.overlayLayer).toBeGreaterThanOrEqual(order.parentLayer);
    expect(order.contentLayer).toBeGreaterThanOrEqual(order.overlayLayer);
    if (order.overlayLayer === order.parentLayer)
      expect(order.overlayFollowsParent).toBe(true);
    if (order.contentLayer === order.overlayLayer)
      expect(order.contentFollowsOverlay).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`nested-${parent}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(nestedTrigger).toBeFocused();
    await expect(parentModal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(parentTrigger).toBeFocused();
  });
}
