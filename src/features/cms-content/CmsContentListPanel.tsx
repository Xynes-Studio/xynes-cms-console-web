"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import type { BreadcrumbItem } from "@lumia-ui/components";
import { Alert, Card } from "@lumia-ui/components";
import { CmsContentCardGrid } from "../../components/dashboard/CmsContentCardGrid";
import { CmsContentCardList } from "../../components/dashboard/CmsContentCardList";
import { useCmsContentQueryState } from "../../lib/dashboard/use-cms-content-query-state";
import { useCmsContentEntries } from "../../lib/dashboard/use-cms-content-entries";
import { CmsContentToolbar } from "../../components/dashboard/CmsContentToolbar";
import {
  CmsContentListState,
  resolveCmsContentListState,
} from "./CmsContentListState";
import { listWorkspaceContentDirectories } from "../../lib/dashboard/content-directories-client";
import {
  getContentDirectoryPathIds,
  materializePersistedContentDirectories,
} from "../../lib/dashboard/content-directory-tree";
import {
  buildContentEntryEditRoute,
  createDraftEntryAndResolveEditPath,
  getCreateEntryErrorMessage,
} from "./CmsContentActions";
import { mapEntryToGridCardProps, mapEntryToListCardProps } from "./mappers";

const QUERY_REPLACE_DEBOUNCE_MS = 300;

const noopEntryAction: (entryId: string) => void = () => {
  return;
};

const safeDecodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export function CmsContentListPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { state, setState } = useCmsContentQueryState();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState(state.query);
  const [isQueryEditing, setIsQueryEditing] = useState(false);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // resolvedDirectoryId:
  //   undefined = actively resolving (directory path exists but UUID not yet looked up)
  //   null      = root view (no path segments) or resolution completed with no match
  //   string    = resolved UUID of the leaf directory matching the current URL path
  const [resolvedDirectoryId, setResolvedDirectoryId] = useState<
    string | null | undefined
  >(undefined);
  const [isDirectoryResolving, setIsDirectoryResolving] = useState(false);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  // ── breadcrumb derivation (hoisted so it can be used in effects below) ──
  const pathParts = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => safeDecodePathSegment(segment));
  const contentIndex = pathParts.lastIndexOf("content");
  const breadcrumbParts = useMemo(
    () => (contentIndex >= 0 ? pathParts.slice(contentIndex + 1) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname],
  );
  const breadcrumbKey = breadcrumbParts.join("/");
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isAuthLoading || !isAuthenticated || !currentWorkspace?.id) {
        if (!cancelled) {
          setAccessToken(null);
        }
        return;
      }

      try {
        const token = await getAccessToken();
        if (cancelled) {
          return;
        }

        setAccessToken(token?.trim() ? token.trim() : null);
      } catch {
        if (!cancelled) {
          setAccessToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id, getAccessToken, isAuthenticated, isAuthLoading]);

  // ── resolve directory UUID from URL path segments ─────────────────────
  useEffect(() => {
    if (breadcrumbParts.length === 0) {
      setResolvedDirectoryId(null);
      setIsDirectoryResolving(false);
      return;
    }

    if (!currentWorkspace?.id || !accessToken || !apiBaseUrl) {
      // Wait until auth is ready — keep current resolvedDirectoryId as-is
      return;
    }

    let cancelled = false;
    setResolvedDirectoryId(undefined); // clear stale UUID before new async resolution
    setIsDirectoryResolving(true);

    void (async () => {
      try {
        const dirs = await listWorkspaceContentDirectories({
          apiBaseUrl,
          workspaceId: currentWorkspace.id,
          accessToken,
        });
        if (cancelled) return;

        const tree = materializePersistedContentDirectories({
          baseNodes: [],
          directories: dirs,
        });
        const pathIds = getContentDirectoryPathIds({
          nodes: tree,
          pathSegments: breadcrumbParts,
        });
        // Last ID is the leaf (deepest matching) directory
        const leafId = pathIds.at(-1) ?? null;
        setResolvedDirectoryId(leafId);
      } catch {
        if (!cancelled) setResolvedDirectoryId(null);
      } finally {
        if (!cancelled) setIsDirectoryResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // breadcrumbKey is a stable primitive derived from breadcrumbParts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breadcrumbKey, currentWorkspace?.id, accessToken, apiBaseUrl]);

  // ── URL query debounce ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isQueryEditing) {
      return;
    }

    const normalizedQuery = queryDraft.trim();
    if (normalizedQuery === state.query) {
      return;
    }

    const timer = window.setTimeout(() => {
      setState(
        {
          query: normalizedQuery,
          offset: 0,
        },
        { navigation: "replace" },
      );
    }, QUERY_REPLACE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isQueryEditing, queryDraft, setState, state.query]);

  const workspaceSlug =
    contentIndex > 0 && pathParts[contentIndex - 1]
      ? pathParts[contentIndex - 1]
      : null;
  const contentBasePath = workspaceSlug
    ? `/dashboard/${encodeURIComponent(workspaceSlug)}/content`
    : "/dashboard";
  const resolvedWorkspaceSlug = currentWorkspace?.slug?.trim() || workspaceSlug;

  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: "Contents",
      onClick: () => router.push(contentBasePath),
    },
  ];

  breadcrumbParts.forEach((segment, index) => {
    const to = `${contentBasePath}/${breadcrumbParts
      .slice(0, index + 1)
      .map((part) => encodeURIComponent(part))
      .join("/")}`;

    breadcrumbItems.push({
      label: segment,
      onClick: () => router.push(to),
    });
  });

  // ── card action handlers ──────────────────────────────────────────────────
  const handleOpen = useCallback(
    (entryId: string) => {
      if (!resolvedWorkspaceSlug) return;
      try {
        const editPath = buildContentEntryEditRoute({
          workspaceSlug: resolvedWorkspaceSlug,
          entryId,
        });
        router.push(editPath);
      } catch {
        // invalid slug or entryId — silently ignore
      }
    },
    [resolvedWorkspaceSlug, router],
  );

  const handleShare = useCallback(
    (entryId: string) => {
      if (!resolvedWorkspaceSlug) return;
      try {
        const editPath = buildContentEntryEditRoute({
          workspaceSlug: resolvedWorkspaceSlug,
          entryId,
        });
        const shareUrl = window.location.origin + editPath;
        void navigator.clipboard.writeText(shareUrl).catch(() => {
          // clipboard unavailable or permission denied — silently ignore
        });
      } catch {
        // invalid slug or entryId — silently ignore
      }
    },
    [resolvedWorkspaceSlug],
  );

  const listHandlers = useMemo(
    () => ({
      onOpen: handleOpen,
      onDelete: noopEntryAction,
      onShare: handleShare,
      onToggleFavorite: noopEntryAction,
    }),
    [handleOpen, handleShare],
  );

  const { items, count, isLoading, error, refresh } = useCmsContentEntries({
    apiBaseUrl,
    workspaceId: currentWorkspace?.id ?? "",
    accessToken: accessToken ?? "",
    query: {
      // Use the resolved UUID so the API filters by the correct directory.
      // null = no filter (root view or no match); undefined = still resolving.
      directoryId: resolvedDirectoryId,
      search: state.query,
      sortBy: state.sortBy,
      sortDirection: state.sortDirection,
      status: state.status,
      limit: state.limit,
      offset: state.offset,
      view: state.view,
    },
    enabled:
      !isAuthLoading &&
      isAuthenticated &&
      Boolean(currentWorkspace?.id) &&
      Boolean(accessToken) &&
      Boolean(apiBaseUrl) &&
      // Block fetch until directory UUID is resolved to prevent showing unfiltered results
      !isDirectoryResolving,
  });

  // Treat directory resolution as a loading phase so the skeleton shows
  const effectiveIsLoading = isLoading || isDirectoryResolving;

  const listViewState = resolveCmsContentListState({
    isLoading: effectiveIsLoading,
    error,
    count,
    query: state.query,
    breadcrumbParts,
  });

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Content list panel"
    >
      <CmsContentToolbar
        breadcrumbItems={breadcrumbItems}
        itemCount={count}
        query={isQueryEditing ? queryDraft : state.query}
        sortBy={state.sortBy}
        view={state.view}
        followingOnly={state.followingOnly}
        favoritesOnly={state.favoritesOnly}
        onCreate={() => {
          setCreateError(null);

          if (isCreatingEntry) {
            return;
          }

          if (isDirectoryResolving) {
            // Resolution is in flight — using resolvedDirectoryId here would
            // create the entry in the wrong (stale) directory. Block until done.
            return;
          }

          if (
            !apiBaseUrl ||
            !currentWorkspace?.id ||
            !accessToken ||
            !resolvedWorkspaceSlug
          ) {
            setCreateError("Please sign in again and retry.");
            return;
          }

          setIsCreatingEntry(true);

          void (async () => {
            try {
              const editPath = await createDraftEntryAndResolveEditPath({
                apiBaseUrl,
                workspaceId: currentWorkspace.id,
                workspaceSlug: resolvedWorkspaceSlug,
                accessToken,
                // Use the path-resolved directory UUID so new entries land in
                // the currently-browsed directory, not the query-param one.
                directoryId: resolvedDirectoryId,
              });

              router.push(editPath);
            } catch (error) {
              const message = getCreateEntryErrorMessage(error);
              console.error("[CMS][create] toolbar flow failed", {
                workspaceId: currentWorkspace.id,
                workspaceSlug: resolvedWorkspaceSlug,
                // Use the path-resolved UUID, not the (deprecated) URL query-param directoryId
                resolvedDirectoryId,
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : String(error ?? "unknown"),
                userMessage: message,
              });
              setCreateError(message);
            } finally {
              setIsCreatingEntry(false);
            }
          })();
        }}
        onQueryChange={(query) => {
          setQueryDraft(query);
          setIsQueryEditing(true);
        }}
        onSearchSubmit={() => {
          const normalizedQuery = (
            isQueryEditing ? queryDraft : state.query
          ).trim();
          setQueryDraft(normalizedQuery);
          setIsQueryEditing(false);
          setState({ query: normalizedQuery, offset: 0 });
        }}
        onSortChange={(sortBy) => {
          setState({ sortBy, offset: 0 });
        }}
        onViewChange={(view) => {
          setState({ view });
        }}
        onFollowingToggle={() => {
          setState({ followingOnly: !state.followingOnly, offset: 0 });
        }}
        onFavoritesToggle={() => {
          setState({ favoritesOnly: !state.favoritesOnly, offset: 0 });
        }}
      />

      {createError ? (
        <div className="px-4 pt-3">
          <Alert
            variant="error"
            title="Unable to create content"
            description={createError}
            closable
            onClose={() => setCreateError(null)}
          />
        </div>
      ) : null}

      <CmsContentListState
        state={listViewState}
        onRetry={() => void refresh()}
      />

      {listViewState.kind === "ready" ? (
        <Card className="m-4 border border-border bg-background p-4">
          <ul
            aria-label="Content entries"
            className={
              state.view === "grid"
                ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                : "grid grid-cols-1 gap-3"
            }
          >
            {items.map((item) => (
              <li key={item.id}>
                {state.view === "grid" ? (
                  <CmsContentCardGrid
                    {...mapEntryToGridCardProps({
                      entry: item,
                      onOpen: handleOpen,
                    })}
                  />
                ) : (
                  <CmsContentCardList
                    {...mapEntryToListCardProps({
                      entry: item,
                      handlers: listHandlers,
                    })}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
