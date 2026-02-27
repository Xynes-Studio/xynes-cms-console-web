"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

export type CmsContentQueryUpdateOptions = {
  navigation?: "push" | "replace";
};

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

export function useCmsContentQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<CmsContentQueryState>(() => {
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
      directoryId: directoryId ? directoryId : null,
      limit: clampInt(searchParams.get("limit"), 20, 1, 100),
      offset: clampInt(searchParams.get("offset"), 0, 0, 100000),
    };
  }, [searchParams]);

  const setState = useCallback(
    (
      patch: Partial<CmsContentQueryState>,
      options?: CmsContentQueryUpdateOptions,
    ) => {
      const nextState: CmsContentQueryState = {
        ...state,
        ...patch,
      };

      const params = new URLSearchParams();
      if (nextState.query) params.set("q", nextState.query);
      if (nextState.directoryId)
        params.set("directoryId", nextState.directoryId);
      if (nextState.sortBy !== "date") params.set("sortBy", nextState.sortBy);
      if (nextState.sortDirection !== "desc") {
        params.set("sortDirection", nextState.sortDirection);
      }
      if (nextState.view !== "list") params.set("view", nextState.view);
      if (nextState.followingOnly) params.set("following", "1");
      if (nextState.favoritesOnly) params.set("favorites", "1");
      if (nextState.status && nextState.status !== "all") {
        params.set("status", nextState.status);
      }
      if (nextState.limit !== 20) params.set("limit", String(nextState.limit));
      if (nextState.offset > 0) params.set("offset", String(nextState.offset));

      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentQueryString = searchParams.toString();
      const currentUrl = currentQueryString
        ? `${pathname}?${currentQueryString}`
        : pathname;

      if (nextUrl === currentUrl) {
        return;
      }

      if (options?.navigation === "replace") {
        router.replace(nextUrl);
        return;
      }

      router.push(nextUrl);
    },
    [pathname, router, searchParams, state],
  );

  return {
    state,
    setState,
  };
}
