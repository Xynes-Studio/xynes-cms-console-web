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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain(
      "http://localhost:4100/workspaces/workspace-1/content/entries?",
    );
    expect(String(url)).toContain("search=hello");
    expect(String(url)).toContain("sortBy=title");
    expect(String(url)).toContain("sortDirection=asc");
    expect(String(url)).toContain("status=draft");
    expect(String(url)).toContain("limit=30");
    expect(String(url)).toContain("offset=10");
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
    expect(result).toEqual({ items: [sampleEntry], count: 1 });
  });

  it("skips malformed list items instead of failing entire response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { items: [{ id: "x" }] } }),
        {
          status: 200,
        },
      ),
    );

    const result = await listWorkspaceContentEntries({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({ items: [], count: 0 });
  });

  it("omits default sort and paging query parameters", async () => {
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

    await listWorkspaceContentEntries({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      query: {
        sortBy: "date",
        sortDirection: "desc",
        status: "all",
        limit: 20,
        offset: 0,
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("retries with compatibility query when strict payload returns 400", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid payload" },
          }),
          { status: 400, statusText: "Bad Request" },
        ),
      )
      .mockResolvedValueOnce(
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
        sortBy: "title",
        sortDirection: "asc",
        limit: 40,
        offset: 5,
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4100/workspaces/workspace-1/content/entries?sortBy=title&sortDirection=asc&limit=40&offset=5",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4100/workspaces/workspace-1/content/entries",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.items).toHaveLength(1);
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

  it("normalizes missing title to Untitled for legacy entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [
              {
                ...sampleEntry,
                title: "",
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

    expect(result.items[0]?.title).toBe("Untitled");
  });

  it("returns valid entries when response includes mixed valid and invalid rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [sampleEntry, { id: "only-id" }],
            count: 2,
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

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(sampleEntry.id);
    // count reflects the server-reported total, not the number of parsed items
    // (malformed rows are dropped client-side; the server total drives pagination)
    expect(result.count).toBe(2);
  });

  it("creates and returns entry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, data: { entry: sampleEntry } }),
          { status: 201 },
        ),
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

  it("creates and returns entry when description is empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            entry: {
              ...sampleEntry,
              description: "",
            },
          },
        }),
        { status: 201 },
      ),
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

    expect(result.description).toBe("");
  });

  it("includes backend error code and message for create failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "DIRECTORY_ROUTE_SEGMENT_NOT_FOUND",
            message: "Directory route not found for routeSegment: entries",
          },
        }),
        { status: 404, statusText: "Not Found" },
      ),
    );

    await expect(
      createWorkspaceContentEntry({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        payload: {
          title: "Title",
        },
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "Failed to create content entry: HTTP 404 Not Found (DIRECTORY_ROUTE_SEGMENT_NOT_FOUND: Directory route not found for routeSegment: entries)",
    );
  });

  it("logs create failure metadata with code and requestId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "CONTENT_TYPE_NOT_FOUND",
            message: "Content type not found: blog_post",
          },
          meta: {
            requestId: "req-debug-1",
          },
        }),
        { status: 404, statusText: "Not Found" },
      ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createWorkspaceContentEntry({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        payload: {
          title: "Title",
        },
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Failed to create content entry: HTTP 404 Not Found");

    expect(errorSpy).toHaveBeenCalledWith(
      "[CMS][create] request failed",
      expect.objectContaining({
        workspaceId: "workspace-1",
        status: 404,
        code: "CONTENT_TYPE_NOT_FOUND",
        requestId: "req-debug-1",
      }),
    );
  });

  it("gets entry by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, data: { entry: sampleEntry } }),
          { status: 200 },
        ),
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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, data: { entry: sampleEntry } }),
          { status: 200 },
        ),
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
    const publishFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, data: { entry: sampleEntry } }),
          { status: 200 },
        ),
      );
    const deleteFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            success: true,
            entryId: "entry-1",
            deletedAt: "2026-02-26T11:00:00.000Z",
          },
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

  it("sends an explicit empty JSON body for delete requests", async () => {
    const deleteFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            success: true,
            entryId: "entry-1",
            deletedAt: "2026-02-26T11:00:00.000Z",
          },
        }),
        { status: 200 },
      ),
    );

    await deleteWorkspaceContentEntry({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      fetchImpl: deleteFetch,
    });

    expect(deleteFetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries/entry-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer jwt-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      }),
    );
  });

  it("throws when delete response is invalid", async () => {
    const deleteFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            success: false,
            entryId: "entry-1",
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      deleteWorkspaceContentEntry({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        accessToken: "jwt-token",
        fetchImpl: deleteFetch,
      }),
    ).rejects.toThrow("Invalid content entry delete response");
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
        JSON.stringify({
          ok: true,
          data: { entryId: "entry-1", isFavorite: true },
        }),
        { status: 200 },
      ),
    );

    const collaborators = await setWorkspaceEntryCollaborators({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      accessToken: "jwt-token",
      collaborators: [
        {
          userId: "00000000-0000-0000-0000-000000000001",
          displayName: "Alpha",
        },
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

  it("throws when collaborators response is invalid", async () => {
    const collaboratorsFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { entryId: "entry-1", collaborators: "Alpha" },
        }),
        { status: 200 },
      ),
    );

    await expect(
      setWorkspaceEntryCollaborators({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        accessToken: "jwt-token",
        collaborators: [],
        fetchImpl: collaboratorsFetch,
      }),
    ).rejects.toThrow("Invalid content entry collaborators response");
  });

  it("throws when collaborators update request fails", async () => {
    const collaboratorsFetch = vi.fn().mockResolvedValue(
      new Response("denied", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    await expect(
      setWorkspaceEntryCollaborators({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        accessToken: "jwt-token",
        collaborators: [],
        fetchImpl: collaboratorsFetch,
      }),
    ).rejects.toThrow(
      "Failed to update content entry collaborators: HTTP 500 Internal Server Error",
    );
  });

  it("throws when favorite toggle request fails", async () => {
    const favoriteFetch = vi.fn().mockResolvedValue(
      new Response("denied", {
        status: 409,
        statusText: "Conflict",
      }),
    );

    await expect(
      toggleWorkspaceEntryFavorite({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        accessToken: "jwt-token",
        fetchImpl: favoriteFetch,
      }),
    ).rejects.toThrow(
      "Failed to toggle content entry favorite: HTTP 409 Conflict",
    );
  });

  it("lists favorite entries and generates internal share links", async () => {
    const favoritesFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { items: [sampleEntry], count: 1 },
        }),
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

  it("falls back to item length when favorites count is missing", async () => {
    const favoritesFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { items: [sampleEntry], count: "unknown" },
        }),
        { status: 200 },
      ),
    );

    const favorites = await listWorkspaceFavoriteEntries({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: favoritesFetch,
    });

    expect(favorites.count).toBe(1);
  });

  it("throws when favorites response is malformed", async () => {
    const favoritesFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { items: "not-an-array" },
        }),
        { status: 200 },
      ),
    );

    await expect(
      listWorkspaceFavoriteEntries({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        fetchImpl: favoritesFetch,
      }),
    ).rejects.toThrow("Invalid favorite content entries response");
  });

  it("throws when favorite entries request fails", async () => {
    const favoritesFetch = vi.fn().mockResolvedValue(
      new Response("nope", {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    await expect(
      listWorkspaceFavoriteEntries({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        fetchImpl: favoritesFetch,
      }),
    ).rejects.toThrow(
      "Failed to load favorite content entries: HTTP 503 Service Unavailable",
    );
  });

  it("throws when favorite toggle response is invalid", async () => {
    const favoriteFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { entryId: "entry-1", isFavorite: "yes" },
        }),
        { status: 200 },
      ),
    );

    await expect(
      toggleWorkspaceEntryFavorite({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        accessToken: "jwt-token",
        fetchImpl: favoriteFetch,
      }),
    ).rejects.toThrow("Invalid content entry favorite response");
  });

  it("trims workspaceSlug before generating a share link", async () => {
    const shareFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { url: "/dashboard/acme/content/entry/entry-1/edit" },
        }),
        { status: 200 },
      ),
    );

    await generateWorkspaceEntryShareLink({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      entryId: "entry-1",
      workspaceSlug: " acme ",
      accessToken: "jwt-token",
      fetchImpl: shareFetch,
    });

    expect(shareFetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content/entries/entry-1/share-link",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ workspaceSlug: "acme" }),
      }),
    );
  });

  it("throws when workspaceSlug is blank while generating a share link", async () => {
    await expect(
      generateWorkspaceEntryShareLink({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        workspaceSlug: "   ",
        accessToken: "jwt-token",
        fetchImpl: vi.fn(),
      }),
    ).rejects.toThrow("Workspace slug is required");
  });

  it("throws when share-link generation response is invalid", async () => {
    const shareFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { url: "" },
        }),
        { status: 200 },
      ),
    );

    await expect(
      generateWorkspaceEntryShareLink({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        workspaceSlug: "acme",
        accessToken: "jwt-token",
        fetchImpl: shareFetch,
      }),
    ).rejects.toThrow("Invalid content entry share link response");
  });

  it("throws when share-link generation request fails", async () => {
    const shareFetch = vi.fn().mockResolvedValue(
      new Response("denied", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    await expect(
      generateWorkspaceEntryShareLink({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        entryId: "entry-1",
        workspaceSlug: "acme",
        accessToken: "jwt-token",
        fetchImpl: shareFetch,
      }),
    ).rejects.toThrow(
      "Failed to generate content entry share link: HTTP 403 Forbidden",
    );
  });
});
