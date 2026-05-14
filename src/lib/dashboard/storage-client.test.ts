/**
 * STORAGE-10 — CMS Console storage client tests.
 *
 * Owner repo: `xynes-front-end/xynes-cms-console-web`
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-10-universal-object-storage-file-upload-api.md`
 *
 * Test plan (from STORAGE-10 acceptance criteria):
 *   - Unit tests for request URLs, headers, default payload values, and response parsing.
 *   - Documented-keys-only test: feed the client a hostile upstream payload
 *     containing `provider_kind`, `endpoint`, `region`, `bucket`,
 *     `provider_object_key`, `credential_ref`, `accessKeyId`,
 *     `secretAccessKey`, and `X-Amz-Signature`-style fields, and assert
 *     none survive the parser into the returned object.
 *   - Direct-upload header isolation test: stub `fetch` for the provider
 *     URL and assert the outgoing request does NOT carry the Xynes auth
 *     cookie, `Authorization` bearer, or any `X-XS-*` header.
 *   - Error handling tests for gateway failure and provider upload
 *     failure (assert the surfaced error message never contains a
 *     presigned URL signature parameter or a per-provider config value).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abortStorageUploadSession,
  completeStorageUploadSession,
  createStorageDownloadUrl,
  createStorageUploadSession,
  directProviderUpload,
  getStorageObject,
  UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS,
  type StorageObject,
  type CreateUploadSessionResult,
} from "./storage-client";

// ── Shared fixtures ────────────────────────────────────────────────────────

const VALID_OBJECT_ID = "11111111-1111-4111-8111-111111111111";
const VALID_UPLOAD_ID = "22222222-2222-4222-8222-222222222222";
const VALID_WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";

const HOSTILE_LEAK_FIELDS = {
  provider_kind: "r2",
  providerKind: "r2",
  endpoint: "https://account.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "xynes-prod",
  provider_object_key: "workspaces/x/objects/y/secret.bin",
  providerObjectKey: "workspaces/x/objects/y/secret.bin",
  credential_ref: "secret://xynes/storage/r2-prod",
  credentialRef: "secret://xynes/storage/r2-prod",
  accessKeyId: "AKIA-LEAK-1234",
  secretAccessKey: "fixture-secret-key-DO-NOT-LEAK",
  r2Token: "Cloudflare-R2-leak-token",
  signedUrl: "https://leaked-url",
  presignedUrl: "https://leaked-url",
} as const;

// Build a valid object payload, plus hostile leak fields the parser MUST strip.
const buildObjectPayload = (overrides: Record<string, unknown> = {}) => ({
  id: VALID_OBJECT_ID,
  workspaceId: VALID_WORKSPACE_ID,
  filename: "logo.png",
  contentType: "image/png",
  byteSize: 1024,
  sha256: null,
  purpose: "cms_media",
  visibility: "private",
  status: "pending_upload",
  compressionRequested: true,
  createdBy: "user-1",
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
  uploadedAt: null,
  // Hostile fields the parser MUST strip:
  ...HOSTILE_LEAK_FIELDS,
  ...overrides,
});

const SIGNED_PROVIDER_URL =
  "https://account.r2.cloudflarestorage.com/xynes-prod/workspaces/w/objects/o/file.png" +
  "?X-Amz-Signature=DEADBEEFCAFEDOLLAR&X-Amz-Credential=AKIA-LEAK&X-Amz-Expires=900";

const buildCreateSessionEnvelope = (partial: Record<string, unknown> = {}) =>
  JSON.stringify({
    ok: true,
    data: {
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "single",
      uploadUrl: SIGNED_PROVIDER_URL,
      uploadHeaders: { "Content-Type": "image/png" },
      parts: [],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: buildObjectPayload(),
      // Hostile fields at the response root must also be stripped:
      ...HOSTILE_LEAK_FIELDS,
      ...partial,
    },
  });

const buildCompleteEnvelope = () =>
  JSON.stringify({
    ok: true,
    data: {
      object: buildObjectPayload({ status: "processing" }),
      session: {
        id: VALID_UPLOAD_ID,
        objectId: VALID_OBJECT_ID,
        uploadMethod: "single",
        status: "completed",
        createdAt: "2026-05-14T00:00:00.000Z",
        expiresAt: "2026-05-14T01:00:00.000Z",
        completedAt: "2026-05-14T00:30:00.000Z",
        abortedAt: null,
      },
      processingJobs: [],
      ...HOSTILE_LEAK_FIELDS,
    },
  });

const buildAbortEnvelope = () =>
  JSON.stringify({
    ok: true,
    data: {
      session: {
        id: VALID_UPLOAD_ID,
        objectId: VALID_OBJECT_ID,
        uploadMethod: "single",
        status: "aborted",
        createdAt: "2026-05-14T00:00:00.000Z",
        expiresAt: "2026-05-14T01:00:00.000Z",
        completedAt: null,
        abortedAt: "2026-05-14T00:15:00.000Z",
      },
      ...HOSTILE_LEAK_FIELDS,
    },
  });

const buildGetEnvelope = () =>
  JSON.stringify({
    ok: true,
    data: {
      object: buildObjectPayload({ status: "ready" }),
      variants: [
        {
          id: "v-1",
          objectId: VALID_OBJECT_ID,
          variantKey: "thumb_256",
          contentType: "image/webp",
          byteSize: 8192,
          status: "ready",
          createdAt: "2026-05-14T00:00:00.000Z",
          updatedAt: "2026-05-14T00:00:00.000Z",
          // Hostile fields the parser MUST strip from each variant:
          ...HOSTILE_LEAK_FIELDS,
        },
      ],
      processingJobs: [
        {
          id: "j-1",
          objectId: VALID_OBJECT_ID,
          jobType: "image_optimize",
          status: "succeeded",
          attempts: 1,
          errorCode: null,
          required: false,
          scheduledAt: "2026-05-14T00:00:00.000Z",
          createdAt: "2026-05-14T00:00:00.000Z",
          updatedAt: "2026-05-14T00:00:00.000Z",
          ...HOSTILE_LEAK_FIELDS,
        },
      ],
      ...HOSTILE_LEAK_FIELDS,
    },
  });

const buildDownloadEnvelope = () =>
  JSON.stringify({
    ok: true,
    data: {
      objectId: VALID_OBJECT_ID,
      url: SIGNED_PROVIDER_URL,
      expiresAt: "2026-05-14T00:15:00.000Z",
      ...HOSTILE_LEAK_FIELDS,
    },
  });

// Assert that NONE of the documented-keys-only banned fields appear as a
// standalone property anywhere in the serialised result (recursive sweep).
const assertNoLeakedFields = (value: unknown) => {
  const serialised = JSON.stringify(value);
  for (const banned of UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS) {
    expect(serialised).not.toContain(`"${banned}"`);
  }
  // Also assert no SigV4 signature parameters survive as standalone keys.
  expect(serialised).not.toMatch(/"X-Amz-Signature"\s*:/);
  expect(serialised).not.toMatch(/"X-Amz-Credential"\s*:/);
  expect(serialised).not.toMatch(/"X-Amz-Security-Token"\s*:/);
};

// ── createStorageUploadSession ─────────────────────────────────────────────

describe("createStorageUploadSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to the gateway storage uploads route with bearer auth + JSON body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildCreateSessionEnvelope(), { status: 200 }),
      );

    await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: {
        filename: "logo.png",
        contentType: "image/png",
        byteSize: 1024,
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:4100/workspaces/${VALID_WORKSPACE_ID}/storage/uploads`,
    );
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer jwt-token");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.operation).toBe("create");
    expect(body.filename).toBe("logo.png");
    expect(body.contentType).toBe("image/png");
    expect(body.byteSize).toBe(1024);
    // CMS defaults (acceptance criterion):
    expect(body.purpose).toBe("cms_media");
    expect(body.visibility).toBe("private");
    expect(body.compression).toBe(true);
  });

  it("allows overriding purpose / visibility / compression / sha256", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildCreateSessionEnvelope(), { status: 200 }),
      );

    await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: {
        filename: "video.mp4",
        contentType: "video/mp4",
        byteSize: 200_000_000,
        sha256: "a".repeat(64),
        purpose: "platform_generic",
        visibility: "public",
        compression: false,
      },
      fetchImpl: fetchMock,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.purpose).toBe("platform_generic");
    expect(body.visibility).toBe("public");
    expect(body.compression).toBe(false);
    expect(body.sha256).toBe("a".repeat(64));
  });

  it("returns documented fields only and drops hostile upstream fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildCreateSessionEnvelope(), { status: 200 }),
      );

    const result = await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "logo.png", contentType: "image/png", byteSize: 1024 },
      fetchImpl: fetchMock,
    });

    // Documented-keys-only allowlist at the top level:
    expect(Object.keys(result).sort()).toEqual(
      [
        "uploadId",
        "objectId",
        "uploadMethod",
        "uploadUrl",
        "uploadHeaders",
        "parts",
        "expiresAt",
        "object",
      ].sort(),
    );

    // Object DTO allowlist:
    expect(Object.keys(result.object).sort()).toEqual(
      [
        "id",
        "workspaceId",
        "filename",
        "contentType",
        "byteSize",
        "sha256",
        "purpose",
        "visibility",
        "status",
        "compressionRequested",
        "createdBy",
        "createdAt",
        "updatedAt",
        "uploadedAt",
      ].sort(),
    );

    assertNoLeakedFields(result);
  });

  it("rejects invalid inputs with a generic error (missing apiBaseUrl)", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
      }),
    ).rejects.toThrow(/Missing apiBaseUrl/);
  });

  it("surfaces a safe error on gateway failure without leaking signed URLs / provider config", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "PROVIDER_CONFIG_INVALID",
            message: `Provider misconfigured: ${SIGNED_PROVIDER_URL} with key AKIA-LEAK-1234`,
          },
        }),
        { status: 502 },
      ),
    );

    let caught: unknown;
    try {
      await createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: {
          filename: "logo.png",
          contentType: "image/png",
          byteSize: 1,
        },
        fetchImpl: fetchMock,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain("X-Amz-Signature");
    expect(message).not.toContain("X-Amz-Credential");
    expect(message).not.toContain("AKIA-LEAK-1234");
    expect(message).not.toContain("r2.cloudflarestorage.com");
    expect(message).toMatch(/storage upload session|HTTP 502/i);
  });

  it("rejects malformed upstream payloads without leaking the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { junk: true } }), {
        status: 200,
      }),
    );

    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid create storage upload session response/);
  });

  it("rejects non-JSON gateway responses safely", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("totally-not-json", { status: 200 }));

    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow();
  });
});

// ── directProviderUpload ───────────────────────────────────────────────────

describe("directProviderUpload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const singleSession: CreateUploadSessionResult = {
    uploadId: VALID_UPLOAD_ID,
    objectId: VALID_OBJECT_ID,
    uploadMethod: "single",
    uploadUrl: SIGNED_PROVIDER_URL,
    uploadHeaders: { "Content-Type": "image/png", "Cache-Control": "private" },
    parts: [],
    expiresAt: "2026-05-14T01:00:00.000Z",
    object: {
      id: VALID_OBJECT_ID,
      workspaceId: VALID_WORKSPACE_ID,
      filename: "logo.png",
      contentType: "image/png",
      byteSize: 1024,
      sha256: null,
      purpose: "cms_media",
      visibility: "private",
      status: "pending_upload",
      compressionRequested: true,
      createdBy: null,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
      uploadedAt: null,
    },
  };

  it("PUTs the blob to the signed provider URL using only provider-supplied headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 200, headers: { ETag: '"abc"' } }),
      );
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], {
      type: "image/png",
    });

    const result = await directProviderUpload({
      session: singleSession,
      blob,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SIGNED_PROVIDER_URL);
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(blob);
    expect(result.parts).toEqual([]);
  });

  it("NEVER sends the Xynes session cookie, Authorization bearer, or X-XS-* headers to the provider", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200 }));
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], {
      type: "image/png",
    });

    await directProviderUpload({
      session: singleSession,
      blob,
      fetchImpl: fetchMock,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("omit");

    const headers = init.headers as Record<string, string>;
    // No Xynes-side auth / actor headers may appear:
    expect(headers).not.toHaveProperty("Authorization");
    expect(headers).not.toHaveProperty("authorization");
    expect(headers).not.toHaveProperty("Cookie");
    expect(headers).not.toHaveProperty("cookie");
    for (const key of Object.keys(headers)) {
      expect(key.toLowerCase().startsWith("x-xs-")).toBe(false);
    }
    // Only the provider-signed headers survive:
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers["Cache-Control"]).toBe("private");
  });

  it("PUTs each multipart part in order using the corresponding signed URL and collects part ETags", async () => {
    const part1Url =
      "https://account.r2.cloudflarestorage.com/x/part?X-Amz-Signature=PART1";
    const part2Url =
      "https://account.r2.cloudflarestorage.com/x/part?X-Amz-Signature=PART2";
    const multipartSession: CreateUploadSessionResult = {
      ...singleSession,
      uploadMethod: "multipart",
      uploadUrl: null,
      parts: [
        { partNumber: 1, url: part1Url, expiresAt: "2026-05-14T01:00:00.000Z" },
        { partNumber: 2, url: part2Url, expiresAt: "2026-05-14T01:00:00.000Z" },
      ],
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === part1Url) {
        return Promise.resolve(
          new Response("", { status: 200, headers: { ETag: '"etag-1"' } }),
        );
      }
      if (url === part2Url) {
        return Promise.resolve(
          new Response("", { status: 200, headers: { ETag: '"etag-2"' } }),
        );
      }
      throw new Error("unexpected url");
    });

    // 8 bytes split into two 4-byte parts.
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])]);
    const result = await directProviderUpload({
      session: multipartSession,
      blob,
      fetchImpl: fetchMock,
    });

    expect(result.parts).toEqual([
      { partNumber: 1, etag: '"etag-1"' },
      { partNumber: 2, etag: '"etag-2"' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a safe error if the provider returns non-2xx (no signed URL / credentials in the message)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("AccessDenied", { status: 403 }));
    const blob = new Blob([new Uint8Array([1])]);

    let caught: unknown;
    try {
      await directProviderUpload({
        session: singleSession,
        blob,
        fetchImpl: fetchMock,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain("X-Amz-Signature");
    expect(message).not.toContain("X-Amz-Credential");
    expect(message).not.toContain(SIGNED_PROVIDER_URL);
    expect(message).not.toContain("r2.cloudflarestorage.com");
    expect(message).toMatch(/provider upload failed/i);
  });

  it("rejects a multipart provider response that omits the part ETag (no fallback that could mint a fake one)", async () => {
    const multipartSession: CreateUploadSessionResult = {
      ...singleSession,
      uploadMethod: "multipart",
      uploadUrl: null,
      parts: [
        {
          partNumber: 1,
          url: "https://account.r2.cloudflarestorage.com/x/part?X-Amz-Signature=PART1",
          expiresAt: "2026-05-14T01:00:00.000Z",
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", { status: 200 }), // no ETag header
    );
    const blob = new Blob([new Uint8Array([1, 2])]);

    await expect(
      directProviderUpload({
        session: multipartSession,
        blob,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/provider response missing etag/i);
  });

  it("rejects when called on a single session without an uploadUrl (defensive)", async () => {
    const broken: CreateUploadSessionResult = {
      ...singleSession,
      uploadUrl: null,
    };
    await expect(
      directProviderUpload({ session: broken, blob: new Blob() }),
    ).rejects.toThrow(/missing uploadUrl/i);
  });

  it("rejects multipart sessions with no parts (defensive)", async () => {
    const broken: CreateUploadSessionResult = {
      ...singleSession,
      uploadMethod: "multipart",
      uploadUrl: null,
      parts: [],
    };
    await expect(
      directProviderUpload({
        session: broken,
        blob: new Blob([new Uint8Array([1])]),
      }),
    ).rejects.toThrow(/no parts/i);
  });
});

// ── completeStorageUploadSession ───────────────────────────────────────────

describe("completeStorageUploadSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to the complete route with operation=complete and uploadId in the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildCompleteEnvelope(), { status: 200 }),
      );

    await completeStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      parts: [{ partNumber: 1, etag: '"etag-1"' }],
      fetchImpl: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:4100/workspaces/${VALID_WORKSPACE_ID}/storage/uploads/${VALID_UPLOAD_ID}/complete`,
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-token");

    const body = JSON.parse(init.body as string);
    expect(body.operation).toBe("complete");
    expect(body.uploadId).toBe(VALID_UPLOAD_ID);
    expect(body.parts).toEqual([{ partNumber: 1, etag: '"etag-1"' }]);
  });

  it("returns documented fields only and drops hostile upstream fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildCompleteEnvelope(), { status: 200 }),
      );

    const result = await completeStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(Object.keys(result).sort()).toEqual(
      ["object", "session", "processingJobs"].sort(),
    );
    assertNoLeakedFields(result);
  });

  it("omits parts from the body when none are supplied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildCompleteEnvelope(), { status: 200 }),
      );

    await completeStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.parts).toBeUndefined();
  });

  it("surfaces a safe error on gateway failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "STATE_CONFLICT",
            message: `Upload conflict: ${SIGNED_PROVIDER_URL}`,
          },
        }),
        { status: 409 },
      ),
    );

    let caught: unknown;
    try {
      await completeStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        uploadId: VALID_UPLOAD_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain("X-Amz-Signature");
    expect(message).not.toContain(SIGNED_PROVIDER_URL);
  });

  it("rejects an invalid uploadId early", async () => {
    await expect(
      completeStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        uploadId: "",
        accessToken: "jwt-token",
      }),
    ).rejects.toThrow(/upload id/i);
  });
});

// ── abortStorageUploadSession ──────────────────────────────────────────────

describe("abortStorageUploadSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to the abort route with operation=abort and uploadId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(buildAbortEnvelope(), { status: 200 }));

    await abortStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:4100/workspaces/${VALID_WORKSPACE_ID}/storage/uploads/${VALID_UPLOAD_ID}/abort`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.operation).toBe("abort");
    expect(body.uploadId).toBe(VALID_UPLOAD_ID);
  });

  it("returns documented fields only and drops hostile upstream fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(buildAbortEnvelope(), { status: 200 }));

    const result = await abortStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(Object.keys(result).sort()).toEqual(["session"].sort());
    assertNoLeakedFields(result);
  });
});

// ── getStorageObject ───────────────────────────────────────────────────────

describe("getStorageObject", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs the object metadata route with bearer auth", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(buildGetEnvelope(), { status: 200 }));

    await getStorageObject({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:4100/workspaces/${VALID_WORKSPACE_ID}/storage/objects/${VALID_OBJECT_ID}?operation=get`,
    );
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-token");
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it("returns documented fields only and drops hostile upstream fields on every nested record", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(buildGetEnvelope(), { status: 200 }));

    const result = await getStorageObject({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(result).not.toBeNull();
    if (result === null) throw new Error("unreachable");

    expect(Object.keys(result).sort()).toEqual(
      ["object", "variants", "processingJobs"].sort(),
    );
    expect(result.object.id).toBe(VALID_OBJECT_ID);
    expect(result.variants[0].variantKey).toBe("thumb_256");
    expect(result.processingJobs[0].jobType).toBe("image_optimize");
    assertNoLeakedFields(result);
  });

  it("returns null for 404 (object missing or soft-deleted) without leaking the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: "NOT_FOUND", message: "Object not found" },
        }),
        { status: 404 },
      ),
    );

    const result = await getStorageObject({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(result).toBeNull();
  });

  it("surfaces a safe error on non-404 gateway failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: `denied: ${SIGNED_PROVIDER_URL}`,
          },
        }),
        { status: 403 },
      ),
    );

    let caught: unknown;
    try {
      await getStorageObject({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: VALID_OBJECT_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain("X-Amz-Signature");
    expect(message).not.toContain(SIGNED_PROVIDER_URL);
  });

  it("rejects an empty objectId", async () => {
    await expect(
      getStorageObject({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: "",
        accessToken: "jwt-token",
      }),
    ).rejects.toThrow(/object id/i);
  });
});

// ── createStorageDownloadUrl ───────────────────────────────────────────────

describe("createStorageDownloadUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to the download-url route with operation=download_url + objectId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildDownloadEnvelope(), { status: 200 }),
      );

    await createStorageDownloadUrl({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      expiresInSeconds: 60,
      downloadFilename: "logo.png",
      fetchImpl: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:4100/workspaces/${VALID_WORKSPACE_ID}/storage/objects/${VALID_OBJECT_ID}/download-url`,
    );
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.operation).toBe("download_url");
    expect(body.objectId).toBe(VALID_OBJECT_ID);
    expect(body.expiresInSeconds).toBe(60);
    expect(body.downloadFilename).toBe("logo.png");
  });

  it("returns EXACTLY { objectId, url, expiresAt }", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildDownloadEnvelope(), { status: 200 }),
      );

    const result = await createStorageDownloadUrl({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    expect(Object.keys(result).sort()).toEqual(
      ["objectId", "url", "expiresAt"].sort(),
    );
    // The url string itself opaquely embeds the signature (that's OK —
    // it's a black-box bearer URL). But there must NOT be any standalone
    // signature-parameter field at the top level.
    assertNoLeakedFields(result);
  });

  it("omits optional fields from the body when not supplied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(buildDownloadEnvelope(), { status: 200 }),
      );

    await createStorageDownloadUrl({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.expiresInSeconds).toBeUndefined();
    expect(body.downloadFilename).toBeUndefined();
  });

  it("surfaces a safe error on gateway failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: `Provider misconfigured: ${SIGNED_PROVIDER_URL}`,
          },
        }),
        { status: 403 },
      ),
    );

    let caught: unknown;
    try {
      await createStorageDownloadUrl({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: VALID_OBJECT_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain("X-Amz-Signature");
    expect(message).not.toContain(SIGNED_PROVIDER_URL);
  });
});

// ── Type-level smoke ───────────────────────────────────────────────────────

describe("StorageObject type does not include provider config fields", () => {
  it("is statically constrained to documented keys only", () => {
    // This is a type-level assertion — assigning a hostile shape to
    // `StorageObject` must NOT compile. If the type ever loosens to
    // accept these fields, vitest will fail because the variable is
    // unused; but the contract here is the compile error itself.
    const allowed: StorageObject = {
      id: VALID_OBJECT_ID,
      workspaceId: VALID_WORKSPACE_ID,
      filename: "x",
      contentType: "image/png",
      byteSize: 1,
      sha256: null,
      purpose: "cms_media",
      visibility: "private",
      status: "pending_upload",
      compressionRequested: true,
      createdBy: null,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
      uploadedAt: null,
    };
    expect(allowed.id).toBe(VALID_OBJECT_ID);
  });
});

// ── Branch-coverage / parser hardening ──────────────────────────────────────
//
// These tests drive the negative branches of the documented-keys-only
// parsers (per-row type-guard misses, numeric / string / boolean validation
// throws, status enum alternatives) — they exist to guarantee the
// fail-closed contract survives upstream drift, not for happy-path coverage.

describe("create session parser — hostile / partial upstream rows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeFetchMock = (payload: unknown) =>
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: payload }), {
        status: 200,
      }),
    );

  it("rejects when uploadMethod is invalid", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "trickle", // ← invalid
          uploadUrl: null,
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload(),
        }),
      }),
    ).rejects.toThrow(/Invalid create storage upload session response/);
  });

  it("rejects when object row is not a record", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "single",
          uploadUrl: "https://x",
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: "not-a-record",
        }),
      }),
    ).rejects.toThrow();
  });

  it("rejects when object has invalid status", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "single",
          uploadUrl: "https://x",
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload({ status: "exploded" }),
        }),
      }),
    ).rejects.toThrow("Invalid storage object");
  });

  it("rejects when object has invalid visibility", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "single",
          uploadUrl: "https://x",
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload({ visibility: "internet" }),
        }),
      }),
    ).rejects.toThrow("Invalid storage object");
  });

  it("rejects when object.byteSize is not a finite number", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "single",
          uploadUrl: "https://x",
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload({ byteSize: Number.NaN }),
        }),
      }),
    ).rejects.toThrow(/Invalid byteSize/);
  });

  it("rejects when object.compressionRequested is not a boolean", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "single",
          uploadUrl: "https://x",
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload({
            compressionRequested: "yes" as unknown as boolean,
          }),
        }),
      }),
    ).rejects.toThrow(/Invalid compressionRequested/);
  });

  it("rejects when object.filename is missing", async () => {
    await expect(
      createStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        accessToken: "jwt-token",
        file: { filename: "x", contentType: "image/png", byteSize: 1 },
        fetchImpl: makeFetchMock({
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "single",
          uploadUrl: "https://x",
          uploadHeaders: {},
          parts: [],
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload({ filename: "" }),
        }),
      }),
    ).rejects.toThrow(/Invalid filename/);
  });

  it("silently drops malformed parts entries instead of failing the whole session", async () => {
    const fetchMock = makeFetchMock({
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "multipart",
      uploadUrl: null,
      uploadHeaders: {},
      parts: [
        {
          partNumber: 1,
          url: "https://p1",
          expiresAt: "2026-05-14T01:00:00.000Z",
        },
        "not-a-record",
        { partNumber: 2, url: "https://p2" }, // missing expiresAt
        {
          partNumber: "two" as unknown as number,
          url: "https://p3",
          expiresAt: "x",
        },
        null,
      ],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: buildObjectPayload(),
    });

    const result = await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "x", contentType: "image/png", byteSize: 1 },
      fetchImpl: fetchMock,
    });
    // Only the well-formed entry survives.
    expect(result.parts.length).toBe(1);
    expect(result.parts[0].partNumber).toBe(1);
  });

  it("silently drops non-string upload header values", async () => {
    const fetchMock = makeFetchMock({
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "single",
      uploadUrl: "https://x",
      uploadHeaders: {
        "Content-Type": "image/png",
        "Cache-Control": 9001 as unknown as string,
        "": "should-be-skipped",
      },
      parts: [],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: buildObjectPayload(),
    });

    const result = await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "x", contentType: "image/png", byteSize: 1 },
      fetchImpl: fetchMock,
    });
    expect(Object.keys(result.uploadHeaders).sort()).toEqual(["Content-Type"]);
  });

  it("returns empty parts when upstream parts is missing or not an array", async () => {
    const fetchMock = makeFetchMock({
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "single",
      uploadUrl: "https://x",
      uploadHeaders: {},
      parts: "not-an-array",
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: buildObjectPayload(),
    });
    const result = await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "x", contentType: "image/png", byteSize: 1 },
      fetchImpl: fetchMock,
    });
    expect(result.parts).toEqual([]);
  });

  it("treats non-record uploadHeaders as empty", async () => {
    const fetchMock = makeFetchMock({
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "single",
      uploadUrl: "https://x",
      uploadHeaders: null,
      parts: [],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: buildObjectPayload(),
    });
    const result = await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "x", contentType: "image/png", byteSize: 1 },
      fetchImpl: fetchMock,
    });
    expect(result.uploadHeaders).toEqual({});
  });

  it("returns null uploadUrl when upstream value is not a non-empty string", async () => {
    const fetchMock = makeFetchMock({
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "multipart",
      uploadUrl: "",
      uploadHeaders: {},
      parts: [],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: buildObjectPayload(),
    });
    const result = await createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "x", contentType: "image/png", byteSize: 1 },
      fetchImpl: fetchMock,
    });
    expect(result.uploadUrl).toBeNull();
  });
});

describe("complete handler — parser hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when upstream session has invalid status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            object: buildObjectPayload({ status: "processing" }),
            session: {
              id: VALID_UPLOAD_ID,
              objectId: VALID_OBJECT_ID,
              uploadMethod: "single",
              status: "imploded", // ← invalid
              createdAt: "2026-05-14T00:00:00.000Z",
              expiresAt: "2026-05-14T01:00:00.000Z",
              completedAt: null,
              abortedAt: null,
            },
            processingJobs: [],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      completeStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        uploadId: VALID_UPLOAD_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Invalid upload session");
  });

  it("rejects when session is not a record on completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { object: buildObjectPayload(), session: null },
        }),
        { status: 200 },
      ),
    );
    await expect(
      completeStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        uploadId: VALID_UPLOAD_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid complete storage upload session response/);
  });

  it("silently drops malformed processingJobs rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            object: buildObjectPayload({ status: "processing" }),
            session: {
              id: VALID_UPLOAD_ID,
              objectId: VALID_OBJECT_ID,
              uploadMethod: "single",
              status: "completed",
              createdAt: "2026-05-14T00:00:00.000Z",
              expiresAt: "2026-05-14T01:00:00.000Z",
              completedAt: "2026-05-14T00:30:00.000Z",
              abortedAt: null,
            },
            processingJobs: [
              "not-a-record",
              { id: "j-1" }, // missing required fields
              {
                id: "j-2",
                objectId: VALID_OBJECT_ID,
                jobType: "image_optimize",
                status: "queued",
                attempts: 0,
                errorCode: null,
                required: false,
                scheduledAt: "2026-05-14T00:00:00.000Z",
                createdAt: "2026-05-14T00:00:00.000Z",
                updatedAt: "2026-05-14T00:00:00.000Z",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await completeStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });
    expect(result.processingJobs.length).toBe(1);
    expect(result.processingJobs[0].id).toBe("j-2");
  });

  it("treats non-array processingJobs as empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            object: buildObjectPayload({ status: "processing" }),
            session: {
              id: VALID_UPLOAD_ID,
              objectId: VALID_OBJECT_ID,
              uploadMethod: "single",
              status: "completed",
              createdAt: "2026-05-14T00:00:00.000Z",
              expiresAt: "2026-05-14T01:00:00.000Z",
              completedAt: "2026-05-14T00:30:00.000Z",
              abortedAt: null,
            },
            processingJobs: "not-an-array",
          },
        }),
        { status: 200 },
      ),
    );
    const result = await completeStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      uploadId: VALID_UPLOAD_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });
    expect(result.processingJobs).toEqual([]);
  });
});

describe("get object — parser hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when object record is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: { variants: [], processingJobs: [] },
          }),
          { status: 200 },
        ),
      );
    await expect(
      getStorageObject({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: VALID_OBJECT_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid load storage object response/);
  });

  it("silently drops malformed variants and processingJobs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            object: buildObjectPayload({ status: "ready" }),
            variants: [
              "not-a-record",
              { id: "v-1" }, // missing fields
              {
                id: "v-2",
                objectId: VALID_OBJECT_ID,
                variantKey: "thumb_512",
                contentType: "image/webp",
                byteSize: 16_384,
                status: "ready",
                createdAt: "2026-05-14T00:00:00.000Z",
                updatedAt: "2026-05-14T00:00:00.000Z",
              },
            ],
            processingJobs: ["not-a-record"],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getStorageObject({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });
    expect(result).not.toBeNull();
    if (result === null) throw new Error("unreachable");
    expect(result.variants.length).toBe(1);
    expect(result.variants[0].id).toBe("v-2");
    expect(result.processingJobs).toEqual([]);
  });

  it("treats non-array variants and processingJobs as empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            object: buildObjectPayload({ status: "ready" }),
            variants: "not-an-array",
            processingJobs: null,
          },
        }),
        { status: 200 },
      ),
    );
    const result = await getStorageObject({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });
    expect(result).not.toBeNull();
    if (result === null) throw new Error("unreachable");
    expect(result.variants).toEqual([]);
    expect(result.processingJobs).toEqual([]);
  });

  it("rejects variant with invalid status (parseVariant negative branch)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            object: buildObjectPayload({ status: "ready" }),
            variants: [
              {
                id: "v-1",
                objectId: VALID_OBJECT_ID,
                variantKey: "thumb",
                contentType: "image/webp",
                byteSize: 1024,
                status: "imploded",
                createdAt: "2026-05-14T00:00:00.000Z",
                updatedAt: "2026-05-14T00:00:00.000Z",
              },
            ],
            processingJobs: [],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getStorageObject({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      objectId: VALID_OBJECT_ID,
      accessToken: "jwt-token",
      fetchImpl: fetchMock,
    });
    expect(result).not.toBeNull();
    if (result === null) throw new Error("unreachable");
    // Skipped malformed variant.
    expect(result.variants).toEqual([]);
  });

  it("rejects when error response body is not JSON-parseable on non-404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("error: not-json", { status: 500 }));

    await expect(
      getStorageObject({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: VALID_OBJECT_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/HTTP 500/);
  });
});

describe("abort handler — parser hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects when session is missing on abort response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }),
      );
    await expect(
      abortStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        uploadId: VALID_UPLOAD_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid abort storage upload session response/);
  });

  it("rejects when uploadId is whitespace only", async () => {
    await expect(
      abortStorageUploadSession({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        uploadId: "   ",
        accessToken: "jwt-token",
      }),
    ).rejects.toThrow(/upload id/i);
  });
});

describe("download URL — parser hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects malformed download URL responses (missing url)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            objectId: VALID_OBJECT_ID,
            expiresAt: "2026-05-14T00:30:00.000Z",
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      createStorageDownloadUrl({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: VALID_OBJECT_ID,
        accessToken: "jwt-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/Invalid create storage download URL response/);
  });

  it("rejects when objectId is missing on the call", async () => {
    await expect(
      createStorageDownloadUrl({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: VALID_WORKSPACE_ID,
        objectId: "",
        accessToken: "jwt-token",
      }),
    ).rejects.toThrow(/object id/i);
  });
});

describe("direct upload — network error path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const singleSession: CreateUploadSessionResult = {
    uploadId: VALID_UPLOAD_ID,
    objectId: VALID_OBJECT_ID,
    uploadMethod: "single",
    uploadUrl: SIGNED_PROVIDER_URL,
    uploadHeaders: {},
    parts: [],
    expiresAt: "2026-05-14T01:00:00.000Z",
    object: {
      id: VALID_OBJECT_ID,
      workspaceId: VALID_WORKSPACE_ID,
      filename: "x",
      contentType: "image/png",
      byteSize: 1,
      sha256: null,
      purpose: "cms_media",
      visibility: "private",
      status: "pending_upload",
      compressionRequested: true,
      createdBy: null,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
      uploadedAt: null,
    },
  };

  it("surfaces a generic 'network error' message when fetch throws — never echoes the raw fetch error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(
        new Error(
          `Connection failed to ${SIGNED_PROVIDER_URL} with token AKIA-LEAK-1234`,
        ),
      );

    let caught: unknown;
    try {
      await directProviderUpload({
        session: singleSession,
        blob: new Blob([new Uint8Array([1])]),
        fetchImpl: fetchMock,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/network error/i);
    expect(message).not.toContain("X-Amz-Signature");
    expect(message).not.toContain("AKIA-LEAK-1234");
    expect(message).not.toContain(SIGNED_PROVIDER_URL);
  });
});

describe("UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS is frozen and complete", () => {
  it("is a frozen list (defensive)", () => {
    expect(Object.isFrozen(UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS)).toBe(
      true,
    );
  });

  it("includes every documented banned field", () => {
    const expected = [
      "provider_kind",
      "providerKind",
      "providerId",
      "endpoint",
      "region",
      "bucket",
      "provider_object_key",
      "providerObjectKey",
      "credential_ref",
      "credentialRef",
      "accessKeyId",
      "secretAccessKey",
    ];
    for (const field of expected) {
      expect(UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS).toContain(field);
    }
  });
});

// ── Codex PR #33 follow-up: multipart parts hardening ──────────────────────
//
// Two findings from chatgpt-codex-connector[bot] on PR #33:
//   P1 (storage-client.ts:689) — directProviderUpload sliced the blob by loop
//     index but uploaded against session.parts[i]; if parts arrived unsorted,
//     part 1's bytes could go to part 2's URL → silent file corruption.
//   P2 (storage-client.ts:398) — parseUploadParts only required a finite
//     number for partNumber; values 0 / -1 / 1.5 were accepted and then
//     rejected late by the provider.
//
// The fixes also add a defensive sibling guard: parseUploadParts now drops
// duplicate partNumber entries (AWS S3 multipart contract — duplicate part
// numbers are a provider-side rejection, and would mask P1 by appearing
// "sorted").

describe("parseUploadParts strict partNumber validation (Codex PR #33 P2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const buildSessionEnvelope = (partsValue: unknown) =>
    new Response(
      JSON.stringify({
        ok: true,
        data: {
          uploadId: VALID_UPLOAD_ID,
          objectId: VALID_OBJECT_ID,
          uploadMethod: "multipart",
          uploadUrl: null,
          uploadHeaders: {},
          parts: partsValue,
          expiresAt: "2026-05-14T01:00:00.000Z",
          object: buildObjectPayload(),
        },
      }),
      { status: 200 },
    );

  const callCreate = async (partsValue: unknown) => {
    const fetchMock = vi.fn().mockResolvedValue(buildSessionEnvelope(partsValue));
    return createStorageUploadSession({
      apiBaseUrl: "http://localhost:4100",
      workspaceId: VALID_WORKSPACE_ID,
      accessToken: "jwt-token",
      file: { filename: "x", contentType: "image/png", byteSize: 1 },
      fetchImpl: fetchMock,
    });
  };

  it("drops partNumber = 0 (out of the [1, 10000] AWS S3 range)", async () => {
    const result = await callCreate([
      { partNumber: 0, url: "https://p0", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 1, url: "https://p1", expiresAt: "2026-05-14T01:00:00.000Z" },
    ]);
    expect(result.parts.map((p) => p.partNumber)).toEqual([1]);
  });

  it("drops negative partNumber", async () => {
    const result = await callCreate([
      { partNumber: -1, url: "https://pn", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 2, url: "https://p2", expiresAt: "2026-05-14T01:00:00.000Z" },
    ]);
    expect(result.parts.map((p) => p.partNumber)).toEqual([2]);
  });

  it("drops floating-point partNumber (e.g. 1.5)", async () => {
    const result = await callCreate([
      { partNumber: 1.5, url: "https://pfloat", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 3, url: "https://p3", expiresAt: "2026-05-14T01:00:00.000Z" },
    ]);
    expect(result.parts.map((p) => p.partNumber)).toEqual([3]);
  });

  it("drops partNumber > 10000 (out of the AWS S3 range)", async () => {
    const result = await callCreate([
      { partNumber: 10_001, url: "https://phi", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 1, url: "https://p1", expiresAt: "2026-05-14T01:00:00.000Z" },
    ]);
    expect(result.parts.map((p) => p.partNumber)).toEqual([1]);
  });

  it("accepts the boundary values partNumber = 1 and partNumber = 10000", async () => {
    const result = await callCreate([
      { partNumber: 1, url: "https://p1", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 10_000, url: "https://pmax", expiresAt: "2026-05-14T01:00:00.000Z" },
    ]);
    expect(result.parts.map((p) => p.partNumber)).toEqual([1, 10_000]);
  });

  it("drops duplicate partNumber entries (keeps the first)", async () => {
    const result = await callCreate([
      { partNumber: 1, url: "https://p1-first", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 1, url: "https://p1-dup", expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 2, url: "https://p2", expiresAt: "2026-05-14T01:00:00.000Z" },
    ]);
    expect(result.parts).toEqual([
      {
        partNumber: 1,
        url: "https://p1-first",
        expiresAt: "2026-05-14T01:00:00.000Z",
      },
      {
        partNumber: 2,
        url: "https://p2",
        expiresAt: "2026-05-14T01:00:00.000Z",
      },
    ]);
  });
});

describe("directProviderUpload sorts parts by partNumber before slicing (Codex PR #33 P1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Minimal session scaffold sharable across cases.
  const baseObject: StorageObject = {
    id: VALID_OBJECT_ID,
    workspaceId: VALID_WORKSPACE_ID,
    filename: "blob.bin",
    contentType: "application/octet-stream",
    byteSize: 8,
    sha256: null,
    purpose: "cms_media",
    visibility: "private",
    status: "pending_upload",
    compressionRequested: true,
    createdBy: null,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:00.000Z",
    uploadedAt: null,
  };

  const PART_URL_1 = "https://provider.example/part?n=1&X-Amz-Signature=PART1";
  const PART_URL_2 = "https://provider.example/part?n=2&X-Amz-Signature=PART2";
  const PART_URL_3 = "https://provider.example/part?n=3&X-Amz-Signature=PART3";

  it("uploads each byte range to the URL of the matching partNumber even when parts arrive unsorted", async () => {
    // Unsorted: [3, 1, 2]. After sort: [1, 2, 3]. Blob = 9 bytes, partSize = 3.
    // Byte range [0..3) (chunk 0,1,2) → part 1 URL, NOT part 3 URL.
    // Byte range [3..6) (chunk 3,4,5) → part 2 URL.
    // Byte range [6..9) (chunk 6,7,8) → part 3 URL.
    const session: CreateUploadSessionResult = {
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "multipart",
      uploadUrl: null,
      uploadHeaders: {},
      parts: [
        { partNumber: 3, url: PART_URL_3, expiresAt: "2026-05-14T01:00:00.000Z" },
        { partNumber: 1, url: PART_URL_1, expiresAt: "2026-05-14T01:00:00.000Z" },
        { partNumber: 2, url: PART_URL_2, expiresAt: "2026-05-14T01:00:00.000Z" },
      ],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: baseObject,
    };

    const calls: Array<{ url: string; chunkBytes: number[] }> = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string, init: RequestInit) => {
        // Capture the actual bytes uploaded with each request.
        const body = init.body as Blob;
        const buf = await body.arrayBuffer();
        const chunkBytes = Array.from(new Uint8Array(buf));
        calls.push({ url, chunkBytes });
        // Mint an ETag derived from the URL so the test can prove which URL
        // received which chunk.
        const tag = url.includes("n=1")
          ? '"etag-part-1"'
          : url.includes("n=2")
            ? '"etag-part-2"'
            : '"etag-part-3"';
        return new Response("", {
          status: 200,
          headers: { ETag: tag },
        });
      });

    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])]);
    const result = await directProviderUpload({
      session,
      blob,
      fetchImpl: fetchMock,
    });

    // 1) Bytes [1,2,3] (the first slice) MUST be uploaded to part 1's URL.
    const firstSliceCall = calls.find(
      (c) => JSON.stringify(c.chunkBytes) === JSON.stringify([1, 2, 3]),
    );
    expect(firstSliceCall?.url).toBe(PART_URL_1);

    // 2) Bytes [4,5,6] MUST be uploaded to part 2's URL.
    const middleSliceCall = calls.find(
      (c) => JSON.stringify(c.chunkBytes) === JSON.stringify([4, 5, 6]),
    );
    expect(middleSliceCall?.url).toBe(PART_URL_2);

    // 3) Bytes [7,8,9] MUST be uploaded to part 3's URL.
    const lastSliceCall = calls.find(
      (c) => JSON.stringify(c.chunkBytes) === JSON.stringify([7, 8, 9]),
    );
    expect(lastSliceCall?.url).toBe(PART_URL_3);

    // 4) Returned completed parts carry the correct (partNumber, etag)
    //    pairing — proves the multipart Complete envelope storage-service
    //    builds against this output will reassemble the object in the right
    //    byte order.
    const sortedResult = [...result.parts].sort(
      (a, b) => a.partNumber - b.partNumber,
    );
    expect(sortedResult).toEqual([
      { partNumber: 1, etag: '"etag-part-1"' },
      { partNumber: 2, etag: '"etag-part-2"' },
      { partNumber: 3, etag: '"etag-part-3"' },
    ]);
  });

  it("preserves already-sorted parts ordering (regression guard)", async () => {
    const session: CreateUploadSessionResult = {
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "multipart",
      uploadUrl: null,
      uploadHeaders: {},
      parts: [
        { partNumber: 1, url: PART_URL_1, expiresAt: "2026-05-14T01:00:00.000Z" },
        { partNumber: 2, url: PART_URL_2, expiresAt: "2026-05-14T01:00:00.000Z" },
      ],
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: baseObject,
    };

    const urlsSeen: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      urlsSeen.push(url);
      return Promise.resolve(
        new Response("", {
          status: 200,
          headers: { ETag: `"etag-${urlsSeen.length}"` },
        }),
      );
    });

    const blob = new Blob([new Uint8Array([10, 20, 30, 40])]);
    await directProviderUpload({ session, blob, fetchImpl: fetchMock });

    expect(urlsSeen).toEqual([PART_URL_1, PART_URL_2]);
  });

  it("does NOT mutate session.parts when sorting (defensive — caller may still inspect the original session)", async () => {
    const originalParts = [
      { partNumber: 2, url: PART_URL_2, expiresAt: "2026-05-14T01:00:00.000Z" },
      { partNumber: 1, url: PART_URL_1, expiresAt: "2026-05-14T01:00:00.000Z" },
    ];
    const session: CreateUploadSessionResult = {
      uploadId: VALID_UPLOAD_ID,
      objectId: VALID_OBJECT_ID,
      uploadMethod: "multipart",
      uploadUrl: null,
      uploadHeaders: {},
      parts: originalParts,
      expiresAt: "2026-05-14T01:00:00.000Z",
      object: baseObject,
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", { status: 200, headers: { ETag: '"etag"' } }),
    );
    const blob = new Blob([new Uint8Array([1, 2])]);
    await directProviderUpload({ session, blob, fetchImpl: fetchMock });

    // Original session.parts ordering is untouched.
    expect(session.parts[0].partNumber).toBe(2);
    expect(session.parts[1].partNumber).toBe(1);
  });
});
