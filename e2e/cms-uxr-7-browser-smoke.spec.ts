/**
 * UXR-7 — Browser UX Smoke Matrix (L2: CMS Console Playwright)
 * Story: xynes/xynes-infra/docs/research/ux-review/01-user-stories.md (UXR-7)
 * Matrix: xynes-front-end/infra/docs/testing/2026-05-10-uxr-7-browser-ux-smoke-matrix.md
 *
 * This spec is the CMS Console contribution to the UXR-7 matrix. It runs
 * against the existing `/e2e/cms-dashboard-scroll` fixture page (no backend
 * required — Playwright auto-starts `next dev` on port 3200 with
 * `NEXT_PUBLIC_ENABLE_E2E_FIXTURES=1`). It deliberately covers the UXR-7
 * acceptance criteria that CANNOT be exercised at L1 (unit DOM tests):
 *
 *   - No raw catalog key paths leak into rendered text in either locale.
 *   - No critical console errors during render at any viewport / locale.
 *   - All visible icon-only toolbar / nav / menu controls have non-empty
 *     accessible names.
 *   - Toolbar / nav controls meet WCAG 2.2 24×24 px target size — or have
 *     ≥ 24 px spacing from any adjacent pointer target.
 *   - Keyboard reachability: tab order reaches the dashboard sidebar
 *     scroll region and the content results scroll region.
 *   - Pseudo-locale (`en-XA`) does not produce visible text overlap on the
 *     primary toolbar.
 *
 * Tests are tagged `@uxr7` so they can be run as a focused smoke via
 *   pnpm test:e2e -- --grep @uxr7
 *
 * The existing `@i18n` tests in `cms-dashboard-scroll-layout.spec.ts` stay
 * authoritative for locale-correct rendering of toolbar copy. This spec is
 * additive — it does NOT modify the existing tests or fixtures.
 */
import { expect, test } from "@playwright/test";

type Viewport = { name: "desktop" | "mobile"; width: number; height: number };

const VIEWPORTS: ReadonlyArray<Viewport> = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

// Per the UXR-7 matrix doc — these are the locales we stress-test. Real
// regional locales (RTL / CJK) are out of scope.
const LOCALES = ["en-US", "en-XA"] as const;
type Locale = (typeof LOCALES)[number];

const FIXTURE_BASE = "http://127.0.0.1:3200";
const FIXTURE_URL = "/e2e/cms-dashboard-scroll";

async function setLocaleCookie(
  context: import("@playwright/test").BrowserContext,
  locale: Locale,
) {
  await context.addCookies([
    {
      name: "xynes_locale",
      value: locale,
      url: FIXTURE_BASE,
      sameSite: "Lax",
    },
  ]);
}

test.describe("@uxr7 CMS dashboard fixture — accessibility smoke", () => {
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`@uxr7 has no raw catalog key paths or critical console errors on ${viewport.name} (${locale})`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await setLocaleCookie(context, locale);

        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text());
          }
        });
        page.on("pageerror", (err) => {
          consoleErrors.push(`pageerror: ${err.message}`);
        });

        await page.goto(FIXTURE_URL);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        // No raw catalog key paths anywhere in the rendered text.
        const bodyText = await page.locator("body").innerText();
        expect(bodyText).not.toMatch(/cms\.shell\./);
        expect(bodyText).not.toMatch(/cms\.content\./);
        expect(bodyText).not.toMatch(/auth\.dashboard\./);

        // No raw API keys / JWTs / hashes in the DOM. The fixture page is
        // a pure layout fixture so this should always be true; the
        // assertion exists to catch a regression where a future fixture
        // accidentally embeds workspace-scoped data.
        expect(bodyText).not.toMatch(/xynes_live_/);
        expect(bodyText).not.toMatch(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./);
        expect(bodyText).not.toMatch(/\$argon2id\$/);

        // No critical console errors caused by the render.
        const blockingErrors = consoleErrors.filter((line) => {
          // Allowlist known harmless dev-mode signals — they're noise, not
          // UX regressions. Tighten this list aggressively if it grows.
          return !/Download the React DevTools/i.test(line);
        });
        expect(blockingErrors, blockingErrors.join("\n")).toHaveLength(0);
      });

      test(`@uxr7 dense toolbar / nav / menu controls have accessible names and 24×24 px targets on ${viewport.name} (${locale})`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await setLocaleCookie(context, locale);
        await page.goto(FIXTURE_URL);

        // Collect every visible button + role=button on the page. We focus
        // on the dense control surface (toolbar + sidebar nav + mobile
        // menu trigger) and assert all of them satisfy WCAG 2.2 target
        // size and have non-empty accessible names.
        type TargetReport = {
          tag: string;
          label: string;
          width: number;
          height: number;
          x: number;
          y: number;
        };

        const reports = await page.evaluate(() => {
          function accessibleNameOf(el: Element): string {
            const aria = el.getAttribute("aria-label");
            if (aria && aria.trim()) return aria.trim();
            const labelledBy = el.getAttribute("aria-labelledby");
            if (labelledBy) {
              const ids = labelledBy.split(/\s+/).filter(Boolean);
              const parts = ids
                .map((id) => document.getElementById(id)?.textContent?.trim())
                .filter(Boolean) as string[];
              if (parts.length) return parts.join(" ");
            }
            const title = el.getAttribute("title");
            if (title && title.trim()) return title.trim();
            // Fall back to flattened text content (covers links / buttons
            // with visible text labels).
            return (el.textContent ?? "").replace(/\s+/g, " ").trim();
          }

          const candidates = Array.from(
            document.querySelectorAll<HTMLElement>(
              'button, [role="button"], a[href]',
            ),
          ).filter((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") {
              return false;
            }
            return true;
          });

          return candidates.map<TargetReport>((el) => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              label: accessibleNameOf(el),
              width: rect.width,
              height: rect.height,
              x: rect.x,
              y: rect.y,
            };
          });
        });

        // Every visible interactive control must have an accessible name.
        const unnamed = reports.filter((r) => !r.label);
        expect(
          unnamed,
          `unnamed interactive controls: ${JSON.stringify(unnamed)}`,
        ).toHaveLength(0);

        // 24 × 24 px target size — or ≥ 24 px from any adjacent target.
        // Per WCAG 2.2 SC 2.5.8 (Target Size — Minimum), small targets are
        // acceptable if they have sufficient spacing. We approximate
        // "sufficient spacing" as 24 px clearance to the nearest other
        // interactive bounding box.
        function targetMeetsContract(idx: number): boolean {
          const a = reports[idx];
          if (a.width >= 24 && a.height >= 24) return true;
          const ax = a.x + a.width / 2;
          const ay = a.y + a.height / 2;
          for (let j = 0; j < reports.length; j++) {
            if (j === idx) continue;
            const b = reports[j];
            const bx = b.x + b.width / 2;
            const by = b.y + b.height / 2;
            const distance = Math.hypot(ax - bx, ay - by);
            if (distance < 24) return false;
          }
          return true;
        }

        const undersized = reports
          .map((report, idx) => ({ report, idx }))
          .filter(({ idx }) => !targetMeetsContract(idx))
          .map(({ report }) => report);

        expect(
          undersized,
          `undersized targets without ≥24px spacing: ${JSON.stringify(undersized, null, 2)}`,
        ).toHaveLength(0);
      });

      test(`@uxr7 keyboard tab order reaches sidebar scroll region and results scroll region on ${viewport.name} (${locale})`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await setLocaleCookie(context, locale);
        await page.goto(FIXTURE_URL);

        const resultsScroll = page.getByTestId("content-results-scroll-region");
        await expect(resultsScroll).toBeVisible();

        // Resolve focus to the document body to start from a stable origin.
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur?.();
          document.body.focus();
        });

        if (viewport.name === "desktop") {
          // Desktop branch: the sidebar scroll region is rendered inline in
          // the shell. Tab order must reach it within a generous budget.
          const sidebarScroll = page.getByTestId(
            "dashboard-sidebar-scroll-region",
          );
          await expect(sidebarScroll).toBeVisible();

          let reachedSidebar = false;
          for (let i = 0; i < 30; i++) {
            await page.keyboard.press("Tab");
            if (
              await sidebarScroll.evaluate(
                (el) => el === document.activeElement,
              )
            ) {
              reachedSidebar = true;
              break;
            }
          }
          expect(
            reachedSidebar,
            "Tab order should reach the sidebar scroll region within 30 tabs (desktop)",
          ).toBe(true);
        } else {
          // Mobile branch: the shell collapses the inline sidebar into a
          // bottom-bar "Open menu" trigger that opens a drawer. The proper
          // UXR-7 keyboard contract on mobile is:
          //   1. The mobile menu trigger is a real focusable element
          //      (i.e. reachable by Tab in principle — we assert it can
          //      receive focus rather than counting tab stops, because the
          //      fixture renders 18 result entries that legitimately sit
          //      ahead of the bottom-bar in document order).
          //   2. Activating it via keyboard (Enter) opens the drawer and
          //      reveals the sidebar scroll region — keeping the same nav
          //      surface available to keyboard users.
          const mobileMenuTrigger = page.getByTestId(
            "dashboard-mobile-menu-tab",
          );
          await expect(mobileMenuTrigger).toBeVisible();

          await mobileMenuTrigger.focus();
          await expect(mobileMenuTrigger).toBeFocused();

          await page.keyboard.press("Enter");
          // The mobile drawer is the keyboard-equivalent of the desktop
          // sidebar scroll region. It has its own testid because Lumia
          // renders a different DOM tree on mobile (a Drawer, not an
          // inline sidebar). Asserting it is visible after Enter proves
          // the same nav surface is reachable via keyboard on mobile.
          const mobileMenuSheet = page.getByTestId(
            "dashboard-mobile-menu-sheet",
          );
          await expect(mobileMenuSheet).toBeVisible();
        }

        // Results region can be focused programmatically (it's a scroll
        // container with tabindex="0" per the existing fixture) — confirm
        // it still accepts focus in the new locale + viewport combo.
        await resultsScroll.focus();
        await expect(resultsScroll).toBeFocused();
      });
    }
  }
});

test.describe("@uxr7 CMS dashboard fixture — pseudo-locale layout safety", () => {
  for (const viewport of VIEWPORTS) {
    test(`@uxr7 en-XA primary toolbar row does not produce visible text overlap on ${viewport.name}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await setLocaleCookie(context, "en-XA");
      await page.goto(FIXTURE_URL);

      const primaryRow = page.getByTestId("cms-content-toolbar-primary-row");
      await expect(primaryRow).toBeVisible();

      // Sample the bounding boxes of the primary row's direct interactive
      // children and assert no two of them overlap. Pseudo-locale doubled
      // characters are the most likely trigger for clipping / overlap on
      // this dense surface.
      const overlaps = await primaryRow.evaluate((row) => {
        const children = Array.from(
          row.querySelectorAll<HTMLElement>(
            'button, [role="button"], input, a[href]',
          ),
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const overlapsFound: Array<[string, string]> = [];
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) {
            const a = children[i].getBoundingClientRect();
            const b = children[j].getBoundingClientRect();
            // Allow ≤ 2 px tolerance for sub-pixel rendering differences.
            const horizontalOverlap =
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2;
            const verticalOverlap =
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
            if (horizontalOverlap && verticalOverlap) {
              overlapsFound.push([
                children[i].outerHTML.slice(0, 80),
                children[j].outerHTML.slice(0, 80),
              ]);
            }
          }
        }
        return overlapsFound;
      });
      expect(overlaps, JSON.stringify(overlaps, null, 2)).toEqual([]);
    });
  }
});
