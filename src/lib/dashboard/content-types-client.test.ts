import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listWorkspaceContentTypes,
  mapContentTypesToDirectoryNodes,
} from "./content-types-client";

describe("content-types-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads workspace content types with auth header and unwraps nested gateway envelopes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            ok: true,
            data: [
              {
                id: "ct-1",
                name: "Blog Post",
                slug: "blog-post",
                routeSegment: "blog",
                templateKey: "blog_post",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await listWorkspaceContentTypes({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/content-types",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: "ct-1",
        name: "Blog Post",
        routeSegment: "blog",
      }),
    ]);
  });

  it("fails closed when API payload shape is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: [{ id: "ct-1" }] }), {
        status: 200,
      }),
    );

    await expect(
      listWorkspaceContentTypes({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid content types response/);
  });

  it("returns empty content types list for 404 to keep dashboard resilient before route seeding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), {
        status: 404,
        statusText: "Not Found",
      }),
    );

    const result = await listWorkspaceContentTypes({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(result).toEqual([]);
  });

  it("maps content types into dashboard nodes using routeSegment as path source of truth", () => {
    const nodes = mapContentTypesToDirectoryNodes([
      {
        id: "ct-1",
        name: "Blog Post",
        slug: "blog-post",
        routeSegment: "blog",
        templateKey: "blog_post",
      },
    ]);

    expect(nodes).toEqual([
      {
        id: "content-type-ct-1",
        label: "Blog Post",
        pathSegment: "blog",
        children: [],
      },
    ]);
  });
});
