import { describe, expect, it, vi } from "vitest";
import { mapEntryToGridCardProps, mapEntryToListCardProps } from "./mappers";

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry-1",
  workspaceId: "workspace-1",
  directoryId: null,
  title: "Entry title",
  description: "Entry description",
  body: {},
  tags: [],
  ownerName: "Owner",
  avatarUrl: null,
  status: "draft" as const,
  publishedAt: null,
  createdAt: "2026-02-27T00:00:00.000Z",
  updatedAt: "2026-02-27T00:00:00.000Z",
  collaborators: ["A", "B"],
  isFavorite: false,
  ...overrides,
});

describe("cms-content mappers", () => {
  it("maps grid card props and preserves archived status (BUG-CMS-7)", () => {
    const onOpen = vi.fn();

    const mapped = mapEntryToGridCardProps({
      entry: makeEntry({ status: "archived" }),
      onOpen,
    });

    expect(mapped.entryId).toBe("entry-1");
    expect(mapped.status).toBe("archived");
    mapped.onOpen("entry-1");
    expect(onOpen).toHaveBeenCalledWith("entry-1");
  });

  it("maps grid card props and falls back to draft for unknown status", () => {
    const mapped = mapEntryToGridCardProps({
      entry: makeEntry({ status: "draft" }),
      onOpen: vi.fn(),
    });

    expect(mapped.status).toBe("draft");
  });

  it("maps list card props and preserves archived status (BUG-CMS-7)", () => {
    const handlers = {
      onOpen: vi.fn(),
      onDelete: vi.fn(),
      onShare: vi.fn(),
      onToggleFavorite: vi.fn(),
    };

    const mapped = mapEntryToListCardProps({
      entry: makeEntry({ status: "archived" }),
      handlers,
    });

    expect(mapped.status).toBe("archived");
  });

  it("maps list card props and preserves published status", () => {
    const handlers = {
      onOpen: vi.fn(),
      onDelete: vi.fn(),
      onShare: vi.fn(),
      onToggleFavorite: vi.fn(),
    };

    const mapped = mapEntryToListCardProps({
      entry: makeEntry({ status: "published", isFavorite: true }),
      handlers,
    });

    expect(mapped.status).toBe("published");
    expect(mapped.isFavorite).toBe(true);
    expect(mapped.collaborators).toEqual(["A", "B"]);
    mapped.onDelete("entry-1");
    expect(handlers.onDelete).toHaveBeenCalledWith("entry-1");
  });
});
