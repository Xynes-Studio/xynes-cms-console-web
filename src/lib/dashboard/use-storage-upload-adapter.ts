/**
 * STORAGE-11 — Bridge the Lumia DS editor's `EditorMediaConfig` upload
 * adapter and download-URL resolver to the STORAGE-10 storage client.
 *
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-10-universal-object-storage-file-upload-api.md`
 *
 * What this module owns
 * ─────────────────────
 *   - `useStorageUploadAdapter({...})` returns a stable
 *     `{ uploadAdapter, resolveDownloadUrl }` pair the editor consumes via
 *     `media={...}` on `<LumiaEditor />`. The adapter performs the full
 *     storage-service upload lifecycle:
 *       1. `createStorageUploadSession`
 *       2. `directProviderUpload`
 *       3. `completeStorageUploadSession`
 *     and returns `{ url, mime, size, objectId }`. The `url` is a freshly
 *     minted signed download URL — the editor inserts it into the node for
 *     immediate display, but persistence layers MUST normalise the body via
 *     `stripTransientImageUrls(body)` before saving so the entry body never
 *     carries the signed URL.
 *   - `resolveDownloadUrl(objectId)` mints a fresh signed download URL via
 *     `createStorageDownloadUrl`. Used by the editor on mount to refresh a
 *     stored objectId into a working `src` for the current session.
 *
 * Security invariants
 * ───────────────────
 *   - Returns ONLY documented fields: `{ url, mime, size, objectId }`.
 *     Provider config (`endpoint`, `region`, `bucket`, `provider_kind`,
 *     credentials, presigned URL signature parameters) NEVER appears in the
 *     adapter result.
 *   - Failures collapse to a generic Error message. Provider error bodies,
 *     signed URLs, raw provider tokens, and AWS access keys are never
 *     reflected back to the editor or the user-visible error surface.
 *   - The direct-upload `fetch` is credential-less (handled inside
 *     `directProviderUpload`). The session cookie, `Authorization` bearer,
 *     and any `X-XS-*` header are NEVER forwarded to the provider URL.
 */
import { useCallback, useMemo } from "react";
import type {
  MediaUploadAdapter,
  MediaUploadResult,
  UploadOptions,
} from "@lumia-ui/editor";
import {
  abortStorageUploadSession,
  completeStorageUploadSession,
  createStorageDownloadUrl,
  createStorageUploadSession,
  directProviderUpload,
} from "./storage-client";

export interface UseStorageUploadAdapterArgs {
  readonly apiBaseUrl: string;
  readonly workspaceId: string | null;
  readonly accessToken: string | null;
  /**
   * Optional purpose tag forwarded to storage-service. CMS Console
   * defaults to `cms_media`; pass a different value for non-CMS-media
   * uploads (none planned for STORAGE-11).
   */
  readonly purpose?: string;
}

export interface StorageMediaConfigBridge {
  readonly uploadAdapter: MediaUploadAdapter | undefined;
  readonly resolveDownloadUrl:
    | ((objectId: string) => Promise<string>)
    | undefined;
}

/**
 * Generic safe-error message — never echoes provider material. Same posture
 * as the STORAGE-10 storage client's `safeGatewayError`.
 */
function safeUploadError(stage: string, error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return error;
  }
  // Preserve the closed-set storage-service error code suffix when the
  // storage client surfaced one (e.g. `HTTP 403 Forbidden (FORBIDDEN_SCOPE_MISS)`),
  // but defensively strip anything that even smells like provider material.
  const raw =
    error instanceof Error && typeof error.message === "string"
      ? error.message
      : "";
  if (raw && !looksLikeProviderLeak(raw)) {
    return new Error(`Image upload failed at ${stage}: ${raw}`);
  }
  return new Error(`Image upload failed at ${stage}: network error`);
}

const PROVIDER_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  /xynes_live_[a-f0-9]+/i,
  /AKIA[0-9A-Z]{8,}/i,
  /X-Amz-Signature=/i,
  /X-Amz-Credential=/i,
  /X-Amz-Security-Token=/i,
  /\.r2\.cloudflarestorage\.com/i,
  /\.backblazeb2\.com/i,
  /\.amazonaws\.com/i,
];

function looksLikeProviderLeak(value: string): boolean {
  return PROVIDER_LEAK_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Build a stable `{ uploadAdapter, resolveDownloadUrl }` pair the Lumia
 * editor consumes through its `media` prop. The hook returns `undefined`
 * for both fields when prerequisites are not yet available
 * (e.g. workspace not loaded, access token not minted) so the editor
 * surfaces a normal read-only experience instead of throwing inside the
 * upload click handler.
 */
export function useStorageUploadAdapter({
  apiBaseUrl,
  workspaceId,
  accessToken,
  purpose,
}: UseStorageUploadAdapterArgs): StorageMediaConfigBridge {
  // The adapter implementation must remain stable across renders so the
  // Lumia editor's `MediaContext` memo can short-circuit. The hook reads
  // `apiBaseUrl` / `workspaceId` / `accessToken` from a ref via the closure
  // captured at construction time — but we capture them via useCallback +
  // useMemo so a fresh adapter is minted only when one of the inputs
  // genuinely changes.
  const uploadFile = useCallback(
    async (file: File, options?: UploadOptions): Promise<MediaUploadResult> => {
      if (!apiBaseUrl || !workspaceId || !accessToken) {
        // Mirror the editor's existing UX: empty / missing adapter means
        // "no upload available" — the editor short-circuits before calling
        // this function, so this branch is a defensive guard.
        throw new Error("Image upload failed at setup: workspace not ready");
      }

      let createdUploadId: string | null = null;

      try {
        // 1) Create the upload session
        options?.onProgress?.(0);
        const session = await createStorageUploadSession({
          apiBaseUrl,
          workspaceId,
          accessToken,
          file: {
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            byteSize: file.size,
            purpose,
            // Visibility + compression intentionally left to client defaults
            // (`private` + `true`) so CMS authoring always uploads private
            // and lets storage-service produce optimised variants.
          },
        });
        createdUploadId = session.uploadId;

        // 2) Upload directly to the provider
        options?.onProgress?.(10);
        const direct = await directProviderUpload({
          session,
          blob: file,
        });

        // 3) Complete the session
        options?.onProgress?.(80);
        const completed = await completeStorageUploadSession({
          apiBaseUrl,
          workspaceId,
          accessToken,
          uploadId: session.uploadId,
          parts: direct.parts.length > 0 ? direct.parts : undefined,
        });
        createdUploadId = null;

        // 4) Mint a signed download URL for immediate display. Even if the
        // object is in `processing` state, storage-service's `download_url`
        // op should already be willing to sign for `uploaded`+ states; if
        // not, the editor will read the empty url and the post-processing
        // resolver path will re-fetch when the user reloads.
        let displayUrl = "";
        try {
          const downloadUrl = await createStorageDownloadUrl({
            apiBaseUrl,
            workspaceId,
            accessToken,
            objectId: completed.object.id,
          });
          displayUrl = downloadUrl.url;
        } catch {
          // Non-fatal: STORAGE-7 `processing` objects may not yet be
          // download-ready. The editor will swap in a real URL via
          // `resolveDownloadUrl` on next mount.
        }

        options?.onProgress?.(100);
        return {
          url: displayUrl,
          mime: completed.object.contentType,
          size: completed.object.byteSize,
          objectId: completed.object.id,
        };
      } catch (error) {
        // Best-effort abort on partial failures so we don't leave a dangling
        // pending session. Swallow abort failures — the cleanup worker
        // (STORAGE-9) will eventually expire orphaned sessions.
        if (createdUploadId) {
          try {
            await abortStorageUploadSession({
              apiBaseUrl,
              workspaceId,
              accessToken,
              uploadId: createdUploadId,
            });
          } catch {
            // intentional swallow — cleanup is best-effort
          }
        }
        throw safeUploadError(determineStage(error), error);
      }
    },
    [apiBaseUrl, workspaceId, accessToken, purpose],
  );

  const resolveDownloadUrl = useCallback(
    async (objectId: string): Promise<string> => {
      if (!apiBaseUrl || !workspaceId || !accessToken) {
        return "";
      }
      try {
        const result = await createStorageDownloadUrl({
          apiBaseUrl,
          workspaceId,
          accessToken,
          objectId,
        });
        return result.url;
      } catch {
        // Resolver failures are swallowed at the editor boundary too — the
        // editor's existing `src` (which may be a stale signed URL or a
        // blob preview) stays in place. Returning empty string is the
        // documented signal for "no fresh URL available".
        return "";
      }
    },
    [apiBaseUrl, workspaceId, accessToken],
  );

  const bridge = useMemo<StorageMediaConfigBridge>(() => {
    if (!apiBaseUrl || !workspaceId || !accessToken) {
      return { uploadAdapter: undefined, resolveDownloadUrl: undefined };
    }
    return {
      uploadAdapter: { uploadFile },
      resolveDownloadUrl,
    };
  }, [apiBaseUrl, workspaceId, accessToken, uploadFile, resolveDownloadUrl]);

  return bridge;
}

/**
 * Inspect a thrown value and label the lifecycle stage the failure occurred
 * at. Used purely for the safe error message — we never embed provider
 * material here. The stage label is a closed set.
 */
function determineStage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    const m = error.message;
    if (/create storage upload session/i.test(m)) return "create-session";
    if (/Provider response missing ETag/i.test(m)) return "direct-upload";
    if (/Provider upload failed/i.test(m)) return "direct-upload";
    if (/complete storage upload session/i.test(m)) return "complete-session";
    if (/abort storage upload session/i.test(m)) return "abort-session";
    if (/create storage download url/i.test(m)) return "download-url";
  }
  return "unknown";
}
