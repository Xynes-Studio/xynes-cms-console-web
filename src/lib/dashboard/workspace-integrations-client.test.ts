import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCmsWorkspaceIntegrationStatus,
  UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS,
} from "./workspace-integrations-client";

const EXPECTED_STATUS_KEYS = [
  "verifiedDomainCount",
  "pendingDomainCount",
  "activeApiKeyCount",
  "cmsScopedApiKeyCount",
  "unavailable",
] as const;

describe("fetchCmsWorkspaceIntegrationStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches workspace domains and api keys and collapses them into counts", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                { id: "d-1", hostname: "a.example", status: "verified" },
                { id: "d-2", hostname: "b.example", status: "verified" },
                { id: "d-3", hostname: "c.example", status: "pending" },
                { id: "d-4", hostname: "d.example", status: "failed" },
                { id: "d-5", hostname: "e.example", status: "disabled" },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "k-1",
                  status: "active",
                  presetKey: "cms_readonly",
                  scopes: ["cms.content.listPublished"],
                },
                {
                  id: "k-2",
                  status: "active",
                  presetKey: "cms_publisher",
                  scopes: ["cms.entry.publish"],
                },
                {
                  id: "k-3",
                  status: "active",
                  presetKey: "telemetry_read",
                  scopes: ["telemetry.events.listRecentForWorkspace"],
                },
                {
                  id: "k-4",
                  status: "revoked",
                  presetKey: "cms_readonly",
                  scopes: ["cms.content.listPublished"],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/domains",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/workspace-1/api-keys",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer jwt-token",
        }),
      }),
    );

    expect(status).toEqual({
      verifiedDomainCount: 2,
      pendingDomainCount: 1,
      activeApiKeyCount: 3,
      cmsScopedApiKeyCount: 2,
      unavailable: false,
    });
  });

  it("unwraps nested gateway envelopes for both endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: {
                ok: true,
                data: [
                  { id: "d-1", hostname: "a.example", status: "verified" },
                ],
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: {
                ok: true,
                data: [],
              },
            }),
            { status: 200 },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.verifiedDomainCount).toBe(1);
    expect(status.activeApiKeyCount).toBe(0);
    expect(status.unavailable).toBe(false);
  });

  it("counts cms-scoped api keys by either preset key or scope prefix", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                // Counts via scope prefix even with no preset
                {
                  id: "k-a",
                  status: "active",
                  presetKey: null,
                  scopes: ["cms.entry.create"],
                },
                // Counts via preset even when preset uses a non-cms label
                {
                  id: "k-b",
                  status: "active",
                  presetKey: "cms_readonly",
                  scopes: [],
                },
                // Does not count: revoked
                {
                  id: "k-c",
                  status: "revoked",
                  presetKey: "cms_readonly",
                  scopes: ["cms.entry.create"],
                },
                // Does not count: no cms scope and non-cms preset
                {
                  id: "k-d",
                  status: "active",
                  presetKey: "telemetry_read",
                  scopes: ["telemetry.events.listRecentForWorkspace"],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.activeApiKeyCount).toBe(3);
    expect(status.cmsScopedApiKeyCount).toBe(2);
  });

  it("never exposes raw key material from api-keys responses", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "k-1",
                  status: "active",
                  presetKey: "cms_readonly",
                  scopes: ["cms.content.listPublished"],
                  // These should never be returned by gateway, but if they are
                  // present they must NOT leak into the panel result.
                  rawKey: "xynes_live_LEAKED",
                  keyHash: "argon2id$LEAKED",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("LEAKED");
    expect(serialized).not.toContain("rawKey");
    expect(serialized).not.toContain("keyHash");
    expect(Object.keys(status)).toEqual(
      expect.arrayContaining(EXPECTED_STATUS_KEYS),
    );
  });

  it("returns unavailable status when domains request fails with HTTP error", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(new Response("server error", { status: 500 }));
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status).toEqual({
      verifiedDomainCount: 0,
      pendingDomainCount: 0,
      activeApiKeyCount: 0,
      cmsScopedApiKeyCount: 0,
      unavailable: true,
    });
  });

  it("returns unavailable status when api keys request fails with HTTP error", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(new Response("forbidden", { status: 403 }));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.unavailable).toBe(true);
  });

  it("returns unavailable status when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.unavailable).toBe(true);
  });

  it("returns unavailable status when domains response is malformed", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: "not-an-array" }), {
            status: 200,
          }),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.unavailable).toBe(true);
  });

  it("returns unavailable status when api keys response is malformed", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: { not: "array" } }), {
            status: 200,
          }),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.unavailable).toBe(true);
  });

  it("treats missing required inputs by failing closed to unavailable", async () => {
    const fetchMock = vi.fn();

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(status.unavailable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an AbortSignal to fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      });

    const controller = new AbortController();
    await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
      signal: controller.signal,
    });
  });

  it("exposes a frozen UNAVAILABLE sentinel with exactly the documented keys", () => {
    expect(Object.isFrozen(UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS)).toBe(
      true,
    );
    expect(UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS).toEqual({
      verifiedDomainCount: 0,
      pendingDomainCount: 0,
      activeApiKeyCount: 0,
      cmsScopedApiKeyCount: 0,
      unavailable: true,
    });
    expect(
      Object.keys(UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS).sort(),
    ).toEqual([...EXPECTED_STATUS_KEYS].sort());
  });

  it("returns an object whose keys are exactly the documented status contract on success", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "d-1",
                  hostname: "a.example",
                  status: "verified",
                  // Hostile fields below MUST NOT bleed through into the result.
                  rawKey: "xynes_live_LEAKED",
                  keyHash: "argon2id$LEAKED",
                  internalAuditNote: "DO NOT EXPOSE",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "k-1",
                  status: "active",
                  presetKey: "cms_readonly",
                  scopes: ["cms.content.listPublished"],
                  rawKey: "xynes_live_LEAKED",
                  keyHash: "argon2id$LEAKED",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    // Contract: keys are exactly the five documented fields, no more.
    expect(Object.keys(status).sort()).toEqual(
      [...EXPECTED_STATUS_KEYS].sort(),
    );

    // Belt-and-suspenders: the serialized payload contains nothing from the
    // hostile upstream rows.
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("LEAKED");
    expect(serialized).not.toContain("rawKey");
    expect(serialized).not.toContain("keyHash");
    expect(serialized).not.toContain("internalAuditNote");
  });

  it("tolerates individual malformed rows in a valid array (does NOT promote to unavailable)", async () => {
    // Contract: per-row tolerance for list-aggregate endpoints.
    // - The fail-closed contract triggers on PAYLOAD-level failures
    //   (HTTP error, non-array body, normalize error, thrown fetch).
    // - Per-row guard misses are SKIPPED and counted around, NOT
    //   promoted to "unavailable", because the result is constructed
    //   from explicit integer counters this function builds itself.
    //   Hostile/malformed row data cannot bleed through (covered by
    //   the "documented-keys-only" test above).
    // - Strict per-row fail-closed would create a forward-compatibility
    //   footgun: a single transient garbage row, or a future Workspace
    //   Admin row variant with a new optional column, would hide every
    //   other valid row from the CMS integrations panel.
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/domains")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                // valid
                { id: "d-1", hostname: "a.example", status: "verified" },
                // malformed: not a record
                "garbage-string",
                // malformed: missing status
                { id: "d-2", hostname: "b.example" },
                // malformed: empty status
                { id: "d-3", hostname: "c.example", status: "" },
                // malformed: null
                null,
                // valid
                { id: "d-4", hostname: "d.example", status: "pending" },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/api-keys")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                // valid + active + cms-scoped
                {
                  id: "k-1",
                  status: "active",
                  presetKey: "cms_readonly",
                  scopes: ["cms.content.listPublished"],
                },
                // malformed: not a record
                42,
                // malformed: missing status
                { id: "k-2", presetKey: "cms_readonly" },
                // valid + active + non-cms
                {
                  id: "k-3",
                  status: "active",
                  presetKey: "telemetry_read",
                  scopes: ["telemetry.events.listRecentForWorkspace"],
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const status = await fetchCmsWorkspaceIntegrationStatus({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: "workspace-1",
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    // The whole call must NOT be unavailable just because individual rows
    // were malformed — the array itself was valid.
    expect(status.unavailable).toBe(false);

    // Only the valid rows are counted; malformed rows are skipped silently.
    expect(status.verifiedDomainCount).toBe(1);
    expect(status.pendingDomainCount).toBe(1);
    expect(status.activeApiKeyCount).toBe(2);
    expect(status.cmsScopedApiKeyCount).toBe(1);
  });
});
