import type React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsContentCardGrid } from "./CmsContentCardGrid";

const i18nState = vi.hoisted(() => ({
  locale: "en-US",
  messages: {
    fallbackOwner: "Unknown owner",
    fallbackDate: "--",
    draft: "Draft",
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
  }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
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
    fallbackDate: "--",
    draft: "Draft",
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
        description="Long-form content for campaign launch and editorial sequencing."
        ownerName="Archan Ray"
        createdAt="2026-02-23T10:00:00.000Z"
        status="draft"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Quarterly Marketing Plan 2026")).toBeInTheDocument();
    expect(screen.getByText("Archan Ray · Feb 23, 2026")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText(/Long-form content/)).toBeInTheDocument();
  });

  it("falls back for missing owner/date and hides draft badge when published", () => {
    render(
      <CmsContentCardGrid
        entryId="entry-2"
        title="Roadmap Notes"
        description="Fallback rendering check."
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
        description="Localized grid metadata check."
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
        description="Initials fallback check."
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
        description="Open callback behavior."
        ownerName="Team Owner"
        createdAt="2026-02-23T10:00:00.000Z"
        status="published"
        onOpen={onOpen}
      />,
    );

    const card = screen.getByRole("button", { name: /Open content Open Interaction/i });
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenNthCalledWith(1, "entry-4");
    expect(onOpen).toHaveBeenNthCalledWith(2, "entry-4");
    expect(onOpen).toHaveBeenNthCalledWith(3, "entry-4");
  });
});
