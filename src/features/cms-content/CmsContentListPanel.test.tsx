import type React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsContentListPanel } from "./CmsContentListPanel";

const {
  mockCreateDraftEntryAndResolveEditPath,
  mockGetCreateEntryErrorMessage,
  mockListWorkspaceContentDirectories,
  mockUseCmsContentEntries,
  mockBuildContentEntryEditRoute,
} = vi.hoisted(() => ({
  mockCreateDraftEntryAndResolveEditPath: vi.fn(),
  mockGetCreateEntryErrorMessage: vi.fn(),
  mockListWorkspaceContentDirectories: vi.fn(),
  mockUseCmsContentEntries: vi.fn(),
  mockBuildContentEntryEditRoute: vi.fn(
    ({ workspaceSlug, entryId }: { workspaceSlug: string; entryId: string }) =>
      `/dashboard/${encodeURIComponent(workspaceSlug)}/content/entry/${encodeURIComponent(entryId)}/edit`,
  ),
}));

const push = vi.fn();
const setState = vi.fn();
const refreshEntries = vi.fn();
const replace = vi.fn();
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
let mockedWorkspace: { id: string; slug: string } | null = {
  id: "workspace-1",
  slug: "xynes-studio-llp",
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
  useRouter: () => ({ push, replace }),
}));

vi.mock("../../lib/dashboard/content-directories-client", () => ({
  listWorkspaceContentDirectories: mockListWorkspaceContentDirectories,
}));

vi.mock("./CmsContentActions", () => ({
  createDraftEntryAndResolveEditPath: mockCreateDraftEntryAndResolveEditPath,
  getCreateEntryErrorMessage: mockGetCreateEntryErrorMessage,
  buildContentEntryEditRoute: (args: { workspaceSlug: string; entryId: string }) =>
    mockBuildContentEntryEditRoute(args),
}));

vi.mock("../../lib/dashboard/use-cms-content-query-state", () => ({
  useCmsContentQueryState: () => ({
    state: mockedQueryState,
    setState,
  }),
}));

vi.mock("../../lib/dashboard/use-cms-content-entries", () => ({
  useCmsContentEntries: (args: unknown) => {
    mockUseCmsContentEntries(args);
    return { ...mockedEntriesState, refresh: refreshEntries };
  },
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    getAccessToken: mockGetAccessToken,
  }),
  useWorkspace: () => ({
    currentWorkspace: mockedWorkspace,
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
  CmsContentCardGrid: (props: {
    entryId: string;
    title: string;
    onOpen?: (id: string) => void;
  }) => {
    renderGridItem(props);
    return (
      <article data-testid={`grid-card-${props.entryId}`}>
        {props.title}
        {props.onOpen ? (
          <button
            data-testid={`grid-open-${props.entryId}`}
            onClick={() => props.onOpen!(props.entryId)}
          >
            Open
          </button>
        ) : null}
      </article>
    );
  },
}));

vi.mock("../../components/dashboard/CmsContentCardList", () => ({
  CmsContentCardList: (props: {
    entryId: string;
    title: string;
    onOpen?: (id: string) => void;
    onShare?: (id: string) => void;
    onDelete?: (id: string) => void;
    onToggleFavorite?: (id: string) => void;
  }) => {
    renderListItem(props);
    return (
      <article data-testid={`list-card-${props.entryId}`}>
        {props.title}
        {props.onOpen ? (
          <button
            data-testid={`list-open-${props.entryId}`}
            onClick={() => props.onOpen!(props.entryId)}
          >
            Open
          </button>
        ) : null}
        {props.onShare ? (
          <button
            data-testid={`list-share-${props.entryId}`}
            onClick={() => props.onShare!(props.entryId)}
          >
            Share
          </button>
        ) : null}
        {props.onDelete ? (
          <button
            data-testid={`list-delete-${props.entryId}`}
            onClick={() => props.onDelete!(props.entryId)}
          >
            Delete
          </button>
        ) : null}
        {props.onToggleFavorite ? (
          <button
            data-testid={`list-favorite-${props.entryId}`}
            onClick={() => props.onToggleFavorite!(props.entryId)}
          >
            Favorite
          </button>
        ) : null}
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
  Alert: ({
    title,
    description,
    closable: _closable,
    onClose: _onClose,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
    description?: string;
    closable?: boolean;
    onClose?: () => void;
  }) => {
    void _closable;
    void _onClose;

    return (
      <div {...props}>
        {title ? <p>{title}</p> : null}
        {description ? <p>{description}</p> : null}
      </div>
    );
  },
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

const mockClipboardWrite = vi.fn();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  push.mockReset();
  replace.mockReset();
  setState.mockReset();
  refreshEntries.mockReset();
  mockGetAccessToken.mockReset();
  renderGridItem.mockReset();
  renderListItem.mockReset();
  mockCreateDraftEntryAndResolveEditPath.mockReset();
  mockGetCreateEntryErrorMessage.mockReset();
  mockListWorkspaceContentDirectories.mockReset();
  mockUseCmsContentEntries.mockReset();
  mockClipboardWrite.mockReset();
  // Defaults
  mockedWorkspace = { id: "workspace-1", slug: "xynes-studio-llp" };
  mockGetAccessToken.mockResolvedValue("jwt-token");
  mockCreateDraftEntryAndResolveEditPath.mockResolvedValue(
    "/dashboard/xynes-studio-llp/content/entry/entry-new/edit",
  );
  mockBuildContentEntryEditRoute.mockReset();
  mockBuildContentEntryEditRoute.mockImplementation(
    ({ workspaceSlug, entryId }: { workspaceSlug: string; entryId: string }) =>
      `/dashboard/${encodeURIComponent(workspaceSlug)}/content/entry/${encodeURIComponent(entryId)}/edit`,
  );
  // Default: empty directory list → resolvedDirectoryId = null (no filter)
  mockListWorkspaceContentDirectories.mockResolvedValue([]);
  mockGetCreateEntryErrorMessage.mockReturnValue(
    "Content entry create route is not configured in backend yet. Please contact platform team to map /content/entries to directory-based cms.entry.* actions.",
  );
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
  // Provide clipboard stub so handleShare can call navigator.clipboard.writeText
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockClipboardWrite },
    writable: true,
    configurable: true,
  });
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

  it("creates an entry using the resolved directory UUID from the current path", async () => {
    vi.useRealTimers();
    // Provide a directory tree where the default pathname level-1-2/level-2 resolves.
    mockListWorkspaceContentDirectories.mockResolvedValue([
      {
        id: "dir-parent",
        parentId: null,
        name: "level-1-2",
        pathSegment: "level-1-2",
      },
      {
        id: "dir-leaf",
        parentId: "dir-parent",
        name: "level-2",
        pathSegment: "level-2",
      },
    ]);

    render(<CmsContentListPanel />);

    // Wait for token + directory resolution to complete
    await waitFor(() =>
      expect(mockListWorkspaceContentDirectories).toHaveBeenCalled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "create content" }));

    await waitFor(() => {
      expect(mockCreateDraftEntryAndResolveEditPath).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          workspaceSlug: "xynes-studio-llp",
          accessToken: "jwt-token",
          // Uses the UUID resolved from path segments, not a query-param directoryId.
          directoryId: "dir-leaf",
          apiBaseUrl: expect.any(String),
        }),
      );
      expect(push).toHaveBeenCalledWith(
        "/dashboard/xynes-studio-llp/content/entry/entry-new/edit",
      );
    });
  });

  it("shows an accessible inline error alert when create fails", async () => {
    vi.useRealTimers();
    mockCreateDraftEntryAndResolveEditPath.mockRejectedValueOnce(
      new Error("DIRECTORY_ROUTE_SEGMENT_NOT_FOUND"),
    );

    render(<CmsContentListPanel />);

    await waitFor(() => {
      expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "create content" }));

    await waitFor(() => {
      expect(screen.getByText("Unable to create content")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Content entry create route is not configured in backend yet. Please contact platform team to map /content/entries to directory-based cms.entry.* actions.",
        ),
      ).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
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

  // ─── card open action ──────────────────────────────────────────────────────

  describe("card open action", () => {
    beforeEach(() => {
      vi.useRealTimers();
      mockedEntriesState = {
        ...mockedEntriesState,
        items: [
          {
            id: "entry-open-1",
            title: "Open Me",
            description: "",
            status: "draft",
            ownerName: null,
            isFavorite: false,
          },
        ],
        count: 1,
      };
    });

    it("navigates to the editor route when a list-card Open button is clicked", async () => {
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("list-open-entry-open-1");
      fireEvent.click(btn);
      expect(push).toHaveBeenCalledWith(
        "/dashboard/xynes-studio-llp/content/entry/entry-open-1/edit",
      );
    });

    it("navigates to the editor route when a grid-card Open button is clicked", async () => {
      mockedQueryState = { ...mockedQueryState, view: "grid" };
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("grid-open-entry-open-1");
      fireEvent.click(btn);
      expect(push).toHaveBeenCalledWith(
        "/dashboard/xynes-studio-llp/content/entry/entry-open-1/edit",
      );
    });
  });

  // ─── card share action ─────────────────────────────────────────────────────

  describe("card share action", () => {
    beforeEach(() => {
      vi.useRealTimers();
      mockedEntriesState = {
        ...mockedEntriesState,
        items: [
          {
            id: "entry-share-1",
            title: "Share Me",
            description: "",
            status: "draft",
            ownerName: null,
            isFavorite: false,
          },
        ],
        count: 1,
      };
    });

    it("copies the entry edit URL to the clipboard when Share is clicked", async () => {
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("list-share-entry-share-1");
      fireEvent.click(btn);
      expect(mockClipboardWrite).toHaveBeenCalledWith(
        expect.stringContaining(
          "/dashboard/xynes-studio-llp/content/entry/entry-share-1/edit",
        ),
      );
    });
  });

  // ─── directory filtering ───────────────────────────────────────────────────

  describe("directory filtering", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it("passes the resolved leaf directory UUID to useCmsContentEntries when path has segments", async () => {
      mockListWorkspaceContentDirectories.mockResolvedValue([
        {
          id: "dir-parent",
          parentId: null,
          name: "level-1-2",
          pathSegment: "level-1-2",
        },
        {
          id: "dir-leaf",
          parentId: "dir-parent",
          name: "level-2",
          pathSegment: "level-2",
        },
      ]);
      render(<CmsContentListPanel />);
      await waitFor(() =>
        expect(mockListWorkspaceContentDirectories).toHaveBeenCalled(),
      );
      await waitFor(() => {
        const lastCall = mockUseCmsContentEntries.mock.calls.at(-1)?.[0];
        expect(lastCall?.query?.directoryId).toBe("dir-leaf");
      });
    });

    it("does not call the directory API and passes undefined directoryId when at root content path", async () => {
      mockedPathname = "/dashboard/xynes-studio-llp/content";
      render(<CmsContentListPanel />);
      await waitFor(() => {
        const lastCall = mockUseCmsContentEntries.mock.calls.at(-1)?.[0];
        expect(lastCall?.query?.directoryId).toBeUndefined();
      });
      expect(mockListWorkspaceContentDirectories).not.toHaveBeenCalled();
    });
  });

  // ─── create guard: missing workspace context ───────────────────────────────

  describe("create guard — missing workspace context", () => {
    it("shows sign-in error and does not call create when workspace context is absent", async () => {
      vi.useRealTimers();
      // Simulate a workspace-less state: no slug from path + null workspace
      mockedPathname = "/dashboard";
      mockedWorkspace = null;

      render(<CmsContentListPanel />);
      // Wait for auth effect to settle with null accessToken
      await waitFor(() => expect(mockGetAccessToken).toHaveBeenCalledTimes(0));

      fireEvent.click(screen.getByRole("button", { name: "create content" }));

      await waitFor(() => {
        expect(
          screen.getByText("Unable to create content"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Please sign in again and retry."),
        ).toBeInTheDocument();
      });
      expect(mockCreateDraftEntryAndResolveEditPath).not.toHaveBeenCalled();
    });
  });

  // ─── catch branches in handleOpen and handleShare ─────────────────────────

  describe("card action error resilience — handleOpen & handleShare catch", () => {
    beforeEach(() => {
      vi.useRealTimers();
      mockedEntriesState = {
        ...mockedEntriesState,
        items: [
          {
            id: "entry-err-1",
            title: "Error Test",
            description: "",
            status: "draft",
            ownerName: null,
            isFavorite: false,
          },
        ],
        count: 1,
      };
    });

    it("silently ignores buildContentEntryEditRoute throw in handleOpen", async () => {
      mockBuildContentEntryEditRoute.mockImplementationOnce(() => {
        throw new Error("Invalid workspace slug");
      });
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("list-open-entry-err-1");
      expect(() => fireEvent.click(btn)).not.toThrow();
      expect(push).not.toHaveBeenCalled();
    });

    it("silently ignores buildContentEntryEditRoute throw in handleShare", async () => {
      mockBuildContentEntryEditRoute.mockImplementationOnce(() => {
        throw new Error("Invalid slug");
      });
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("list-share-entry-err-1");
      expect(() => fireEvent.click(btn)).not.toThrow();
      expect(mockClipboardWrite).not.toHaveBeenCalled();
    });
  });

  describe("create error — non-Error rejection", () => {
    it("handles a non-Error rejection and shows generic error copy", async () => {
      vi.useRealTimers();
      // Throw a plain string (not an Error) to exercise String(error ?? "unknown") branch
      mockCreateDraftEntryAndResolveEditPath.mockRejectedValueOnce(
        "service-unavailable",
      );
      mockGetCreateEntryErrorMessage.mockReturnValueOnce("Please try again.");

      render(<CmsContentListPanel />);
      await waitFor(() => expect(mockGetAccessToken).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole("button", { name: "create content" }));

      await waitFor(() => {
        expect(
          screen.getByText("Unable to create content"),
        ).toBeInTheDocument();
        expect(screen.getByText("Please try again.")).toBeInTheDocument();
      });
      expect(push).not.toHaveBeenCalled();
    });
  });

  // ─── noop card actions (delete / favorite) ───────────────────────────────

  describe("noop card actions — delete and toggle-favorite", () => {
    beforeEach(() => {
      vi.useRealTimers();
      mockedEntriesState = {
        ...mockedEntriesState,
        items: [
          {
            id: "entry-noop-1",
            title: "Noop test",
            description: "",
            status: "draft",
            ownerName: null,
            isFavorite: false,
          },
        ],
        count: 1,
      };
    });

    it("does not throw or navigate when a list-card Delete is clicked (noop)", async () => {
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("list-delete-entry-noop-1");
      expect(() => fireEvent.click(btn)).not.toThrow();
      expect(push).not.toHaveBeenCalled();
    });

    it("does not throw or navigate when a list-card Favorite is clicked (noop)", async () => {
      render(<CmsContentListPanel />);
      const btn = await screen.findByTestId("list-favorite-entry-noop-1");
      expect(() => fireEvent.click(btn)).not.toThrow();
      expect(push).not.toHaveBeenCalled();
    });
  });
});
