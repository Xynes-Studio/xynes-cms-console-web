const WORKSPACE_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

export function toSafeDashboardPath(
  workspaceSlug: string | null | undefined,
): string | null {
  const normalized = workspaceSlug?.trim().toLowerCase() ?? "";
  if (!WORKSPACE_SLUG_PATTERN.test(normalized)) {
    return null;
  }

  return `/dashboard/${normalized}`;
}
