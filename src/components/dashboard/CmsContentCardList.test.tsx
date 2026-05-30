import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentCardList } from "./CmsContentCardList";

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
    delete: "Delete",
    deleting: "Deleting...",
    deleteAriaLabel: "Delete content {title}",
    share: "Share",
    shareAriaLabel: "Share content {title}",
    favorite: "Favourite",
    favorited: "Favourited",
    updating: "Updating...",
    favoriteAriaLabel: "Favorite content {title}",
    unfavoriteAriaLabel: "Unfavorite content {title}",
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
}));

vi.mock("@lumia-ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
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
    delete: "Delete",
    deleting: "Deleting...",
    deleteAriaLabel: "Delete content {title}",
    share: "Share",
    shareAriaLabel: "Share content {title}",
    favorite: "Favourite",
    favorited: "Favourited",
    updating: "Updating...",
    favoriteAriaLabel: "Favorite content {title}",
    unfavoriteAriaLabel: "Unfavorite content {title}",
  };
  cleanup();
});

describe("CmsContentCardList", () => {
  it("renders metadata with collaborator overflow and draft badge", () => {
    render(
      <CmsContentCardList
        entryId="entry-1"
        title="List Card Entry"
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
    expect(
      screen.getByText("Archan Ray · Feb 23, 2026 · Ava, Suman, Sowjanya, +1"),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("falls back for missing owner/date and omits draft badge when published", () => {
    render(
      <CmsContentCardList
        entryId="entry-2"
        title="Published Card"
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

  it("uses translated labels and the active locale for card metadata", () => {
    i18nState.locale = "en-XA";
    i18nState.messages = {
      ...i18nState.messages,
      fallbackOwner: "[UUnnkknnoowwnn oowwnneerr]",
      draft: "[DDrraafftt]",
      openAriaLabel: "[OOppeenn ccoonntteenntt {title}]",
      avatarAlt: "[{owner} aavvaattaarr]",
      delete: "[DDeelleettee]",
      share: "[SShhaarree]",
      favorite: "[FFaavvoouurriittee]",
      deleteAriaLabel: "[DDeelleettee ccoonntteenntt {title}]",
      shareAriaLabel: "[SShhaarree ccoonntteenntt {title}]",
      favoriteAriaLabel: "[FFaavvoouurriittee ccoonntteenntt {title}]",
    };
    const dateTimeFormatSpy = vi.spyOn(Intl, "DateTimeFormat");

    render(
      <CmsContentCardList
        entryId="entry-5"
        title="Pseudo Card"
        ownerName={null}
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
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
        name: "[OOppeenn ccoonntteenntt Pseudo Card]",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("[[UUnnkknnoowwnn oowwnneerr] aavvaattaarr]"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "[DDeelleettee ccoonntteenntt Pseudo Card]",
      }),
    ).toBeInTheDocument();
  });

  it("invokes open handler by click and keyboard", () => {
    const onOpen = vi.fn();

    render(
      <CmsContentCardList
        entryId="entry-3"
        title="Open Card"
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

    const openRegion = screen.getByRole("button", {
      name: /Open content Open Card/i,
    });
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

    fireEvent.click(
      screen.getByRole("button", { name: /Delete content Action Card/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Share content Action Card/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Unfavorite content Action Card/i }),
    );

    expect(onDelete).toHaveBeenCalledWith("entry-4");
    expect(onShare).toHaveBeenCalledWith("entry-4");
    expect(onToggleFavorite).toHaveBeenCalledWith("entry-4");
    expect(
      screen.getByRole("button", { name: /Unfavorite content Action Card/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("BUG-CMS-1: renders no description <p> element", () => {
    const { container } = render(
      <CmsContentCardList
        entryId="entry-no-desc"
        title="No Description Slot"
        ownerName="Owner"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const descriptionParas = Array.from(container.querySelectorAll("p")).filter(
      (p) => /min-h-\[72px\]|line-clamp/.test(p.className),
    );
    expect(descriptionParas).toHaveLength(0);
  });

  it("BUG-CMS-1: card vertical structure is metadata-row + actions-row only", () => {
    // After BUG-CMS-1 the card has exactly two direct children: the open
    // region (metadata) and the actions row.
    const { container } = render(
      <CmsContentCardList
        entryId="entry-struct"
        title="Structure Check"
        ownerName="Owner"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const card = container.firstElementChild as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card?.children).toHaveLength(2);
  });

  it("BUG-CMS-1: list rows have identical DOM shape across mixed entries", () => {
    const { container: emptyCard } = render(
      <CmsContentCardList
        entryId="empty"
        title="Entry A"
        ownerName="A"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    const { container: shortCard } = render(
      <CmsContentCardList
        entryId="short"
        title="Entry B"
        ownerName="B"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    const { container: longCard } = render(
      <CmsContentCardList
        entryId="long"
        title="Entry C"
        ownerName="C"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="draft"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const a = emptyCard.firstElementChild as HTMLElement;
    const b = shortCard.firstElementChild as HTMLElement;
    const c = longCard.firstElementChild as HTMLElement;
    expect(a.children.length).toBe(b.children.length);
    expect(b.children.length).toBe(c.children.length);
    expect(a.className).toBe(b.className);
    expect(b.className).toBe(c.className);
  });

  it("BUG-CMS-7: archived list row renders the Archived badge and dims the metadata block", () => {
    const { container } = render(
      <CmsContentCardList
        entryId="entry-archived"
        title="Old Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="archived"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).toBeNull();
    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.status).toBe("archived");
    // The dim treatment is applied to the open-region (metadata) only — the
    // outer Card itself must NOT carry the dim utilities, so the actions row
    // (delete / share / favourite) below stays at full opacity.
    expect(card.className).not.toMatch(/opacity-60/);
    expect(card.className).not.toMatch(/grayscale/);
    const openRegion = screen.getByRole("button", {
      name: "Old Brief (archived)",
    });
    expect(openRegion.className).toMatch(/opacity-60/);
    expect(openRegion.className).toMatch(/grayscale/);
  });

  it("BUG-CMS-7: archived list row keeps the actions row fully visible", () => {
    render(
      <CmsContentCardList
        entryId="entry-archived-actions"
        title="Old Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="archived"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    // The action buttons keep their normal Lumia DS styling — they are NOT
    // inside the dimmed open-region.
    const deleteButton = screen.getByRole("button", {
      name: /Delete content Old Brief/i,
    });
    expect(deleteButton.className).not.toMatch(/opacity-60/);
    expect(deleteButton.className).not.toMatch(/grayscale/);
  });

  it("BUG-CMS-7: archived row still navigates on click + keyboard (un-archive path)", () => {
    const onOpen = vi.fn();

    render(
      <CmsContentCardList
        entryId="entry-archived-click"
        title="Old Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="archived"
        onOpen={onOpen}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const openRegion = screen.getByRole("button", {
      name: "Old Brief (archived)",
    });
    fireEvent.click(openRegion);
    fireEvent.keyDown(openRegion, { key: "Enter" });
    fireEvent.keyDown(openRegion, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenNthCalledWith(1, "entry-archived-click");
  });

  it("BUG-CMS-7: published rows are NOT dimmed and carry no Archived badge", () => {
    const { container } = render(
      <CmsContentCardList
        entryId="entry-published"
        title="Live Brief"
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        collaborators={[]}
        isFavorite={false}
        status="published"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.queryByText("Archived")).toBeNull();
    expect(screen.queryByText("Draft")).toBeNull();
    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.status).toBe("published");
    const openRegion = screen.getByRole("button", {
      name: /Open content Live Brief/i,
    });
    expect(openRegion.className).not.toMatch(/opacity-60/);
  });
});

// BUG-CMS-8 — creator field precedence on list cards.
describe("CmsContentCardList — BUG-CMS-8 creator precedence", () => {
  const baseProps = {
    entryId: "entry-creator-list",
    title: "Owner Resolution Card",
    createdAt: "2026-02-23T10:00:00.000Z",
    collaborators: [],
    isFavorite: false,
    status: "draft" as const,
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onShare: vi.fn(),
    onToggleFavorite: vi.fn(),
  };

  it("renders creator.displayName when a real human created the entry", () => {
    render(
      <CmsContentCardList
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
    render(<CmsContentCardList {...baseProps} ownerName={null} creator={null} />);

    expect(
      screen.getByText("Created via API key · Feb 23, 2026"),
    ).toBeInTheDocument();
  });

  it("does not leak api-key audit handles into the visible markup", () => {
    const { container } = render(
      <CmsContentCardList {...baseProps} ownerName={null} creator={null} />,
    );

    // The visible text must NOT carry the api-key audit handles even if a
    // future regression accidentally passed them through props.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/apiKeyId/i);
    expect(text).not.toMatch(/keyPrefix/i);
    expect(text).not.toMatch(/keyHash/i);
    expect(text).not.toMatch(/xynes_live_/);
  });

  it("falls back to the legacy ownerName when creator.displayName is null", () => {
    render(
      <CmsContentCardList
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
      <CmsContentCardList
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
      <CmsContentCardList
        {...baseProps}
        ownerName="Legacy Editor Alias"
        creator={undefined}
      />,
    );

    // Absent creator (older / partial gateway response) MUST surface the
    // legacy `ownerName`, NOT the api-key label. Conflating absent with
    // explicit-null would suppress legacy ownerName for every entry on a
    // gateway response that omits the new `creator` field.
    expect(
      screen.getByText("Legacy Editor Alias · Feb 23, 2026"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Created via API key/)).not.toBeInTheDocument();
  });

  it("uses the pseudo-locale api-key label when the active locale is en-XA", () => {
    i18nState.locale = "en-XA";
    i18nState.messages = {
      ...i18nState.messages,
      apiKeyCreator: "[CCrreeaatteedd vviiaa AAPPII kkeeyy]",
    };

    render(<CmsContentCardList {...baseProps} ownerName={null} creator={null} />);

    expect(
      screen.getByText("[CCrreeaatteedd vviiaa AAPPII kkeeyy] · Feb 23, 2026"),
    ).toBeInTheDocument();
  });
});
