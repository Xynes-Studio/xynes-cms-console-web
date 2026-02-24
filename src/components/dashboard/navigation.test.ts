import { describe, expect, it } from "vitest";
import { getCmsDashboardNavItems } from "./navigation";

describe("getCmsDashboardNavItems", () => {
  it("returns the CMS nav items with namespaced workspace hrefs", () => {
    expect(getCmsDashboardNavItems("acme-team")).toEqual([
      {
        key: "contents",
        label: "Contents",
        icon: "file-text",
        href: "/dashboard/acme-team",
      },
      {
        key: "plugins",
        label: "Plugins",
        icon: "package",
        href: "/dashboard/acme-team/plugins",
      },
      {
        key: "access-control",
        label: "Access Control",
        icon: "folder-key",
        href: "/dashboard/acme-team/access-control",
      },
      {
        key: "integrations",
        label: "Integrations",
        icon: "link",
        href: "/dashboard/acme-team/integrations",
      },
      {
        key: "settings",
        label: "Settings",
        icon: "settings",
        href: "/dashboard/acme-team/settings",
      },
    ]);
  });

  it("fails closed to /dashboard when workspace slug is invalid", () => {
    expect(getCmsDashboardNavItems("../evil")).toEqual([
      {
        key: "contents",
        label: "Contents",
        icon: "file-text",
        href: "/dashboard",
      },
      {
        key: "plugins",
        label: "Plugins",
        icon: "package",
        href: "/dashboard/plugins",
      },
      {
        key: "access-control",
        label: "Access Control",
        icon: "folder-key",
        href: "/dashboard/access-control",
      },
      {
        key: "integrations",
        label: "Integrations",
        icon: "link",
        href: "/dashboard/integrations",
      },
      {
        key: "settings",
        label: "Settings",
        icon: "settings",
        href: "/dashboard/settings",
      },
    ]);
  });
});
