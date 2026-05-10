import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentToolbar } from "./CmsContentToolbar";

const translationState = vi.hoisted(() => ({
  variant: "en" as "en" | "pseudo",
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: { count?: number }) => {
      const english: Record<string, string> = {
        "cms.content.toolbar.ariaLabel": "Content toolbar",
        "cms.content.toolbar.create": "Create",
        "cms.content.toolbar.createAriaLabel": "Create content",
        "cms.content.toolbar.searchInputLabel": "Search for contents",
        "cms.content.toolbar.searchPlaceholder": "Search for Contents",
        "cms.content.toolbar.searchButton": "Search",
        "cms.content.toolbar.searchButtonAriaLabel": "Search contents",
        "cms.content.toolbar.following": "Following",
        "cms.content.toolbar.followingAriaLabel": "Toggle following filter",
        "cms.content.toolbar.favorites": "Favorites",
        "cms.content.toolbar.favoritesAriaLabel": "Toggle favorites filter",
        "cms.content.toolbar.filter": "Filter",
        "cms.content.toolbar.filterAriaLabel": "Open advanced filters",
        "cms.content.toolbar.sortLabel": "Sort content",
        "cms.content.toolbar.sort.date": "Date",
        "cms.content.toolbar.sort.title": "Title",
        "cms.content.toolbar.sort.popularity": "Popularity",
      };
      const pseudo: Record<string, string> = {
        ...english,
        "cms.content.toolbar.ariaLabel": "[CCoonntteenntt ttoooollbbaarr]",
        "cms.content.toolbar.create": "[CCrreeaattee]",
        "cms.content.toolbar.createAriaLabel": "[CCrreeaattee ccoonntteenntt]",
        "cms.content.toolbar.searchInputLabel":
          "[SSeeaarrcchh ffoorr ccoonntteennttss]",
        "cms.content.toolbar.searchPlaceholder":
          "[SSeeaarrcchh ffoorr CCoonntteennttss]",
        "cms.content.toolbar.searchButton": "[SSeeaarrcchh]",
        "cms.content.toolbar.searchButtonAriaLabel":
          "[SSeeaarrcchh ccoonntteennttss]",
      };

      if (key === "itemCount") {
        return `${values?.count ?? 0} Items`;
      }

      return (translationState.variant === "pseudo" ? pseudo : english)[
        `${namespace}.${key}`
      ];
    },
}));

vi.mock("@lumia-ui/components", () => ({
  Breadcrumbs: ({
    items,
  }: {
    items: Array<{ label: string; onClick?: () => void }>;
  }) => (
    <nav aria-label="Breadcrumb">
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </nav>
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Chip: ({
    children,
    icon,
    iconName,
    leadingIcon,
    trailingContent,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    toggle?: boolean;
    active?: boolean;
    icon?: React.ReactNode;
    iconName?: string;
    leadingIcon?: React.ReactNode;
    trailingContent?: React.ReactNode;
  }) => {
    const domProps = { ...props };
    delete (domProps as Record<string, unknown>).toggle;
    delete (domProps as Record<string, unknown>).active;

    return (
      <button type="button" {...domProps}>
        {leadingIcon}
        {icon}
        {iconName ? (
          <span data-icon-name={iconName} aria-hidden="true">
            {iconName}
          </span>
        ) : null}
        {children}
        {trailingContent}
      </button>
    );
  },
  Input: ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Select: ({
    children,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children?: React.ReactNode;
  }) => <select {...props}>{children}</select>,
  ViewToggle: ({
    mode,
    onChange,
  }: {
    mode: "grid" | "list";
    onChange: (mode: "grid" | "list") => void;
  }) => (
    <div>
      <button
        type="button"
        aria-label="Grid view"
        onClick={() => onChange("grid")}
      >
        {mode === "grid" ? "grid-active" : "grid"}
      </button>
      <button
        type="button"
        aria-label="List view"
        onClick={() => onChange("list")}
      >
        {mode === "list" ? "list-active" : "list"}
      </button>
    </div>
  ),
}));

vi.mock("@lumia-ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}));

afterEach(() => {
  translationState.variant = "en";
  cleanup();
});

const buildProps = () => ({
  breadcrumbItems: [
    { label: "Contents", onClick: vi.fn() },
    { label: "level1", onClick: vi.fn() },
    { label: "level2", onClick: vi.fn() },
  ],
  itemCount: 44,
  query: "",
  sortBy: "date" as const,
  view: "grid" as const,
  followingOnly: false,
  favoritesOnly: true,
  filterDisabled: true,
  onCreate: vi.fn(),
  onQueryChange: vi.fn(),
  onSearchSubmit: vi.fn(),
  onSortChange: vi.fn(),
  onViewChange: vi.fn(),
  onFollowingToggle: vi.fn(),
  onFavoritesToggle: vi.fn(),
  onFilterClick: vi.fn(),
});

describe("CmsContentToolbar", () => {
  it("renders path, item count, and core controls", () => {
    render(<CmsContentToolbar {...buildProps()} />);

    expect(
      screen.getByTestId("cms-content-toolbar-primary-row"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cms-content-toolbar-secondary-row"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Contents" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "level1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "level2" })).toBeInTheDocument();
    expect(screen.getByText("44 Items")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create content" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Search for contents" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Search contents" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Sort content" }),
    ).toBeInTheDocument();
  });

  it("renders the favorites chip with the Lumia canonical 'star' icon (UXR-3 follow-through)", () => {
    render(<CmsContentToolbar {...buildProps()} />);

    const favoritesButton = screen.getByRole("button", {
      name: "Toggle favorites filter",
    });
    // The chip's leading glyph is the Lumia "star" icon registered via
    // packages/icons/src/default-icons.ts (UXR-3). Our @lumia-ui/icons mock
    // renders the resolved icon name into the DOM, so this assertion
    // protects against a future regression that re-introduces a direct
    // lucide-react import for the favorites glyph.
    expect(favoritesButton).toHaveTextContent(/star/i);
  });

  it("emits create, query, and search events", () => {
    const props = buildProps();
    render(<CmsContentToolbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Create content" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search for contents" }),
      {
        target: { value: "release notes" },
      },
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Search contents" }).closest("form")!,
    );

    expect(props.onCreate).toHaveBeenCalledTimes(1);
    expect(props.onQueryChange).toHaveBeenCalledWith("release notes");
    expect(props.onSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it("triggers breadcrumb click handlers", () => {
    const props = buildProps();
    render(<CmsContentToolbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Contents" }));
    fireEvent.click(screen.getByRole("button", { name: "level1" }));

    expect(props.breadcrumbItems[0]?.onClick).toHaveBeenCalledTimes(1);
    expect(props.breadcrumbItems[1]?.onClick).toHaveBeenCalledTimes(1);
  });

  it("emits filter-toggle and sort callbacks", () => {
    const props = buildProps();
    render(<CmsContentToolbar {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle following filter" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle favorites filter" }),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Sort content" }), {
      target: { value: "title" },
    });

    expect(props.onFollowingToggle).toHaveBeenCalledTimes(1);
    expect(props.onFavoritesToggle).toHaveBeenCalledTimes(1);
    expect(props.onSortChange).toHaveBeenCalledWith("title");
  });

  it("keeps advanced filter disabled by default", () => {
    const props = buildProps();
    render(<CmsContentToolbar {...props} />);

    const filterButton = screen.getByRole("button", {
      name: "Open advanced filters",
    });
    expect(filterButton).toBeDisabled();
    fireEvent.click(filterButton);
    expect(props.onFilterClick).toHaveBeenCalledTimes(0);
  });

  it("emits view change callback from view toggle", () => {
    const props = buildProps();
    render(<CmsContentToolbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(props.onViewChange).toHaveBeenCalledWith("list");
  });

  it("marks the secondary row aria-hidden when requested", () => {
    render(<CmsContentToolbar {...buildProps()} secondaryRowHidden />);

    expect(
      screen.getByTestId("cms-content-toolbar-secondary-row"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByTestId("cms-content-toolbar-secondary-row"),
    ).toHaveAttribute("inert");
  });

  it("renders translated visible and accessible toolbar labels", () => {
    translationState.variant = "pseudo";

    render(<CmsContentToolbar {...buildProps()} />);

    expect(
      screen.getByRole("region", { name: "[CCoonntteenntt ttoooollbbaarr]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "[CCrreeaattee ccoonntteenntt]" }),
    ).toHaveTextContent("[CCrreeaattee]");
    expect(
      screen.getByRole("textbox", {
        name: "[SSeeaarrcchh ffoorr ccoonntteennttss]",
      }),
    ).toHaveAttribute("placeholder", "[SSeeaarrcchh ffoorr CCoonntteennttss]");
    expect(
      screen.getByRole("button", { name: "[SSeeaarrcchh ccoonntteennttss]" }),
    ).toHaveTextContent("[SSeeaarrcchh]");
  });
});
