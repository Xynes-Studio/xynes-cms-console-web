import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentCardGrid } from "./CmsContentCardGrid";

const i18nState = vi.hoisted(() => ({
  locale: "en-US",
  messages: {
    fallbackOwner: "Unknown owner",
    apiKeyCreator: "Created via API key",
    fallbackDate: "--",
    draft: "Draft",
    archived: "Archived",
    archivedAriaLabel: "{title} (archived)",
    openAriaLabel: "Open content {title}",
    avatarAlt: "{owner} avatar",
  },
}));

vi.mock("next-intl", () => ({
  useLocale: () => i18nState.locale,
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const template =
      i18nState.messages[key as keyof typeof i18nState.messages] ?? key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, value),
      template,
    );
  },
}));

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
  }: React.HTMLAttributes<HTMLSpanElement> & {
    children?: React.ReactNode;
  }) => <span {...props}>{children}</span>,
  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
  i18nState.locale = "en-US";
  i18nState.messages = {
    fallbackOwner: "Unknown owner",
    apiKeyCreator: "Created via API key",
    fallbackDate: "--",
    draft: "Draft",
    archived: "Archived",
    archivedAriaLabel: "{title} (archived)",
    openAriaLabel: "Open content {title}",
    avatarAlt: "{owner} avatar",
  };
  cleanup();
});

describe("CmsContentCardGrid", () => {
  it("renders owner/date metadata and draft badge when draft", () => {
    render(
      <CmsContentCardGrid
        entryId="entry-1"
        title="Quarterly Marketing Plan 2026"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Quarterly Marketing Plan 2026"),
    ).toBeInTheDocument();
    expect(screen.getByText("Archan Ray · Feb 23, 2026")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("falls back for missing owner/date and hides draft badge when published", () => {
    render(
      <CmsContentCardGrid
        entryId="entry-2"
        title="Roadmap Notes"
        ownerName={null}
        createdAt={null}
        status="published"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Unknown owner · --")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).toBeNull();
  });

  it("uses translated labels and the active locale for grid metadata", () => {
    i18nState.locale = "en-XA";
    i18nState.messages = {
      ...i18nState.messages,
      fallbackOwner: "[UUnnkknnoowwnn oowwnneerr]",
      draft: "[DDrraafftt]",
      openAriaLabel: "[OOppeenn ccoonntteenntt {title}]",
      avatarAlt: "[{owner} aavvaattaarr]",
    };
    const dateTimeFormatSpy = vi.spyOn(Intl, "DateTimeFormat");

    render(
      <CmsContentCardGrid
        entryId="entry-5"
        title="Pseudo Grid"
        ownerName={null}
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("[DDrraafftt]")).toBeInTheDocument();
    expect(
      screen.getByText("[UUnnkknnoowwnn oowwnneerr] · Feb 23, 2026"),
    ).toBeInTheDocument();
    expect(dateTimeFormatSpy).toHaveBeenCalledWith("en-XA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    expect(
      screen.getByRole("button", {
        name: "[OOppeenn ccoonntteenntt Pseudo Grid]",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("[[UUnnkknnoowwnn oowwnneerr] aavvaattaarr]"),
    ).toBeInTheDocument();
  });

  it("uses avatar initials fallback from owner name", () => {
    render(
      <CmsContentCardGrid
        entryId="entry-3"
        title="Avatar Test"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Archan Ray avatar")).toHaveTextContent("AR");
  });

  it("opens content on click and keyboard enter/space", () => {
    const onOpen = vi.fn();

    render(
      <CmsContentCardGrid
        entryId="entry-4"
        title="Open Interaction"
        ownerName="Team Owner"
        createdAt="2026-02-23T10:00:00.000Z"
        status="published"
        onOpen={onOpen}
      />,
    );

    const card = screen.getByRole("button", {
      name: /Open content Open Interaction/i,
    });
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenNthCalledWith(1, "entry-4");
    expect(onOpen).toHaveBeenNthCalledWith(2, "entry-4");
    expect(onOpen).toHaveBeenNthCalledWith(3, "entry-4");
  });

  it("BUG-CMS-1: renders no description <p> element", () => {
    const { container } = render(
      <CmsContentCardGrid
        entryId="entry-6"
        title="No Description Slot"
        ownerName="Owner"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    // The metadata row keeps two short <p>s (title is <h3>, meta line is <p>).
    // After BUG-CMS-1 there must NOT be a multi-line description <p> with
    // the line-clamp / min-height utility classes that previously held the
    // description copy.
    const descriptionParas = Array.from(container.querySelectorAll("p")).filter(
      (p) => /min-h-\[72px\]|line-clamp/.test(p.className),
    );
    expect(descriptionParas).toHaveLength(0);
  });

  it("BUG-CMS-1: card vertical structure is title-row + (optional) badge only", () => {
    // Regression guard: title + meta + badge live inside ONE row container.
    // After BUG-CMS-1 there is no sibling description block.
    const { container } = render(
      <CmsContentCardGrid
        entryId="entry-7"
        title="Structure Check"
        ownerName="Owner"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    const card = container.firstElementChild as HTMLElement | null;
    expect(card).not.toBeNull();
    // After the change, the card's only direct child is the metadata row.
    // (Previously there was a sibling <p> description block.)
    expect(card?.children).toHaveLength(1);
  });

  it("BUG-CMS-1: grid cards render at uniform height regardless of upstream description copy on the entry DTO", () => {
    // The entry DTO retains `description` (used by the editor), but the
    // card no longer accepts/renders it. Mounting three card variants
    // (which would previously have rendered three different description
    // clamps) yields identical DOM shape per the structural assertion above.
    const { container: emptyCard } = render(
      <CmsContentCardGrid
        entryId="empty"
        title="Empty desc upstream"
        ownerName="A"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );
    const { container: shortCard } = render(
      <CmsContentCardGrid
        entryId="short"
        title="Short desc upstream"
        ownerName="B"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );
    const { container: longCard } = render(
      <CmsContentCardGrid
        entryId="long"
        title="Long desc upstream"
        ownerName="C"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    // Same DOM child-count, same className on the outermost card.
    const a = emptyCard.firstElementChild as HTMLElement;
    const b = shortCard.firstElementChild as HTMLElement;
    const c = longCard.firstElementChild as HTMLElement;
    expect(a.children.length).toBe(b.children.length);
    expect(b.children.length).toBe(c.children.length);
    expect(a.className).toBe(b.className);
    expect(b.className).toBe(c.className);
  });

  it("BUG-CMS-7: archived entries render the Archived badge and dim the card", () => {
    const { container } = render(
      <CmsContentCardGrid
        entryId="entry-archived"
        title="Old Marketing Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="archived"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).toBeNull();
    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.status).toBe("archived");
    expect(card.className).toMatch(/opacity-60/);
    expect(card.className).toMatch(/grayscale/);
  });

  it("BUG-CMS-7: archived entry aria-label announces archived state", () => {
    render(
      <CmsContentCardGrid
        entryId="entry-archived-aria"
        title="Old Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="archived"
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Old Brief (archived)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open content Old Brief/i }),
    ).toBeNull();
  });

  it("BUG-CMS-7: archived entries still navigate on click + keyboard (un-archive path)", () => {
    const onOpen = vi.fn();

    render(
      <CmsContentCardGrid
        entryId="entry-archived-click"
        title="Old Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="archived"
        onOpen={onOpen}
      />,
    );

    const card = screen.getByRole("button", { name: "Old Brief (archived)" });
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenNthCalledWith(1, "entry-archived-click");
  });

  it("BUG-CMS-7: published cards are NOT dimmed and carry no Archived badge", () => {
    const { container } = render(
      <CmsContentCardGrid
        entryId="entry-published"
        title="Live Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="published"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText("Archived")).toBeNull();
    expect(screen.queryByText("Draft")).toBeNull();
    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.status).toBe("published");
    expect(card.className).not.toMatch(/opacity-60/);
    expect(card.className).not.toMatch(/grayscale/);
  });
});

// BUG-CMS-8 — creator field precedence on grid cards.
describe("CmsContentCardGrid — BUG-CMS-8 creator precedence", () => {
  const baseProps = {
    entryId: "entry-creator-grid",
    title: "Owner Resolution Card",
    createdAt: "2026-02-23T10:00:00.000Z",
    status: "draft" as const,
    onOpen: vi.fn(),
  };

  it("renders creator.displayName when a real human created the entry", () => {
    render(
      <CmsContentCardGrid
        {...baseProps}
        ownerName={null}
        creator={{
          id: "11111111-1111-4111-8111-111111111111",
          displayName: "Aiyana Patel",
        }}
      />,
    );

    expect(
      screen.getByText("Aiyana Patel · Feb 23, 2026"),
    ).toBeInTheDocument();
  });

  it("renders the localized api-key label when creator is null (api_key actor)", () => {
    render(<CmsContentCardGrid {...baseProps} ownerName={null} creator={null} />);

    expect(
      screen.getByText("Created via API key · Feb 23, 2026"),
    ).toBeInTheDocument();
  });

  it("does not leak api-key audit handles into the visible markup", () => {
    const { container } = render(
      <CmsContentCardGrid {...baseProps} ownerName={null} creator={null} />,
    );

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/apiKeyId/i);
    expect(text).not.toMatch(/keyPrefix/i);
    expect(text).not.toMatch(/keyHash/i);
    expect(text).not.toMatch(/xynes_live_/);
  });

  it("falls back to the legacy ownerName when creator.displayName is null", () => {
    render(
      <CmsContentCardGrid
        {...baseProps}
        ownerName="Legacy Editor Alias"
        creator={{
          id: "22222222-2222-4222-8222-222222222222",
          displayName: null,
        }}
      />,
    );

    expect(
      screen.getByText("Legacy Editor Alias · Feb 23, 2026"),
    ).toBeInTheDocument();
  });

  it("falls back to the generic Unknown owner label when creator and ownerName are both empty", () => {
    render(
      <CmsContentCardGrid
        {...baseProps}
        ownerName={null}
        creator={{
          id: "33333333-3333-4333-8333-333333333333",
          displayName: null,
        }}
      />,
    );

    expect(
      screen.getByText("Unknown owner · Feb 23, 2026"),
    ).toBeInTheDocument();
  });

  it("falls back to the legacy ownerName when creator is undefined (PR #41 codex review — absent creator must not be conflated with api_key actor)", () => {
    render(
      <CmsContentCardGrid
        {...baseProps}
        ownerName="Legacy Editor Alias"
        creator={undefined}
      />,
    );

    // Absent creator (older / partial gateway response) MUST surface the
    // legacy `ownerName`, NOT the api-key label.
    expect(
      screen.getByText("Legacy Editor Alias · Feb 23, 2026"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Created via API key/)).not.toBeInTheDocument();
  });
});
