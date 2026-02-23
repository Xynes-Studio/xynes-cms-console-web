import { describe, expect, it } from "vitest";
import { toSafeDashboardPath } from "./workspace-route";

describe("toSafeDashboardPath", () => {
  it("returns namespaced path for valid slug", () => {
    expect(toSafeDashboardPath("acme-team")).toBe("/dashboard/acme-team");
  });

  it("normalizes uppercase and trims whitespace", () => {
    expect(toSafeDashboardPath("  Acme-Team  ")).toBe("/dashboard/acme-team");
  });

  it("returns null for invalid slug values", () => {
    expect(toSafeDashboardPath(undefined)).toBeNull();
    expect(toSafeDashboardPath("")).toBeNull();
    expect(toSafeDashboardPath("../evil")).toBeNull();
    expect(toSafeDashboardPath("bad slug")).toBeNull();
    expect(toSafeDashboardPath("acme-")).toBeNull();
    expect(toSafeDashboardPath("a")).toBeNull();
  });
});
