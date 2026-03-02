"use client";

import { useEffect, useState } from "react";
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
import {
  createDraftEntryAndResolveEditPath,
  getCreateEntryErrorMessage,
} from "./CmsContentActions";
import { mapEntryToGridCardProps, mapEntryToListCardProps } from "./mappers";

const QUERY_REPLACE_DEBOUNCE_MS = 300;
const noopEntryAction: (entryId: string) => void = () => {
  return;
};
const noopListHandlers = {
  onOpen: noopEntryAction,
  onDelete: noopEntryAction,
  onShare: noopEntryAction,
  onToggleFavorite: noopEntryAction,
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
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

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

  const pathParts = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => safeDecodePathSegment(segment));
  const contentIndex = pathParts.lastIndexOf("content");
  const breadcrumbParts =
    contentIndex >= 0 ? pathParts.slice(contentIndex + 1) : [];
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

  const { items, count, isLoading, error, refresh } = useCmsContentEntries({
    apiBaseUrl,
    workspaceId: currentWorkspace?.id ?? "",
    accessToken: accessToken ?? "",
    query: {
      directoryId: state.directoryId,
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
      Boolean(apiBaseUrl),
  });

  const listViewState = resolveCmsContentListState({
    isLoading,
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

          if (!currentWorkspace?.id || !accessToken || !resolvedWorkspaceSlug) {
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
                directoryId: state.directoryId,
              });

              router.push(editPath);
            } catch (error) {
              const message = getCreateEntryErrorMessage(error);
              console.error("[CMS][create] toolbar flow failed", {
                workspaceId: currentWorkspace.id,
                workspaceSlug: resolvedWorkspaceSlug,
                directoryId: state.directoryId,
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
                      onOpen: noopEntryAction,
                    })}
                  />
                ) : (
                  <CmsContentCardList
                    {...mapEntryToListCardProps({
                      entry: item,
                      handlers: noopListHandlers,
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
