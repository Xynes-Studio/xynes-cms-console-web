import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceContentDirectory,
  listWorkspaceContentDirectories,
} from "./content-directories-client";

describe("content-directories-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists workspace content directories and unwraps nested gateway envelopes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            ok: true,
            data: [
              {
                id: "dir-1",
                parentId: null,
                name: "Docs",
                pathSegment: "docs",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await listWorkspaceContentDirectories({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content-directories",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
    expect(result).toEqual([
      {
        id: "dir-1",
        parentId: null,
        name: "Docs",
        pathSegment: "docs",
      },
    ]);
  });

  it("creates a workspace content directory with auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: "dir-1",
            parentId: null,
            name: "Docs",
            pathSegment: "docs",
          },
        }),
        { status: 201 },
      ),
    );

    const result = await createWorkspaceContentDirectory({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      name: "Docs",
      parentId: null,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content-directories",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer jwt-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          parentId: null,
          name: "Docs",
        }),
      }),
    );
    expect(result).toEqual({
      id: "dir-1",
      parentId: null,
      name: "Docs",
      pathSegment: "docs",
    });
  });

  it("fails closed for malformed responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: [{ id: "dir-1" }] }), {
        status: 200,
      }),
    );

    await expect(
      listWorkspaceContentDirectories({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid content directories response/);
  });
});
