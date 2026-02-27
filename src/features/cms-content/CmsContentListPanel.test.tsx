import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsContentListPanel } from "./CmsContentListPanel";

const push = vi.fn();
const setState = vi.fn();
const refreshEntries = vi.fn();
const mockGetAccessToken = vi.fn();
const renderGridItem = vi.fn();
const renderListItem = vi.fn();
let mockedPathname = "/dashboard/xynes-studio-llp/content/level-1-2/level-2";
let mockedQueryState = {
  query: "",
  sortBy: "date",
  sortDirection: "desc",
  view: "list",
  followingOnly: false,
  favoritesOnly: false,
  status: "all",
  directoryId: null,
  limit: 20,
  offset: 0,
};
let mockedEntriesState = {
  items: [] as Array<{
    id: string;
    title: string;
    description: string;
    status: "draft" | "published" | "archived";
    ownerName: string | null;
    isFavorite: boolean;
  }>,
  count: 0,
  isLoading: false,
  error: null as Error | null,
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({ push }),
}));

vi.mock("../../lib/dashboard/use-cms-content-query-state", () => ({
  useCmsContentQueryState: () => ({
    state: mockedQueryState,
    setState,
  }),
}));

vi.mock("../../lib/dashboard/use-cms-content-entries", () => ({
  useCmsContentEntries: () => ({
    ...mockedEntriesState,
    refresh: refreshEntries,
  }),
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    getAccessToken: mockGetAccessToken,
  }),
  useWorkspace: () => ({
    currentWorkspace: {
      id: "workspace-1",
      slug: "xynes-studio-llp",
    },
  }),
}));

vi.mock("../../components/dashboard/CmsContentToolbar", () => ({
  CmsContentToolbar: ({
    breadcrumbItems,
    itemCount,
    onSearchSubmit,
    onCreate,
    onQueryChange,
    onSortChange,
    onViewChange,
    onFollowingToggle,
    onFavoritesToggle,
    query,
    sortBy,
    view,
    followingOnly,
    favoritesOnly,
  }: {
    breadcrumbItems: Array<{ label: string; onClick?: () => void }>;
    itemCount: number;
    onSearchSubmit: () => void;
    onCreate: () => void;
    onQueryChange: (value: string) => void;
    onSortChange: (value: "date" | "title" | "popularity") => void;
    onViewChange: (value: "grid" | "list") => void;
    onFollowingToggle: () => void;
    onFavoritesToggle: () => void;
    query: string;
    sortBy: string;
    view: string;
    followingOnly: boolean;
    favoritesOnly: boolean;
  }) => (
    <section data-testid="toolbar">
      <span>{breadcrumbItems.map((item) => item.label).join(" / ")}</span>
      <span data-testid="toolbar-count">{itemCount} Items</span>
      <span data-testid="toolbar-state">
        {`${query}|${sortBy}|${view}|${followingOnly}|${favoritesOnly}`}
      </span>
      <button
        type="button"
        onClick={() => onQueryChange("updated query")}
        aria-label="update query"
      >
        update query
      </button>
      <button
        type="button"
        onClick={() => breadcrumbItems[0]?.onClick?.()}
        aria-label="open root breadcrumb"
      >
        open root breadcrumb
      </button>
      <button type="button" onClick={onCreate} aria-label="create content">
        create
      </button>
      <button
        type="button"
        onClick={onSearchSubmit}
        aria-label="search contents"
      >
        search
      </button>
      <button
        type="button"
        onClick={() => onSortChange("title")}
        aria-label="change sort"
      >
        change sort
      </button>
      <button
        type="button"
        onClick={() => onViewChange("grid")}
        aria-label="change view"
      >
        change view
      </button>
      <button
        type="button"
        onClick={onFollowingToggle}
        aria-label="toggle following"
      >
        toggle following
      </button>
      <button
        type="button"
        onClick={onFavoritesToggle}
        aria-label="toggle favorites"
      >
        toggle favorites
      </button>
    </section>
  ),
}));

vi.mock("../../components/dashboard/CmsContentCardGrid", () => ({
  CmsContentCardGrid: (props: { entryId: string; title: string }) => {
    renderGridItem(props);
    return (
      <article data-testid={`grid-card-${props.entryId}`}>
        {props.title}
      </article>
    );
  },
}));

vi.mock("../../components/dashboard/CmsContentCardList", () => ({
  CmsContentCardList: (props: { entryId: string; title: string }) => {
    renderListItem(props);
    return (
      <article data-testid={`list-card-${props.entryId}`}>
        {props.title}
      </article>
    );
  },
}));

vi.mock("@lumia-ui/components", () => ({
  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  push.mockReset();
  setState.mockReset();
  refreshEntries.mockReset();
  mockGetAccessToken.mockReset();
  renderGridItem.mockReset();
  renderListItem.mockReset();
  mockGetAccessToken.mockResolvedValue("jwt-token");
  mockedPathname = "/dashboard/xynes-studio-llp/content/level-1-2/level-2";
  mockedQueryState = {
    query: "",
    sortBy: "date",
    sortDirection: "desc",
    view: "list",
    followingOnly: false,
    favoritesOnly: false,
    status: "all",
    directoryId: null,
    limit: 20,
    offset: 0,
  };
  mockedEntriesState = {
    items: [],
    count: 0,
    isLoading: false,
    error: null,
  };
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe("CmsContentListPanel", () => {
  it("renders toolbar with breadcrumb label and contextual empty state", () => {
    render(<CmsContentListPanel />);

    expect(
      screen.getByText("Contents / level-1-2 / level-2"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Content list panel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This directory is empty")).toBeInTheDocument();
  });

  it("keeps toolbar interactions accessible and stable", () => {
    render(<CmsContentListPanel />);

    fireEvent.click(screen.getByRole("button", { name: "create content" }));
    fireEvent.click(screen.getByRole("button", { name: "search contents" }));

    expect(
      screen.getByRole("region", { name: "Content list panel" }),
    ).toBeInTheDocument();
    expect(setState).toHaveBeenCalledWith({ query: "", offset: 0 });
  });

  it("uses last content segment for breadcrumb derivation", () => {
    mockedPathname = "/dashboard/content/content/level-2";

    render(<CmsContentListPanel />);

    expect(screen.getByText("Contents / level-2")).toBeInTheDocument();
  });

  it("wires query-state values into toolbar props", () => {
    mockedQueryState = {
      ...mockedQueryState,
      query: "alpha",
      sortBy: "title",
      view: "grid",
      followingOnly: true,
      favoritesOnly: true,
    };

    render(<CmsContentListPanel />);

    expect(screen.getByTestId("toolbar-state")).toHaveTextContent(
      "alpha|title|grid|true|true",
    );
  });

  it("maps toolbar events to query-state updates", () => {
    render(<CmsContentListPanel />);

    fireEvent.click(screen.getByRole("button", { name: "update query" }));
    fireEvent.click(screen.getByRole("button", { name: "search contents" }));
    fireEvent.click(screen.getByRole("button", { name: "change sort" }));
    fireEvent.click(screen.getByRole("button", { name: "change view" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle following" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle favorites" }));

    expect(setState).toHaveBeenCalledWith({
      query: "updated query",
      offset: 0,
    });
    expect(setState).toHaveBeenCalledWith({ sortBy: "title", offset: 0 });
    expect(setState).toHaveBeenCalledWith({ view: "grid" });
    expect(setState).toHaveBeenCalledWith({ followingOnly: true, offset: 0 });
    expect(setState).toHaveBeenCalledWith({ favoritesOnly: true, offset: 0 });
  });

  it("debounces query typing and uses replace navigation", () => {
    render(<CmsContentListPanel />);

    fireEvent.click(screen.getByRole("button", { name: "update query" }));

    expect(setState).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);

    expect(setState).toHaveBeenCalledWith(
      { query: "updated query", offset: 0 },
      { navigation: "replace" },
    );
  });

  it("falls back to dashboard root path when content segment is absent", () => {
    mockedPathname = "/dashboard/xynes-studio-llp/plugins";

    render(<CmsContentListPanel />);

    expect(screen.getByText("Contents")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "open root breadcrumb" }),
    );
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("does not throw on malformed encoded path segments", () => {
    mockedPathname = "/dashboard/xynes-studio-llp/content/%E0%A4%A";

    expect(() => render(<CmsContentListPanel />)).not.toThrow();
    expect(screen.getByText("Contents / %E0%A4%A")).toBeInTheDocument();
  });

  it("renders loading state while entries are being fetched", () => {
    mockedEntriesState = {
      ...mockedEntriesState,
      isLoading: true,
    };

    render(<CmsContentListPanel />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading content entries",
    );
  });

  it("renders error panel and retries when requested", () => {
    mockedEntriesState = {
      ...mockedEntriesState,
      error: new Error("network error"),
    };

    render(<CmsContentListPanel />);

    expect(
      screen.getByText("Unable to load content entries"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(refreshEntries).toHaveBeenCalledTimes(1);
  });

  it("renders search-empty copy when query has no results", () => {
    mockedQueryState = {
      ...mockedQueryState,
      query: "nonexistent",
    };

    render(<CmsContentListPanel />);

    expect(
      screen.getByText("No content matched your search"),
    ).toBeInTheDocument();
  });

  it("renders fetched entries and item count", () => {
    mockedEntriesState = {
      items: [
        {
          id: "entry-1",
          title: "About us",
          description: "draft document",
          status: "draft",
          ownerName: "Owner",
          isFavorite: false,
        },
        {
          id: "entry-2",
          title: "Contact",
          description: "published document",
          status: "published",
          ownerName: null,
          isFavorite: true,
        },
      ],
      count: 2,
      isLoading: false,
      error: null,
    };

    render(<CmsContentListPanel />);

    expect(screen.getByText("About us")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("2 Items")).toBeInTheDocument();
  });

  it("renders list cards in single-column layout when view=list", () => {
    mockedQueryState = {
      ...mockedQueryState,
      view: "list",
    };
    mockedEntriesState = {
      ...mockedEntriesState,
      items: [
        {
          id: "entry-list-1",
          title: "List article",
          description: "list mode",
          status: "draft",
          ownerName: "Owner",
          isFavorite: true,
        },
      ],
      count: 1,
    };

    render(<CmsContentListPanel />);

    const listContainer = screen.getByRole("list", { name: "Content entries" });
    expect(listContainer.className).toContain("grid-cols-1");
    expect(screen.getByTestId("list-card-entry-list-1")).toBeInTheDocument();
    expect(
      screen.queryByTestId("grid-card-entry-list-1"),
    ).not.toBeInTheDocument();
    expect(renderListItem).toHaveBeenCalledTimes(1);
    expect(renderGridItem).not.toHaveBeenCalled();
  });

  it("renders grid cards with responsive 1/2/3 columns when view=grid", () => {
    mockedQueryState = {
      ...mockedQueryState,
      view: "grid",
    };
    mockedEntriesState = {
      ...mockedEntriesState,
      items: [
        {
          id: "entry-grid-1",
          title: "Grid article",
          description: "grid mode",
          status: "published",
          ownerName: "Owner",
          isFavorite: false,
        },
      ],
      count: 1,
    };

    render(<CmsContentListPanel />);

    const gridContainer = screen.getByRole("list", { name: "Content entries" });
    expect(gridContainer.className).toContain("grid-cols-1");
    expect(gridContainer.className).toContain("md:grid-cols-2");
    expect(gridContainer.className).toContain("xl:grid-cols-3");
    expect(screen.getByTestId("grid-card-entry-grid-1")).toBeInTheDocument();
    expect(
      screen.queryByTestId("list-card-entry-grid-1"),
    ).not.toBeInTheDocument();
    expect(renderGridItem).toHaveBeenCalledTimes(1);
    expect(renderListItem).not.toHaveBeenCalled();
  });
});
