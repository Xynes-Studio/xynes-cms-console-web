import { toSafeDashboardPath } from "../../lib/dashboard/workspace-route";

export type CmsDashboardNavKey =
  | "contents"
  | "plugins"
  | "access-control"
  | "integrations"
  | "settings";

type CmsDashboardNavSpec = {
  key: CmsDashboardNavKey;
  label: string;
  icon: string;
  segment: string;
};

export type CmsDashboardNavItem = {
  key: CmsDashboardNavKey;
  label: string;
  href: string;
  icon: string;
};

const CMS_DASHBOARD_NAV_SPECS: CmsDashboardNavSpec[] = [
  { key: "contents", label: "Contents", icon: "file-text", segment: "" },
  { key: "plugins", label: "Plugins", icon: "package", segment: "plugins" },
  {
    key: "access-control",
    label: "Access Control",
    icon: "folder-key",
    segment: "access-control",
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: "link",
    segment: "integrations",
  },
  { key: "settings", label: "Settings", icon: "settings", segment: "settings" },
];

export function getCmsDashboardNavItems(
  workspaceSlug: string,
): CmsDashboardNavItem[] {
  const dashboardBasePath = toSafeDashboardPath(workspaceSlug) ?? "/dashboard";

  return CMS_DASHBOARD_NAV_SPECS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    href: item.segment ? `${dashboardBasePath}/${item.segment}` : dashboardBasePath,
  }));
}
