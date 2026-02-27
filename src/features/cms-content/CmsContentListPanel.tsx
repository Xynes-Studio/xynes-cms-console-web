"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { BreadcrumbItem } from "@lumia-ui/components";
import { Card } from "@lumia-ui/components";
import { useCmsContentQueryState } from "../../lib/dashboard/use-cms-content-query-state";
import { CmsContentToolbar } from "../../components/dashboard/CmsContentToolbar";

const QUERY_REPLACE_DEBOUNCE_MS = 300;

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
  const { state, setState } = useCmsContentQueryState();
  const [queryDraft, setQueryDraft] = useState(state.query);
  const [isQueryEditing, setIsQueryEditing] = useState(false);

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

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Content list panel"
    >
      <CmsContentToolbar
        breadcrumbItems={breadcrumbItems}
        itemCount={0}
        query={isQueryEditing ? queryDraft : state.query}
        sortBy={state.sortBy}
        view={state.view}
        followingOnly={state.followingOnly}
        favoritesOnly={state.favoritesOnly}
        onCreate={() => {
          return;
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

      <Card className="m-4 flex min-h-[280px] items-center justify-center border border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Content entries will appear here.
        </p>
      </Card>
    </section>
  );
}
