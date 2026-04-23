"use client";

import { useMemo, useRef, useState } from "react";
import {
  DashboardShell,
  type DashboardDirectorySection,
  type DashboardNavItem,
  type DashboardWorkspace,
} from "@lumia-ui/layout";
import { CmsContentCardGrid } from "../../components/dashboard/CmsContentCardGrid";
import {
  CmsContentToolbar,
  type CmsContentSortBy,
  type CmsContentView,
} from "../../components/dashboard/CmsContentToolbar";
import { CmsContentCardList } from "../../components/dashboard/CmsContentCardList";
import {
  CmsContentListState,
  resolveCmsContentListState,
} from "./CmsContentListState";
import { useCmsContentToolbarScrollStack } from "./useCmsContentToolbarScrollStack";

type FixtureMode = "populated" | "empty";

type FixtureEntry = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  ownerName: string | null;
  createdAt: string;
  avatarUrl: string | null;
  collaborators: string[];
  isFavorite: boolean;
};

const navItems: DashboardNavItem[] = [
  {
    id: "contents",
    label: "Contents",
    href: "/dashboard/xynes-studio-llp/content",
    icon: "file-text",
  },
  {
    id: "plugins",
    label: "Plugins",
    href: "/dashboard/xynes-studio-llp/plugins",
    icon: "box",
  },
  {
    id: "access-control",
    label: "Access Control",
    href: "/dashboard/xynes-studio-llp/access-control",
    icon: "shield",
  },
  {
    id: "integrations",
    label: "Integrations",
    href: "/dashboard/xynes-studio-llp/integrations",
    icon: "link",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/xynes-studio-llp/settings",
    icon: "settings",
  },
];

const workspace: DashboardWorkspace = {
  id: "workspace-1",
  name: "Xynes Studio LLP",
  slug: "xynes-studio-llp",
  roleLabel: "Workspace owner",
};

const buildFixtureEntries = (): FixtureEntry[] =>
  Array.from({ length: 18 }, (_, index) => ({
    id: `fixture-entry-${index + 1}`,
    title: `Fixture entry ${index + 1}`,
    description:
      "A deterministic content card used to verify sticky toolbar behavior and scroll containment in Playwright.",
    status: index % 3 === 0 ? "draft" : "published",
    ownerName: "Fixture owner",
    createdAt: "2026-03-02T10:00:00.000Z",
    avatarUrl: null,
    collaborators: ["Design", "Content", "Platform"],
    isFavorite: index % 4 === 0,
  }));

const buildDirectorySection = (): DashboardDirectorySection => {
  const nodes = Array.from({ length: 16 }, (_, index) => ({
    id: `fixture-directory-${index + 1}`,
    label: `Category ${index + 1}`,
    href: `/dashboard/xynes-studio-llp/content/category-${index + 1}`,
    children:
      index % 2 === 0
        ? [
            {
              id: `fixture-directory-${index + 1}-child-a`,
              label: `Subcategory ${index + 1}.1`,
              href: `/dashboard/xynes-studio-llp/content/category-${index + 1}/subcategory-1`,
            },
            {
              id: `fixture-directory-${index + 1}-child-b`,
              label: `Subcategory ${index + 1}.2`,
              href: `/dashboard/xynes-studio-llp/content/category-${index + 1}/subcategory-2`,
            },
          ]
        : [],
  }));

  return {
    navItemId: "contents",
    rootHref: "/dashboard/xynes-studio-llp/content",
    rootLabel: "Contents",
    rootIcon: "file-text",
    activeHref: "/dashboard/xynes-studio-llp/content",
    nodes,
    expandedIds: nodes
      .filter((node) => (node.children?.length ?? 0) > 0)
      .map((node) => node.id),
    onExpandedIdsChange: () => undefined,
    onCreateDirectory: () => undefined,
  };
};

export function CmsContentScrollLayoutFixture({
  mode,
}: {
  mode: FixtureMode;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<CmsContentSortBy>("date");
  const [view, setView] = useState<CmsContentView>("list");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>(
    buildDirectorySection().expandedIds,
  );

  const allEntries = useMemo(() => buildFixtureEntries(), []);
  const visibleEntries = useMemo(() => {
    let next = [...allEntries];

    if (favoritesOnly) {
      next = next.filter((entry) => entry.isFavorite);
    }

    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      next = next.filter(
        (entry) =>
          entry.title.toLowerCase().includes(normalizedQuery) ||
          entry.description.toLowerCase().includes(normalizedQuery),
      );
    }

    return mode === "empty" ? [] : next;
  }, [allEntries, favoritesOnly, mode, searchQuery]);

  const listViewState = resolveCmsContentListState({
    isLoading: false,
    error: null,
    count: visibleEntries.length,
    query: searchQuery,
    breadcrumbParts: [],
  });

  const directorySection = useMemo(() => {
    const base = buildDirectorySection();
    return {
      ...base,
      expandedIds,
      onExpandedIdsChange: setExpandedIds,
    };
  }, [expandedIds]);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const secondaryToolbarRowRef = useRef<HTMLDivElement | null>(null);

  const {
    isSecondaryToolbarVisible,
    secondaryToolbarContainerStyle,
    handleResultsScroll,
  } = useCmsContentToolbarScrollStack({
    resetKeys: [
      mode,
      searchQuery,
      view,
      sortBy,
      followingOnly,
      favoritesOnly,
      listViewState.kind,
    ],
    secondaryToolbarRowRef,
  });

  return (
    <DashboardShell
      activePath="/dashboard/xynes-studio-llp/content"
      navItems={navItems}
      workspace={workspace}
      workspaceOptions={[workspace]}
      onWorkspaceSelect={() => undefined}
      userMenu={{ name: "Fixture User", email: "fixture@xynes.com" }}
      onLogout={() => undefined}
      directorySection={directorySection}
    >
      <section
        data-testid="cms-dashboard-scroll-fixture"
        aria-label="Content list panel"
        className="flex h-full min-h-0 flex-col overflow-hidden"
      >
        <div data-testid="content-toolbar-stack" className="shrink-0 bg-background">
          <CmsContentToolbar
            breadcrumbItems={[{ label: "Contents", onClick: () => undefined }]}
            itemCount={visibleEntries.length}
            query={query}
            sortBy={sortBy}
            view={view}
            followingOnly={followingOnly}
            favoritesOnly={favoritesOnly}
            secondaryRowHidden={!isSecondaryToolbarVisible}
            secondaryRowRef={secondaryToolbarRowRef}
            secondaryRowContainerClassName={
              isSecondaryToolbarVisible
                ? "border-b border-border transition-[max-height,border-color] duration-200 ease-out"
                : "border-b border-transparent transition-[max-height,border-color] duration-200 ease-out"
            }
            secondaryRowContainerStyle={secondaryToolbarContainerStyle}
            onCreate={() => undefined}
            onQueryChange={setQuery}
            onSearchSubmit={() => {
              setSearchQuery(query.trim());
            }}
            onSortChange={setSortBy}
            onViewChange={setView}
            onFollowingToggle={() => {
              setFollowingOnly((current) => !current);
            }}
            onFavoritesToggle={() => {
              setFavoritesOnly((current) => !current);
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
          <CmsContentListState
            state={listViewState}
            onRetry={() => undefined}
          />

          {listViewState.kind === "ready" ? (
            <div data-testid="content-results-ready" className="px-4 py-4">
              <ul
                aria-label="Content entries"
                className={
                  view === "grid"
                    ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                    : "grid grid-cols-1 gap-3"
                }
              >
                {visibleEntries.map((entry) => (
                  <li key={entry.id}>
                    {view === "grid" ? (
                      <CmsContentCardGrid
                        entryId={entry.id}
                        title={entry.title}
                        description={entry.description}
                        ownerName={entry.ownerName}
                        createdAt={entry.createdAt}
                        avatarUrl={entry.avatarUrl}
                        status={entry.status}
                        onOpen={() => undefined}
                      />
                    ) : (
                      <CmsContentCardList
                        entryId={entry.id}
                        title={entry.title}
                        description={entry.description}
                        ownerName={entry.ownerName}
                        createdAt={entry.createdAt}
                        avatarUrl={entry.avatarUrl}
                        status={entry.status}
                        collaborators={entry.collaborators}
                        isFavorite={entry.isFavorite}
                        onOpen={() => undefined}
                        onDelete={() => undefined}
                        onShare={() => undefined}
                        onToggleFavorite={() => undefined}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
