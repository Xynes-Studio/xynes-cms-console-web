import { describe, expect, it } from "vitest";
import {
  buildDashboardSectionPath,
  defaultDashboardSection,
  isDashboardSection,
  normalizeContentPathSegment,
  normalizeContentPathSegments,
  parseDashboardSectionPath,
} from "./dashboard-section-route";

describe("dashboard-section-route", () => {
  it("validates dashboard section keys", () => {
    expect(isDashboardSection(defaultDashboardSection)).toBe(true);
    expect(isDashboardSection("plugins")).toBe(true);
    expect(isDashboardSection("unknown")).toBe(false);
  });

  it("normalizes content path segments", () => {
    expect(normalizeContentPathSegment("  Blogs & Drafts  ")).toBe("blogs-drafts");
    expect(normalizeContentPathSegments([" Blogs ", "___", "Drafts 2026 "])).toEqual([
      "blogs",
      "drafts-2026",
    ]);
  });

  it("parses canonical dashboard section paths", () => {
    expect(parseDashboardSectionPath("/dashboard/acme/content/blogs/weekly")).toEqual({
      workspaceSlug: "acme",
      section: "content",
      tailSegments: ["blogs", "weekly"],
    });
    expect(parseDashboardSectionPath("/dashboard/acme/plugins")).toEqual({
      workspaceSlug: "acme",
      section: "plugins",
      tailSegments: [],
    });
  });

  it("defaults base workspace dashboard path to content section", () => {
    expect(parseDashboardSectionPath("/dashboard/acme")).toEqual({
      workspaceSlug: "acme",
      section: "content",
      tailSegments: [],
    });
  });

  it("returns null for non-canonical or unsafe paths", () => {
    expect(parseDashboardSectionPath("/dashboard")).toBeNull();
    expect(parseDashboardSectionPath("/dashboard/../evil/content")).toBeNull();
    expect(parseDashboardSectionPath("/other/acme/content")).toBeNull();
    expect(parseDashboardSectionPath("/dashboard/acme/unknown")).toBeNull();
  });

  it("builds canonical dashboard section paths", () => {
    expect(
      buildDashboardSectionPath({
        workspaceSlug: "Acme-Team",
        section: "content",
        tailSegments: [" Blogs ", "Drafts 2026"],
      }),
    ).toBe("/dashboard/acme-team/content/blogs/drafts-2026");

    expect(
      buildDashboardSectionPath({
        workspaceSlug: "acme-team",
        section: "access-control",
        tailSegments: ["ignored"],
      }),
    ).toBe("/dashboard/acme-team/access-control");
  });

  it("fails closed when workspace slug is invalid", () => {
    expect(
      buildDashboardSectionPath({
        workspaceSlug: "bad slug",
      }),
    ).toBeNull();
  });
});
