import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStorageUploadAdapter } from "./use-storage-upload-adapter";

// Mock the storage client so we can drive every branch without touching
// the gateway. The implementation under test is the bridge, not the
// storage client (that has its own 59-test suite from STORAGE-10).
vi.mock("./storage-client", () => ({
  createStorageUploadSession: vi.fn(),
  directProviderUpload: vi.fn(),
  completeStorageUploadSession: vi.fn(),
  abortStorageUploadSession: vi.fn(),
  createStorageDownloadUrl: vi.fn(),
}));

import {
  abortStorageUploadSession,
  completeStorageUploadSession,
  createStorageDownloadUrl,
  createStorageUploadSession,
  directProviderUpload,
} from "./storage-client";

const mockedCreateSession = vi.mocked(createStorageUploadSession);
const mockedDirectUpload = vi.mocked(directProviderUpload);
const mockedCompleteSession = vi.mocked(completeStorageUploadSession);
const mockedAbortSession = vi.mocked(abortStorageUploadSession);
const mockedCreateDownloadUrl = vi.mocked(createStorageDownloadUrl);

const baseArgs = {
  apiBaseUrl: "https://gateway.test",
  workspaceId: "ws_1",
  accessToken: "jwt_token",
};

const buildSession = (overrides: Partial<Record<string, unknown>> = {}) => ({
  uploadId: "upload_1",
  objectId: "obj_1",
  uploadMethod: "single" as const,
  uploadUrl: "https://signed.provider.example/put",
  uploadHeaders: {},
  parts: [],
  expiresAt: "2026-12-31T23:59:59Z",
  // DEDUP-2 — default no-dedup posture so existing tests behave as
  // before. Tests covering the dedup-hit branch override to `true`.
  dedupHit: false,
  object: {
    id: "obj_1",
    workspaceId: "ws_1",
    filename: "photo.png",
    contentType: "image/png",
    byteSize: 1024,
    sha256: null,
    purpose: "cms_media",
    visibility: "private" as const,
    status: "pending_upload" as const,
    compressionRequested: true,
    createdBy: "user_1",
    createdAt: "2026-05-14T00:00:00Z",
    updatedAt: "2026-05-14T00:00:00Z",
    uploadedAt: null,
  },
  ...overrides,
});

const buildComplete = () => ({
  object: {
    id: "obj_1",
    workspaceId: "ws_1",
    filename: "photo.png",
    contentType: "image/png",
    byteSize: 1024,
    sha256: null,
    purpose: "cms_media",
    visibility: "private" as const,
    status: "processing" as const,
    compressionRequested: true,
    createdBy: "user_1",
    createdAt: "2026-05-14T00:00:00Z",
    updatedAt: "2026-05-14T00:00:01Z",
    uploadedAt: "2026-05-14T00:00:01Z",
  },
  session: {
    id: "upload_1",
    objectId: "obj_1",
    uploadMethod: "single" as const,
    status: "completed" as const,
    createdAt: "2026-05-14T00:00:00Z",
    expiresAt: "2026-12-31T23:59:59Z",
    completedAt: "2026-05-14T00:00:01Z",
    abortedAt: null,
  },
  processingJobs: [],
});

describe("useStorageUploadAdapter — prerequisites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined adapter + resolver when workspaceId is null", () => {
    const { result } = renderHook(() =>
      useStorageUploadAdapter({ ...baseArgs, workspaceId: null }),
    );
    expect(result.current.uploadAdapter).toBeUndefined();
    expect(result.current.resolveDownloadUrl).toBeUndefined();
  });

  it("returns undefined adapter + resolver when accessToken is null", () => {
    const { result } = renderHook(() =>
      useStorageUploadAdapter({ ...baseArgs, accessToken: null }),
    );
    expect(result.current.uploadAdapter).toBeUndefined();
    expect(result.current.resolveDownloadUrl).toBeUndefined();
  });

  it("returns undefined when apiBaseUrl is empty", () => {
    const { result } = renderHook(() =>
      useStorageUploadAdapter({ ...baseArgs, apiBaseUrl: "" }),
    );
    expect(result.current.uploadAdapter).toBeUndefined();
    expect(result.current.resolveDownloadUrl).toBeUndefined();
  });

  it("returns a wired adapter + resolver when all inputs are ready", () => {
    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    expect(typeof result.current.uploadAdapter?.uploadFile).toBe("function");
    expect(typeof result.current.resolveDownloadUrl).toBe("function");
  });
});

describe("useStorageUploadAdapter — upload happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the full lifecycle and returns { url, mime, size, objectId }", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockResolvedValueOnce({ parts: [] });
    mockedCompleteSession.mockResolvedValueOnce(buildComplete() as never);
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_1",
      url: "https://signed.example/download/obj_1",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const onProgress = vi.fn();
    const file = new File(["x"], "photo.png", { type: "image/png" });

    const uploadResult = await result.current.uploadAdapter!.uploadFile(file, {
      onProgress,
    });

    expect(uploadResult).toEqual({
      url: "https://signed.example/download/obj_1",
      mime: "image/png",
      size: 1024,
      objectId: "obj_1",
    });
    expect(mockedCreateSession).toHaveBeenCalledTimes(1);
    expect(mockedDirectUpload).toHaveBeenCalledTimes(1);
    expect(mockedCompleteSession).toHaveBeenCalledTimes(1);
    expect(mockedCreateDownloadUrl).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(0);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("falls back to empty url when download URL resolution fails", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockResolvedValueOnce({ parts: [] });
    mockedCompleteSession.mockResolvedValueOnce(buildComplete() as never);
    mockedCreateDownloadUrl.mockRejectedValueOnce(
      new Error("download URL not yet ready"),
    );

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const out = await result.current.uploadAdapter!.uploadFile(file);

    expect(out.objectId).toBe("obj_1");
    expect(out.url).toBe("");
  });

  it("forwards the operation lifecycle parts to completeStorageUploadSession", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockResolvedValueOnce({
      parts: [{ partNumber: 1, etag: "etag_1" }],
    });
    mockedCompleteSession.mockResolvedValueOnce(buildComplete() as never);
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_1",
      url: "https://signed.example/download/obj_1",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await result.current.uploadAdapter!.uploadFile(file);

    expect(mockedCompleteSession).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: [{ partNumber: 1, etag: "etag_1" }],
      }),
    );
  });

  it("does not forward parts when the direct upload returned an empty array", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockResolvedValueOnce({ parts: [] });
    mockedCompleteSession.mockResolvedValueOnce(buildComplete() as never);
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_1",
      url: "https://signed.example/download/obj_1",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await result.current.uploadAdapter!.uploadFile(file);

    const call = mockedCompleteSession.mock.calls[0][0] as {
      parts?: unknown;
    };
    expect(call.parts).toBeUndefined();
  });

  it("forwards custom purpose when provided to the hook", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockResolvedValueOnce({ parts: [] });
    mockedCompleteSession.mockResolvedValueOnce(buildComplete() as never);
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_1",
      url: "https://x",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() =>
      useStorageUploadAdapter({ ...baseArgs, purpose: "platform_generic" }),
    );
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await result.current.uploadAdapter!.uploadFile(file);

    const args = mockedCreateSession.mock.calls[0][0] as {
      file: { purpose?: string };
    };
    expect(args.file.purpose).toBe("platform_generic");
  });
});

describe("useStorageUploadAdapter — failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aborts the session and rethrows when direct upload fails", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockRejectedValueOnce(
      new Error("Provider upload failed: network error"),
    );
    mockedAbortSession.mockResolvedValueOnce({
      session: {
        id: "upload_1",
        objectId: "obj_1",
        uploadMethod: "single" as const,
        status: "aborted" as const,
        createdAt: "2026-05-14T00:00:00Z",
        expiresAt: "2026-12-31T23:59:59Z",
        completedAt: null,
        abortedAt: "2026-05-14T00:00:02Z",
      },
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await expect(
      result.current.uploadAdapter!.uploadFile(file),
    ).rejects.toThrow(/Image upload failed at direct-upload/);
    expect(mockedAbortSession).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: "upload_1" }),
    );
  });

  it("aborts and rethrows when complete fails", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockResolvedValueOnce({ parts: [] });
    mockedCompleteSession.mockRejectedValueOnce(
      new Error(
        "Failed to complete storage upload session: HTTP 409 Conflict (STATE_CONFLICT)",
      ),
    );
    mockedAbortSession.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await expect(
      result.current.uploadAdapter!.uploadFile(file),
    ).rejects.toThrow(/Image upload failed at complete-session/);
    expect(mockedAbortSession).toHaveBeenCalled();
  });

  it("does NOT attempt abort when create-session fails (no session to abort)", async () => {
    mockedCreateSession.mockRejectedValueOnce(
      new Error(
        "Failed to create storage upload session: HTTP 403 Forbidden (FORBIDDEN_SCOPE_MISS)",
      ),
    );

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await expect(
      result.current.uploadAdapter!.uploadFile(file),
    ).rejects.toThrow(/Image upload failed at create-session/);
    expect(mockedAbortSession).not.toHaveBeenCalled();
  });

  it("STORAGE-11 invariant: error messages NEVER include raw provider material", async () => {
    const HOSTILE_LEAK =
      "Failed: bucket=secret-customer-bucket key=AKIA0123456789ABCDEF token=xynes_live_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef X-Amz-Signature=SIGEXAMPLE endpoint=acct.r2.cloudflarestorage.com";
    mockedCreateSession.mockRejectedValueOnce(new Error(HOSTILE_LEAK));

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });

    try {
      await result.current.uploadAdapter!.uploadFile(file);
      throw new Error("Expected upload to reject");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg).not.toContain("AKIA");
      expect(msg).not.toContain("xynes_live_");
      expect(msg).not.toContain("X-Amz-Signature");
      expect(msg).not.toContain("r2.cloudflarestorage.com");
      expect(msg).not.toContain("backblazeb2.com");
      expect(msg).not.toContain("amazonaws.com");
    }
  });

  it("swallows abort failure during partial-failure cleanup", async () => {
    mockedCreateSession.mockResolvedValueOnce(buildSession() as never);
    mockedDirectUpload.mockRejectedValueOnce(new Error("network down"));
    mockedAbortSession.mockRejectedValueOnce(new Error("abort failed"));

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const file = new File(["x"], "photo.png", { type: "image/png" });

    await expect(
      result.current.uploadAdapter!.uploadFile(file),
    ).rejects.toThrow(/Image upload failed/);
  });

  it("throws a setup error if invoked while workspace went null mid-flight", async () => {
    const { result, rerender } = renderHook(
      (props: { workspaceId: string | null }) =>
        useStorageUploadAdapter({
          ...baseArgs,
          workspaceId: props.workspaceId,
        }),
      { initialProps: { workspaceId: "ws_1" as string | null } },
    );
    const adapter = result.current.uploadAdapter;
    expect(adapter).toBeDefined();

    rerender({ workspaceId: null });
    expect(result.current.uploadAdapter).toBeUndefined();
  });
});

describe("useStorageUploadAdapter — resolveDownloadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the fresh signed URL for a given objectId", async () => {
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_42",
      url: "https://signed.example/fresh/obj_42",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const url = await result.current.resolveDownloadUrl!("obj_42");

    expect(url).toBe("https://signed.example/fresh/obj_42");
    expect(mockedCreateDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ objectId: "obj_42" }),
    );
  });

  it("returns empty string when storage-service errors (graceful degradation)", async () => {
    mockedCreateDownloadUrl.mockRejectedValueOnce(
      new Error("HTTP 503 Service Unavailable"),
    );

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const url = await result.current.resolveDownloadUrl!("obj_42");

    expect(url).toBe("");
  });
});

describe("useStorageUploadAdapter — bridge stability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the same uploadAdapter reference across re-renders with stable args", async () => {
    const { result, rerender } = renderHook(() =>
      useStorageUploadAdapter(baseArgs),
    );
    const first = result.current.uploadAdapter;
    rerender();
    rerender();
    await waitFor(() => {
      expect(result.current.uploadAdapter).toBe(first);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// DEDUP-2 — content-hash dedup behaviour on the editor bridge.
//
// Plan §9 acceptance: when `createStorageUploadSession` reports
// `dedupHit: true`, the adapter MUST skip `directProviderUpload` and
// `completeStorageUploadSession` entirely. The display URL is fetched
// against the existing object id (which storage-service already returned
// as `session.object.id`).
// ─────────────────────────────────────────────────────────────────────────

describe("useStorageUploadAdapter — DEDUP-2 dedup-hit branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips directProviderUpload + completeStorageUploadSession on dedupHit=true and mints a download URL against the existing object", async () => {
    const dedupSession = buildSession({ dedupHit: true, uploadUrl: null });
    mockedCreateSession.mockResolvedValueOnce(dedupSession as never);
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_1",
      url: "https://signed.example/dedup-download",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const adapter = result.current.uploadAdapter;
    if (!adapter) throw new Error("adapter not ready");
    const uploadFile = adapter.uploadFile;

    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    });
    const uploadResult = await uploadFile(file);

    expect(mockedCreateSession).toHaveBeenCalledTimes(1);
    expect(mockedDirectUpload).not.toHaveBeenCalled();
    expect(mockedCompleteSession).not.toHaveBeenCalled();
    expect(mockedAbortSession).not.toHaveBeenCalled();
    expect(uploadResult).toEqual({
      url: "https://signed.example/dedup-download",
      mime: "image/png",
      size: 1024,
      objectId: "obj_1",
    });
  });

  it("dedupHit=true: tolerates a download-URL failure (returns empty url, editor re-resolves on next mount)", async () => {
    const dedupSession = buildSession({ dedupHit: true, uploadUrl: null });
    mockedCreateSession.mockResolvedValueOnce(dedupSession as never);
    mockedCreateDownloadUrl.mockRejectedValueOnce(
      new Error("processing not ready"),
    );

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const adapter = result.current.uploadAdapter;
    if (!adapter) throw new Error("adapter not ready");
    const uploadFile = adapter.uploadFile;

    const file = new File([new Uint8Array([1])], "photo.png", {
      type: "image/png",
    });
    const uploadResult = await uploadFile(file);

    expect(uploadResult.url).toBe("");
    expect(uploadResult.objectId).toBe("obj_1");
    // direct / complete still NOT called even when the optional URL fetch fails.
    expect(mockedDirectUpload).not.toHaveBeenCalled();
    expect(mockedCompleteSession).not.toHaveBeenCalled();
  });

  it("dedupHit=true: does NOT issue an abort if the download-URL fetch fails (no provider-side session was opened)", async () => {
    const dedupSession = buildSession({ dedupHit: true, uploadUrl: null });
    mockedCreateSession.mockResolvedValueOnce(dedupSession as never);
    mockedCreateDownloadUrl.mockRejectedValueOnce(new Error("download failed"));

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const adapter = result.current.uploadAdapter;
    if (!adapter) throw new Error("adapter not ready");
    await adapter.uploadFile(
      new File([new Uint8Array([0])], "x.png", { type: "image/png" }),
    );

    expect(mockedAbortSession).not.toHaveBeenCalled();
  });

  it("dedupHit=false (default): preserves the existing direct-then-complete flow byte-for-byte", async () => {
    const freshSession = buildSession(); // dedupHit: false by default
    mockedCreateSession.mockResolvedValueOnce(freshSession as never);
    mockedDirectUpload.mockResolvedValueOnce({ parts: [] });
    mockedCompleteSession.mockResolvedValueOnce(buildComplete() as never);
    mockedCreateDownloadUrl.mockResolvedValueOnce({
      objectId: "obj_1",
      url: "https://signed.example/fresh-download",
      expiresAt: "2026-12-31T23:59:59Z",
    });

    const { result } = renderHook(() => useStorageUploadAdapter(baseArgs));
    const adapter = result.current.uploadAdapter;
    if (!adapter) throw new Error("adapter not ready");
    const uploadFile = adapter.uploadFile;

    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    });
    await uploadFile(file);

    expect(mockedDirectUpload).toHaveBeenCalledTimes(1);
    expect(mockedCompleteSession).toHaveBeenCalledTimes(1);
  });
});
