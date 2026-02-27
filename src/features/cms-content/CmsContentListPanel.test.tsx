import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentListPanel } from "./CmsContentListPanel";

const push = vi.fn();
let mockedPathname = "/dashboard/xynes-studio-llp/content/level-1-2/level-2";

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({ push }),
}));

vi.mock("../../components/dashboard/CmsContentToolbar", () => ({
  CmsContentToolbar: ({
    breadcrumbItems,
    onSearchSubmit,
    onCreate,
  }: {
    breadcrumbItems: Array<{ label: string }>;
    onSearchSubmit: () => void;
    onCreate: () => void;
  }) => (
    <section data-testid="toolbar">
      <span>{breadcrumbItems.map((item) => item.label).join(" / ")}</span>
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
  mockedPathname = "/dashboard/xynes-studio-llp/content/level-1-2/level-2";
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
  });

  it("uses last content segment for breadcrumb derivation", () => {
    mockedPathname = "/dashboard/content/content/level-2";

    render(<CmsContentListPanel />);

    expect(screen.getByText("Contents / level-2")).toBeInTheDocument();
  });
});
