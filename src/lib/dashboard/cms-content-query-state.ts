import type {
  WorkspaceContentEntriesListQuery,
  WorkspaceContentEntrySortBy,
  WorkspaceContentEntrySortDirection,
} from "./content-entries-client";

export type CmsContentView = "grid" | "list";

export type CmsContentQueryState = {
  query: string;
  sortBy: WorkspaceContentEntrySortBy;
  sortDirection: WorkspaceContentEntrySortDirection;
  view: CmsContentView;
  followingOnly: boolean;
  favoritesOnly: boolean;
  status: WorkspaceContentEntriesListQuery["status"];
  directoryId: string | null;
  limit: number;
  offset: number;
};

type SearchParamsReader = Pick<URLSearchParams, "get">;

const clampInt = (
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const parseBoolean = (value: string | null): boolean =>
  value === "1" || value === "true";

const parseSortBy = (value: string | null): WorkspaceContentEntrySortBy => {
  if (value === "title" || value === "popularity") {
    return value;
  }
  return "date";
};

const parseSortDirection = (
  value: string | null,
): WorkspaceContentEntrySortDirection => (value === "asc" ? "asc" : "desc");

const parseView = (value: string | null): CmsContentView =>
  value === "grid" ? "grid" : "list";

const parseStatus = (
  value: string | null,
): WorkspaceContentEntriesListQuery["status"] => {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  return "all";
};

export function parseCmsContentQueryState(
  searchParams: SearchParamsReader,
): CmsContentQueryState {
  const query = searchParams.get("q")?.trim() ?? "";
  const directoryId = searchParams.get("directoryId")?.trim() ?? "";

  return {
    query,
    sortBy: parseSortBy(searchParams.get("sortBy")),
    sortDirection: parseSortDirection(searchParams.get("sortDirection")),
    view: parseView(searchParams.get("view")),
    followingOnly: parseBoolean(searchParams.get("following")),
    favoritesOnly: parseBoolean(searchParams.get("favorites")),
    status: parseStatus(searchParams.get("status")),
    directoryId: directoryId || null,
    limit: clampInt(searchParams.get("limit"), 20, 1, 100),
    offset: clampInt(searchParams.get("offset"), 0, 0, 100000),
  };
}

export function serializeCmsContentQueryState(
  state: CmsContentQueryState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.directoryId) params.set("directoryId", state.directoryId);
  if (state.sortBy !== "date") params.set("sortBy", state.sortBy);
  if (state.sortDirection !== "desc") {
    params.set("sortDirection", state.sortDirection);
  }
  if (state.view !== "list") params.set("view", state.view);
  if (state.followingOnly) params.set("following", "1");
  if (state.favoritesOnly) params.set("favorites", "1");
  if (state.status && state.status !== "all") {
    params.set("status", state.status);
  }
  if (state.limit !== 20) params.set("limit", String(state.limit));
  if (state.offset > 0) params.set("offset", String(state.offset));
  return params;
}

/**
 * Carries validated CMS list preferences between path-based directories.
 * Directory identity comes from the path, and pagination restarts for the new
 * directory, so legacy `directoryId` and `offset` values are deliberately
 * removed. Unknown query keys never cross the navigation boundary.
 */
export function buildCmsContentNavigationUrl(
  targetPath: string,
  currentSearchParams: SearchParamsReader,
): string {
  const state = parseCmsContentQueryState(currentSearchParams);
  const params = serializeCmsContentQueryState({
    ...state,
    directoryId: null,
    offset: 0,
  });
  const query = params.toString();
  return query ? `${targetPath}?${query}` : targetPath;
}
