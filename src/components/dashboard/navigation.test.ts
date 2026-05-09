import { describe, expect, it } from "vitest";
import { getCmsDashboardNavItems } from "./navigation";

describe("getCmsDashboardNavItems", () => {
  it("returns the CMS nav items with namespaced workspace hrefs", () => {
    expect(getCmsDashboardNavItems("acme-team")).toEqual([
      {
        key: "contents",
        label: "Contents",
        icon: "file-text",
        href: "/dashboard/acme-team/content",
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
        href: "/dashboard/content",
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

  it("allows callers to provide translated labels without changing href construction", () => {
    expect(
      getCmsDashboardNavItems("acme-team", {
        contents: "[CCoonntteennttss]",
        plugins: "[PPluuggiinnss]",
        "access-control": "[AAcccceessss CCoonnttrrooll]",
        integrations: "[IInntteeggrraattiioonnss]",
        settings: "[SSeettttiinnggss]",
      }),
    ).toEqual([
      {
        key: "contents",
        label: "[CCoonntteennttss]",
        icon: "file-text",
        href: "/dashboard/acme-team/content",
      },
      {
        key: "plugins",
        label: "[PPluuggiinnss]",
        icon: "package",
        href: "/dashboard/acme-team/plugins",
      },
      {
        key: "access-control",
        label: "[AAcccceessss CCoonnttrrooll]",
        icon: "folder-key",
        href: "/dashboard/acme-team/access-control",
      },
      {
        key: "integrations",
        label: "[IInntteeggrraattiioonnss]",
        icon: "link",
        href: "/dashboard/acme-team/integrations",
      },
      {
        key: "settings",
        label: "[SSeettttiinnggss]",
        icon: "settings",
        href: "/dashboard/acme-team/settings",
      },
    ]);
  });
});
