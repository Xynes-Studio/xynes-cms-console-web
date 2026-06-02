"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import type { BreadcrumbItem } from "@lumia-ui/components";
import { Alert, ConfirmDialog, useToast } from "@lumia-ui/components";
import { CmsContentCardGrid } from "../../components/dashboard/CmsContentCardGrid";
import { CmsContentCardList } from "../../components/dashboard/CmsContentCardList";
import {
  deleteWorkspaceContentEntry,
  toggleWorkspaceEntryFavorite,
} from "../../lib/dashboard/content-entries-client";
import { useCmsContentQueryState } from "../../lib/dashboard/use-cms-content-query-state";
import { useCmsContentEntries } from "../../lib/dashboard/use-cms-content-entries";
import { CmsContentToolbar } from "../../components/dashboard/CmsContentToolbar";
import {
  CmsContentListState,
  resolveCmsContentListState,
} from "./CmsContentListState";
import { useCmsContentToolbarScrollStack } from "./useCmsContentToolbarScrollStack";
import { listWorkspaceContentDirectories } from "../../lib/dashboard/content-directories-client";
import {
  getContentDirectoryPathIds,
  materializePersistedContentDirectories,
} from "../../lib/dashboard/content-directory-tree";
import {
  buildContentEntryEditRoute,
  buildContentEntryShareUrl,
  createDraftEntryAndResolveEditPath,
  getCreateEntryErrorMessage,
} from "./CmsContentActions";
import { mapEntryToGridCardProps, mapEntryToListCardProps } from "./mappers";

const QUERY_REPLACE_DEBOUNCE_MS = 300;
const mutationErrorDescription =
  "Please try again. If the issue persists, contact your workspace owner.";
export const UNMATCHED_DIRECTORY_ID = "__UNMATCHED_DIRECTORY_ID__";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const safeDecodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export function CmsContentListPanel() {
  const { show: showToast } = useToast();
  const t = useTranslations("cms.content");
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
  const [deletedEntryIds, setDeletedEntryIds] = useState<Record<string, true>>(
    {},
  );
  const [favoriteOverrides, setFavoriteOverrides] = useState<
    Record<string, boolean>
  >({});
  const [pendingDeleteIds, setPendingDeleteIds] = useState<
    Record<string, true>
  >({});
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<
    string | null
  >(null);
  const [pendingDeleteEntryLabel, setPendingDeleteEntryLabel] = useState("");
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<
    Record<string, true>
  >({});
  // resolvedDirectoryId:
  //   undefined                      = actively resolving
  //   null                           = root view (no path segments)
  //   UNMATCHED_DIRECTORY_ID string  = path does not match a persisted directory
  //   string                         = resolved UUID of the leaf directory matching the current URL path
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
        const leafId =
          pathIds.length === breadcrumbParts.length
            ? (pathIds.at(-1) ?? null)
            : UNMATCHED_DIRECTORY_ID;
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
  const isUnmatchedDirectoryPath =
    resolvedDirectoryId === UNMATCHED_DIRECTORY_ID;

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

  const showMutationError = useCallback(
    (title: "Could not delete content" | "Could not update favourite") => {
      showToast({
        variant: "error",
        title,
        description: mutationErrorDescription,
      });
    },
    [showToast],
  );

  const { items, isLoading, error, refresh } = useCmsContentEntries({
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
      !isDirectoryResolving &&
      !isUnmatchedDirectoryPath,
  });

  // Treat directory resolution as a loading phase so the skeleton shows
  const effectiveIsLoading = isLoading || isDirectoryResolving;
  const itemsWithOverrides = items
    .filter((item) => !deletedEntryIds[item.id])
    .map((item) => ({
      ...item,
      isFavorite: favoriteOverrides[item.id] ?? item.isFavorite,
    }));
  // BUG-CMS-11: when the favourites chip is active, only entries whose
  // effective isFavorite (after favoriteOverrides) is true should render. The
  // filter runs AFTER override application so optimistic toggles flow through
  // immediately — un-favouriting a row while the chip is active hides it on
  // the next render; if the server rejects the toggle the override rolls back
  // and the row re-appears in the same paint.
  const visibleItems = state.favoritesOnly
    ? itemsWithOverrides.filter((item) => item.isFavorite)
    : itemsWithOverrides;
  const visibleCount = visibleItems.length;

  const handleShare = useCallback(
    async (entryId: string) => {
      if (!resolvedWorkspaceSlug) return;
      try {
        const targetEntry = visibleItems.find((item) => item.id === entryId);
        const entryLabel = targetEntry?.title?.trim() || "This content";
        const shareUrl = buildContentEntryShareUrl({
          origin: window.location.origin,
          workspaceSlug: resolvedWorkspaceSlug,
          entryId,
        });
        await navigator.clipboard.writeText(shareUrl);
        showToast({
          variant: "success",
          title: "Link copied",
          description: `"${entryLabel}" edit link was copied to the clipboard.`,
        });
      } catch {
        showToast({
          variant: "error",
          title: "Could not copy link",
          description: mutationErrorDescription,
        });
      }
    },
    [resolvedWorkspaceSlug, showToast, visibleItems],
  );

  const confirmDelete = useCallback(async () => {
    if (
      !pendingDeleteEntryId ||
      pendingDeleteIds[pendingDeleteEntryId] ||
      !apiBaseUrl ||
      !currentWorkspace?.id ||
      !accessToken
    ) {
      return;
    }

    const entryId = pendingDeleteEntryId;
    const entryLabel = pendingDeleteEntryLabel || "This content";
    setPendingDeleteIds((prev) => ({ ...prev, [entryId]: true }));

    try {
      await deleteWorkspaceContentEntry({
        apiBaseUrl,
        workspaceId: currentWorkspace.id,
        entryId,
        accessToken,
      });
      setDeletedEntryIds((prev) => ({ ...prev, [entryId]: true }));
      setPendingDeleteEntryId(null);
      setPendingDeleteEntryLabel("");
      showToast({
        variant: "success",
        title: "Content deleted",
        description: `"${entryLabel}" was deleted.`,
      });
    } catch {
      showMutationError("Could not delete content");
    } finally {
      setPendingDeleteIds((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    }
  }, [
    accessToken,
    apiBaseUrl,
    currentWorkspace?.id,
    pendingDeleteEntryId,
    pendingDeleteEntryLabel,
    pendingDeleteIds,
    showToast,
    showMutationError,
  ]);

  const handleDelete = useCallback(
    async (entryId: string) => {
      if (
        pendingDeleteIds[entryId] ||
        !apiBaseUrl ||
        !currentWorkspace?.id ||
        !accessToken
      ) {
        return;
      }

      const targetEntry = visibleItems.find((item) => item.id === entryId);
      const entryLabel = targetEntry?.title?.trim() || "this content";
      setPendingDeleteEntryId(entryId);
      setPendingDeleteEntryLabel(entryLabel);
    },
    [
      accessToken,
      apiBaseUrl,
      currentWorkspace?.id,
      pendingDeleteIds,
      visibleItems,
    ],
  );

  const handleToggleFavorite = useCallback(
    async (entryId: string) => {
      if (
        pendingFavoriteIds[entryId] ||
        !apiBaseUrl ||
        !currentWorkspace?.id ||
        !accessToken
      ) {
        return;
      }

      const targetEntry = visibleItems.find((item) => item.id === entryId);
      if (!targetEntry) {
        return;
      }

      const previousFavorite = targetEntry.isFavorite;

      setFavoriteOverrides((prev) => ({
        ...prev,
        [entryId]: !previousFavorite,
      }));
      setPendingFavoriteIds((prev) => ({ ...prev, [entryId]: true }));

      try {
        const result = await toggleWorkspaceEntryFavorite({
          apiBaseUrl,
          workspaceId: currentWorkspace.id,
          entryId,
          accessToken,
        });
        setFavoriteOverrides((prev) => ({
          ...prev,
          [entryId]: result.isFavorite,
        }));
      } catch {
        setFavoriteOverrides((prev) => ({
          ...prev,
          [entryId]: previousFavorite,
        }));
        showMutationError("Could not update favourite");
      } finally {
        setPendingFavoriteIds((prev) => {
          const next = { ...prev };
          delete next[entryId];
          return next;
        });
      }
    },
    [
      accessToken,
      apiBaseUrl,
      currentWorkspace?.id,
      pendingFavoriteIds,
      showMutationError,
      visibleItems,
    ],
  );

  const listHandlers = useMemo(
    () => ({
      onOpen: handleOpen,
      onDelete: handleDelete,
      onShare: handleShare,
      onToggleFavorite: handleToggleFavorite,
    }),
    [handleDelete, handleOpen, handleShare, handleToggleFavorite],
  );

  const listViewState = resolveCmsContentListState({
    isLoading: effectiveIsLoading,
    error,
    count: visibleCount,
    query: state.query,
    breadcrumbParts,
    favoritesOnly: state.favoritesOnly,
    copy: {
      loadingTitle: t("state.loadingTitle"),
      loadingDescription: t("state.loadingDescription"),
      errorTitle: t("state.errorTitle"),
      errorDescription: t("state.errorDescription"),
      retryLabel: t("state.retry"),
      retryAriaLabel: t("state.retryAriaLabel"),
      searchEmptyTitle: t("state.searchEmptyTitle"),
      searchEmptyDescription: t("state.searchEmptyDescription"),
      directoryEmptyTitle: t("state.directoryEmptyTitle"),
      directoryEmptyDescription: t("state.directoryEmptyDescription"),
      rootEmptyTitle: t("state.rootEmptyTitle"),
      rootEmptyDescription: t("state.rootEmptyDescription"),
      favoritesEmptyTitle: t("state.favoritesEmptyTitle"),
      favoritesEmptyDescription: t("state.favoritesEmptyDescription"),
    },
  });
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const secondaryToolbarRowRef = useRef<HTMLDivElement | null>(null);
  const {
    isSecondaryToolbarVisible,
    secondaryToolbarContainerStyle,
    handleResultsScroll,
  } = useCmsContentToolbarScrollStack({
    resetKeys: [
      pathname,
      listViewState.kind,
      state.view,
      state.query,
      state.sortBy,
      state.followingOnly,
      state.favoritesOnly,
    ],
    secondaryToolbarRowRef,
  });

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Content list panel"
    >
      <ConfirmDialog
        open={Boolean(pendingDeleteEntryId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingDeleteEntryId(null);
            setPendingDeleteEntryLabel("");
          }
        }}
        title={`Delete "${pendingDeleteEntryLabel || "this content"}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete content"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDelete}
      />
      <div
        data-testid="content-toolbar-stack"
        className="shrink-0 bg-background"
      >
        <CmsContentToolbar
          breadcrumbItems={breadcrumbItems}
          itemCount={visibleCount}
          query={isQueryEditing ? queryDraft : state.query}
          sortBy={state.sortBy}
          view={state.view}
          followingOnly={state.followingOnly}
          favoritesOnly={state.favoritesOnly}
          secondaryRowHidden={!isSecondaryToolbarVisible}
          secondaryRowRef={secondaryToolbarRowRef}
          secondaryRowContainerClassName={cx(
            "transition-[max-height,border-color] duration-200 ease-out",
            isSecondaryToolbarVisible
              ? "border-b border-border"
              : "border-b border-transparent",
          )}
          secondaryRowContainerStyle={secondaryToolbarContainerStyle}
          onCreate={() => {
            setCreateError(null);

            if (isCreatingEntry) {
              return;
            }

            if (isDirectoryResolving || isUnmatchedDirectoryPath) {
              // Resolution is in flight — using resolvedDirectoryId here would
              // create the entry in the wrong (stale/unmatched) directory. Block until done.
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
      </div>

      <div
        ref={resultsScrollRef}
        role="region"
        aria-label="Content results"
        tabIndex={0}
        data-testid="content-results-scroll-region"
        className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
        onScroll={handleResultsScroll}
      >
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
          <div data-testid="content-results-ready" className="px-4 py-4">
            <ul
              aria-label="Content entries"
              className={
                state.view === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                  : "grid grid-cols-1 gap-3"
              }
            >
              {visibleItems.map((item) => (
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
                        isDeleting: Boolean(pendingDeleteIds[item.id]),
                        isFavoritePending: Boolean(pendingFavoriteIds[item.id]),
                      })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
