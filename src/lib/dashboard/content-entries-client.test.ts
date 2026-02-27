import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceContentEntry,
  deleteWorkspaceContentEntry,
  generateWorkspaceEntryShareLink,
  getWorkspaceContentEntryById,
  listWorkspaceContentEntries,
  listWorkspaceFavoriteEntries,
  publishWorkspaceContentEntry,
  setWorkspaceEntryCollaborators,
  toggleWorkspaceEntryFavorite,
  updateWorkspaceContentEntry,
  type WorkspaceContentEntry,
} from "./content-entries-client";

const sampleEntry: WorkspaceContentEntry = {
  id: "entry-1",
  workspaceId: "workspace-1",
  contentTypeId: "content-type-1",
  directoryId: null,
  title: "Entry title",
  description: "Entry description",
  body: { blocks: [] },
  tags: ["news"],
  ownerName: "Owner",
  avatarUrl: null,
  status: "draft",
  publishedAt: null,
  createdAt: "2026-02-26T10:00:00.000Z",
  updatedAt: "2026-02-26T10:00:00.000Z",
  collaborators: ["A", "B"],
  isFavorite: false,
};

describe("content-entries-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists entries with normalized query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [sampleEntry],
            count: 1,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await listWorkspaceContentEntries({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      query: {
        search: " hello ",
        sortBy: "title",
        sortDirection: "asc",
        status: "draft",
        limit: 30,
        offset: 10,
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries?search=hello&sortBy=title&sortDirection=asc&status=draft&limit=30&offset=10",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
    expect(result).toEqual({ items: [sampleEntry], count: 1 });
  });

  it("fails closed on malformed list payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { items: [{ id: "x" }] } }), {
        status: 200,
      }),
    );

    await expect(
      listWorkspaceContentEntries({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid/);
  });

  it("accepts optional description when omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [
              {
                ...sampleEntry,
                description: undefined,
              },
            ],
            count: 1,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await listWorkspaceContentEntries({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(result.items[0]?.description).toBe("");
  });

  it("creates and returns entry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { entry: sampleEntry } }), { status: 201 }),
    );

    const result = await createWorkspaceContentEntry({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      payload: {
        title: "Title",
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.id).toBe("entry-1");
  });

  it("gets entry by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { entry: sampleEntry } }), { status: 200 }),
    );

    const result = await getWorkspaceContentEntryById({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: " entry-1 ",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries/entry-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.id).toBe("entry-1");
  });

  it("updates entry by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { entry: sampleEntry } }), { status: 200 }),
    );

    await updateWorkspaceContentEntry({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      payload: { title: "Updated" },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries/entry-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("publishes and deletes entry", async () => {
    const publishFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { entry: sampleEntry } }), { status: 200 }),
    );
    const deleteFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { success: true, entryId: "entry-1", deletedAt: "2026-02-26T11:00:00.000Z" },
        }),
        { status: 200 },
      ),
    );

    const published = await publishWorkspaceContentEntry({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      fetchImpl: publishFetch,
    });

    const deleted = await deleteWorkspaceContentEntry({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      fetchImpl: deleteFetch,
    });

    expect(published.id).toBe("entry-1");
    expect(deleted.success).toBe(true);
    expect(deleted.entryId).toBe("entry-1");
  });

  it("sets collaborators and toggles favorite", async () => {
    const collaboratorsFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { entryId: "entry-1", collaborators: ["Alpha", "Beta"] },
        }),
        { status: 200 },
      ),
    );
    const favoriteFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { entryId: "entry-1", isFavorite: true } }),
        { status: 200 },
      ),
    );

    const collaborators = await setWorkspaceEntryCollaborators({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      collaborators: [
        { userId: "00000000-0000-0000-0000-000000000001", displayName: "Alpha" },
      ],
      fetchImpl: collaboratorsFetch,
    });

    const favorite = await toggleWorkspaceEntryFavorite({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      fetchImpl: favoriteFetch,
    });

    expect(collaborators.collaborators).toEqual(["Alpha", "Beta"]);
    expect(favorite.isFavorite).toBe(true);
  });

  it("lists favorite entries and generates internal share links", async () => {
    const favoritesFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { items: [sampleEntry], count: 1 } }),
        { status: 200 },
      ),
    );
    const shareFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { url: "/dashboard/acme/content/entry/entry-1/edit" },
        }),
        { status: 200 },
      ),
    );

    const favorites = await listWorkspaceFavoriteEntries({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      limit: 25,
      offset: 5,
      fetchImpl: favoritesFetch,
    });
    const share = await generateWorkspaceEntryShareLink({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      workspaceSlug: "acme",
      accessToken: "jwt-token",
      fetchImpl: shareFetch,
    });

    expect(favorites.items).toHaveLength(1);
    expect(share.url).toBe("/dashboard/acme/content/entry/entry-1/edit");
  });
});
