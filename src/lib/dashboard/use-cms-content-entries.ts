"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listWorkspaceContentEntries,
  type WorkspaceContentEntriesListQuery,
  type WorkspaceContentEntriesListResult,
  type WorkspaceContentEntry,
} from "./content-entries-client";

export type UseCmsContentEntriesOptions = {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  query: WorkspaceContentEntriesListQuery & { view?: "grid" | "list" };
  enabled?: boolean;
  listEntries?: typeof listWorkspaceContentEntries;
};

export type UseCmsContentEntriesResult = {
  items: WorkspaceContentEntry[];
  count: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const emptyResult: WorkspaceContentEntriesListResult = {
  items: [],
  count: 0,
};

export function useCmsContentEntries({
  apiBaseUrl,
  workspaceId,
  accessToken,
  query,
  enabled = true,
  listEntries = listWorkspaceContentEntries,
}: UseCmsContentEntriesOptions): UseCmsContentEntriesResult {
  const [result, setResult] = useState<WorkspaceContentEntriesListResult>(emptyResult);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const stableQuery = useMemo<WorkspaceContentEntriesListQuery>(
    () => ({
      directoryId: query.directoryId,
      search: query.search,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    }),
    [
      query.directoryId,
      query.limit,
      query.offset,
      query.search,
      query.sortBy,
      query.sortDirection,
      query.status,
    ],
  );

  const runLoad = useCallback(async () => {
    if (!enabled) {
      requestIdRef.current += 1;
      setResult(emptyResult);
      setIsLoading(false);
      setError(null);
      return;
    }

    requestIdRef.current += 1;
    const localRequestId = requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const next = await listEntries({
        apiBaseUrl,
        workspaceId,
        accessToken,
        query: stableQuery,
      });
      if (localRequestId !== requestIdRef.current) {
        return;
      }
      setResult(next);
    } catch (loadError) {
      if (localRequestId !== requestIdRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError : new Error("Failed to load entries"));
      setResult(emptyResult);
    } finally {
      if (localRequestId !== requestIdRef.current) {
        return;
      }
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, enabled, listEntries, stableQuery, workspaceId]);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  return {
    items: result.items,
    count: result.count,
    isLoading,
    error,
    refresh: runLoad,
  };
}
