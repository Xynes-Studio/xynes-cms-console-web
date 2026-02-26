import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentCardList } from "./CmsContentCardList";

vi.mock("@lumia-ui/components", () => ({
  Avatar: ({
    alt,
    fallbackInitials,
  }: {
    alt?: string;
    fallbackInitials?: string;
  }) => {
    const initials = (fallbackInitials ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return <span aria-label={alt}>{initials}</span>;
  },
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@lumia-ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}));

afterEach(() => {
  cleanup();
});

describe("CmsContentCardList", () => {
  it("renders metadata with collaborator overflow and draft badge", () => {
    render(
      <CmsContentCardList
        entryId="entry-1"
        title="List Card Entry"
        description="Detailed content summary text for the card body."
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={["Ava", "Suman", "Sowjanya", "Chris"]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByText("List Card Entry")).toBeInTheDocument();
    expect(screen.getByText("Archan Ray · Feb 23, 2026 · Ava, Suman, Sowjanya, +1")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("falls back for missing owner/date and omits draft badge when published", () => {
    render(
      <CmsContentCardList
        entryId="entry-2"
        title="Published Card"
        description="Fallback metadata check."
        ownerName={null}
        createdAt={null}
        collaborators={[]}
        isFavorite={false}
        status="published"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByText("Unknown owner · --")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).toBeNull();
  });

  it("invokes open handler by click and keyboard", () => {
    const onOpen = vi.fn();

    render(
      <CmsContentCardList
        entryId="entry-3"
        title="Open Card"
        description="Open behavior check."
        ownerName="Owner Name"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="published"
        onOpen={onOpen}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const openRegion = screen.getByRole("button", { name: /Open content Open Card/i });
    fireEvent.click(openRegion);
    fireEvent.keyDown(openRegion, { key: "Enter" });
    fireEvent.keyDown(openRegion, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenNthCalledWith(1, "entry-3");
    expect(onOpen).toHaveBeenNthCalledWith(2, "entry-3");
    expect(onOpen).toHaveBeenNthCalledWith(3, "entry-3");
  });

  it("invokes action callbacks with entry id and favorite pressed state", () => {
    const onDelete = vi.fn();
    const onShare = vi.fn();
    const onToggleFavorite = vi.fn();

    render(
      <CmsContentCardList
        entryId="entry-4"
        title="Action Card"
        description="Action behavior check."
        ownerName="Owner Name"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite
        status="published"
        onOpen={vi.fn()}
        onDelete={onDelete}
        onShare={onShare}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete content Action Card/i }));
    fireEvent.click(screen.getByRole("button", { name: /Share content Action Card/i }));
    fireEvent.click(screen.getByRole("button", { name: /Unfavorite content Action Card/i }));

    expect(onDelete).toHaveBeenCalledWith("entry-4");
    expect(onShare).toHaveBeenCalledWith("entry-4");
    expect(onToggleFavorite).toHaveBeenCalledWith("entry-4");
    expect(screen.getByRole("button", { name: /Unfavorite content Action Card/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
