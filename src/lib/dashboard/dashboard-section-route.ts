import { toSafeDashboardPath } from "./workspace-route";

export const defaultDashboardSection = "content" as const;

export const dashboardSections = [
  "content",
  "plugins",
  "access-control",
  "integrations",
  "settings",
] as const;

export type DashboardSection = (typeof dashboardSections)[number];

export type ParsedDashboardPath = {
  workspaceSlug: string;
  section: DashboardSection;
  tailSegments: string[];
};

const DASHBOARD_PREFIX = "dashboard";

export function isDashboardSection(
  value: string | null | undefined,
): value is DashboardSection {
  return dashboardSections.includes((value ?? "") as DashboardSection);
}

export function normalizeContentPathSegment(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeContentPathSegments(values: string[]): string[] {
  return values.map(normalizeContentPathSegment).filter(Boolean);
}

export function parseDashboardSectionPath(
  pathname: string | null | undefined,
): ParsedDashboardPath | null {
  const sanitizedPath = (pathname ?? "").split("?")[0]?.split("#")[0] ?? "";
  const segments = sanitizedPath.split("/").filter(Boolean);

  if (segments[0] !== DASHBOARD_PREFIX) {
    return null;
  }

  const workspaceSlug = segments[1] ?? "";
  if (!toSafeDashboardPath(workspaceSlug)) {
    return null;
  }

  const sectionCandidate = segments[2] ?? defaultDashboardSection;
  if (!isDashboardSection(sectionCandidate)) {
    return null;
  }

  const tailSegments =
    sectionCandidate === "content"
      ? normalizeContentPathSegments(segments.slice(3))
      : [];

  return {
    workspaceSlug: workspaceSlug.trim().toLocaleLowerCase(),
    section: sectionCandidate,
    tailSegments,
  };
}

export function buildDashboardSectionPath({
  workspaceSlug,
  section = defaultDashboardSection,
  tailSegments = [],
}: {
  workspaceSlug: string;
  section?: DashboardSection;
  tailSegments?: string[];
}): string | null {
  const dashboardPath = toSafeDashboardPath(workspaceSlug);
  if (!dashboardPath || !isDashboardSection(section)) {
    return null;
  }

  const normalizedTailSegments =
    section === "content" ? normalizeContentPathSegments(tailSegments) : [];
  const sectionPath = `${dashboardPath}/${section}`;

  if (normalizedTailSegments.length === 0) {
    return sectionPath;
  }

  return `${sectionPath}/${normalizedTailSegments.join("/")}`;
}
