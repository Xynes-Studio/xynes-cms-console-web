import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentListPanel } from "./CmsContentListPanel";

const push = vi.fn();
const setState = vi.fn();
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

vi.mock("../../components/dashboard/CmsContentToolbar", () => ({
  CmsContentToolbar: ({
    breadcrumbItems,
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

vi.mock("@lumia-ui/components", () => ({
  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  setState.mockReset();
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
});

describe("CmsContentListPanel", () => {
  it("renders toolbar with breadcrumb label and list shell", () => {
    render(<CmsContentListPanel />);

    expect(
      screen.getByText("Contents / level-1-2 / level-2"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Content list panel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Content entries will appear here."),
    ).toBeInTheDocument();
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
});
