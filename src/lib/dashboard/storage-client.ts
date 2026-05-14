/**
 * STORAGE-10 — CMS Console storage client.
 *
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-10-universal-object-storage-file-upload-api.md`
 *
 * What this module owns
 * ─────────────────────
 *   - Create an upload session through the gateway (`POST /workspaces/:wsId/storage/uploads`).
 *   - Upload the file directly to the provider URL the gateway returned.
 *   - Complete the upload session through the gateway.
 *   - Abort the upload session through the gateway.
 *   - Read object metadata through the gateway.
 *   - Mint a short-lived signed download URL through the gateway.
 *
 * What this module DOES NOT do
 * ────────────────────────────
 *   - It never talks directly to a storage provider for anything other than
 *     the direct file upload. Signed download URLs are always minted by the
 *     storage-service via the gateway, not by this module.
 *   - It never persists or surfaces provider configuration. The typed
 *     surface here is single-sourced from `UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS`
 *     — every parser is allowlist-only, and hostile upstream fields
 *     (`provider_kind`, `endpoint`, `region`, `bucket`, `provider_object_key`,
 *     `credential_ref`, `accessKeyId`, `secretAccessKey`,
 *     `X-Amz-Signature`-style fields, etc.) are dropped silently. This is the
 *     same fail-closed posture that `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS`
 *     enforces for the CMS integrations panel.
 *   - It never forwards the Xynes session cookie, the Xynes `Authorization`
 *     bearer, or any `X-XS-*` actor header to the provider URL — the
 *     direct-upload `fetch` is credential-less.
 */
import {
  isNonEmptyString,
  isRecord,
  normalizeGatewayClientInputs,
  unwrapGatewayEnvelope,
} from "./gateway-client-utils";

type FetchLike = typeof fetch;

// ─────────────────────────────────────────────────────────────────────────
// Public DTOs — single-sourced documented-keys-only contract.
// ─────────────────────────────────────────────────────────────────────────

export type UploadMethod = "single" | "multipart";

export type StorageObjectStatus =
  | "pending_upload"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

export type StorageObjectVisibility = "private" | "public";

export type UploadSessionStatus =
  | "pending"
  | "completed"
  | "aborted"
  | "expired";

export type ProcessingJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type VariantStatus = "pending" | "ready" | "failed";

export interface StorageObject {
  readonly id: string;
  readonly workspaceId: string;
  readonly filename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly sha256: string | null;
  readonly purpose: string;
  readonly visibility: StorageObjectVisibility;
  readonly status: StorageObjectStatus;
  readonly compressionRequested: boolean;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly uploadedAt: string | null;
}

export interface UploadSession {
  readonly id: string;
  readonly objectId: string;
  readonly uploadMethod: UploadMethod;
  readonly status: UploadSessionStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly completedAt: string | null;
  readonly abortedAt: string | null;
}

export interface CreateUploadSessionPart {
  readonly partNumber: number;
  readonly url: string;
  readonly expiresAt: string;
}

export interface CreateUploadSessionResult {
  readonly uploadId: string;
  readonly objectId: string;
  readonly uploadMethod: UploadMethod;
  readonly uploadUrl: string | null;
  readonly uploadHeaders: Readonly<Record<string, string>>;
  readonly parts: ReadonlyArray<CreateUploadSessionPart>;
  readonly expiresAt: string;
  readonly object: StorageObject;
}

export interface CompletedPart {
  readonly partNumber: number;
  readonly etag: string;
}

export interface ProcessingJob {
  readonly id: string;
  readonly objectId: string;
  readonly jobType: string;
  readonly status: ProcessingJobStatus;
  readonly attempts: number;
  readonly errorCode: string | null;
  readonly required: boolean;
  readonly scheduledAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CompleteUploadResult {
  readonly object: StorageObject;
  readonly session: UploadSession;
  readonly processingJobs: ReadonlyArray<ProcessingJob>;
}

export interface AbortUploadResult {
  readonly session: UploadSession;
}

export interface StorageObjectVariant {
  readonly id: string;
  readonly objectId: string;
  readonly variantKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly status: VariantStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StorageObjectDetail {
  readonly object: StorageObject;
  readonly variants: ReadonlyArray<StorageObjectVariant>;
  readonly processingJobs: ReadonlyArray<ProcessingJob>;
}

export interface DownloadUrlResult {
  readonly objectId: string;
  readonly url: string;
  readonly expiresAt: string;
}

export interface DirectUploadResult {
  readonly parts: ReadonlyArray<CompletedPart>;
}

/**
 * Canonical list of upstream fields that MUST be stripped before any
 * response leaves this module. Exported so tests (and any future
 * downstream consumer) can `===` compare or import the canonical list
 * instead of redeclaring it.
 *
 * Same single-source posture as `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS`
 * in `workspace-integrations-client.ts`.
 */
export const UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS = Object.freeze([
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
  "r2Token",
  "signedUrl",
  "presignedUrl",
] as const);

// ─────────────────────────────────────────────────────────────────────────
// Defaults — STORAGE-10 acceptance criterion.
// ─────────────────────────────────────────────────────────────────────────

export const CMS_DEFAULT_UPLOAD_PURPOSE = "cms_media";
export const CMS_DEFAULT_UPLOAD_VISIBILITY: StorageObjectVisibility = "private";
export const CMS_DEFAULT_UPLOAD_COMPRESSION = true;

// ─────────────────────────────────────────────────────────────────────────
// Validation helpers — generic, no per-provider config knowledge.
// ─────────────────────────────────────────────────────────────────────────

const isUploadMethod = (value: unknown): value is UploadMethod =>
  value === "single" || value === "multipart";

const isStorageObjectStatus = (value: unknown): value is StorageObjectStatus =>
  value === "pending_upload" ||
  value === "uploaded" ||
  value === "processing" ||
  value === "ready" ||
  value === "failed" ||
  value === "deleted";

const isUploadSessionStatus = (value: unknown): value is UploadSessionStatus =>
  value === "pending" ||
  value === "completed" ||
  value === "aborted" ||
  value === "expired";

const isProcessingJobStatus = (value: unknown): value is ProcessingJobStatus =>
  value === "queued" ||
  value === "running" ||
  value === "succeeded" ||
  value === "failed" ||
  value === "cancelled";

const isVariantStatus = (value: unknown): value is VariantStatus =>
  value === "pending" || value === "ready" || value === "failed";

const isVisibility = (value: unknown): value is StorageObjectVisibility =>
  value === "private" || value === "public";

const normalizeNonEmptyId = (value: string, fieldName: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
};

const requireNumber = (value: unknown, fieldName: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value;
};

const requireString = (value: unknown, fieldName: string): string => {
  if (!isNonEmptyString(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value.trim();
};

const optionalString = (value: unknown): string | null =>
  isNonEmptyString(value) ? value.trim() : null;

const requireBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value;
};

// ─────────────────────────────────────────────────────────────────────────
// Documented-keys-only parsers.
// Every parser builds the result with explicit field assignment —
// upstream rows are NEVER spread.
// ─────────────────────────────────────────────────────────────────────────

const parseStorageObject = (value: unknown): StorageObject => {
  if (!isRecord(value)) {
    throw new Error("Invalid storage object");
  }
  const status = value.status;
  const visibility = value.visibility;
  if (!isStorageObjectStatus(status) || !isVisibility(visibility)) {
    throw new Error("Invalid storage object");
  }
  return {
    id: requireString(value.id, "id"),
    workspaceId: requireString(value.workspaceId, "workspaceId"),
    filename: requireString(value.filename, "filename"),
    contentType: requireString(value.contentType, "contentType"),
    byteSize: requireNumber(value.byteSize, "byteSize"),
    sha256: optionalString(value.sha256),
    purpose: requireString(value.purpose, "purpose"),
    visibility,
    status,
    compressionRequested: requireBoolean(
      value.compressionRequested,
      "compressionRequested",
    ),
    createdBy: optionalString(value.createdBy),
    createdAt: requireString(value.createdAt, "createdAt"),
    updatedAt: requireString(value.updatedAt, "updatedAt"),
    uploadedAt: optionalString(value.uploadedAt),
  };
};

const parseUploadSession = (value: unknown): UploadSession => {
  if (!isRecord(value)) {
    throw new Error("Invalid upload session");
  }
  if (
    !isUploadMethod(value.uploadMethod) ||
    !isUploadSessionStatus(value.status)
  ) {
    throw new Error("Invalid upload session");
  }
  return {
    id: requireString(value.id, "id"),
    objectId: requireString(value.objectId, "objectId"),
    uploadMethod: value.uploadMethod,
    status: value.status,
    createdAt: requireString(value.createdAt, "createdAt"),
    expiresAt: requireString(value.expiresAt, "expiresAt"),
    completedAt: optionalString(value.completedAt),
    abortedAt: optionalString(value.abortedAt),
  };
};

const parseProcessingJob = (value: unknown): ProcessingJob => {
  if (!isRecord(value)) {
    throw new Error("Invalid processing job");
  }
  if (!isProcessingJobStatus(value.status)) {
    throw new Error("Invalid processing job");
  }
  return {
    id: requireString(value.id, "id"),
    objectId: requireString(value.objectId, "objectId"),
    jobType: requireString(value.jobType, "jobType"),
    status: value.status,
    attempts: requireNumber(value.attempts, "attempts"),
    errorCode: optionalString(value.errorCode),
    required: requireBoolean(value.required, "required"),
    scheduledAt: requireString(value.scheduledAt, "scheduledAt"),
    createdAt: requireString(value.createdAt, "createdAt"),
    updatedAt: requireString(value.updatedAt, "updatedAt"),
  };
};

const parseVariant = (value: unknown): StorageObjectVariant => {
  if (!isRecord(value)) {
    throw new Error("Invalid variant");
  }
  if (!isVariantStatus(value.status)) {
    throw new Error("Invalid variant");
  }
  return {
    id: requireString(value.id, "id"),
    objectId: requireString(value.objectId, "objectId"),
    variantKey: requireString(value.variantKey, "variantKey"),
    contentType: requireString(value.contentType, "contentType"),
    byteSize: requireNumber(value.byteSize, "byteSize"),
    status: value.status,
    createdAt: requireString(value.createdAt, "createdAt"),
    updatedAt: requireString(value.updatedAt, "updatedAt"),
  };
};

const parseUploadHeaders = (
  value: unknown,
): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  if (!isRecord(value)) {
    return out;
  }
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string" && key.trim().length > 0) {
      out[key] = headerValue;
    }
  }
  return out;
};

const parseUploadParts = (
  value: unknown,
): ReadonlyArray<CreateUploadSessionPart> => {
  if (!Array.isArray(value)) {
    return [];
  }
  // Codex P2 (PR #33): part numbers must be positive integers per the AWS S3
  // multipart contract (`partNumber ∈ [1, 10_000]`). Accepting `0`, negatives,
  // or floats lets bad uploads start and fail late at the provider — reject
  // them at parse time instead.
  //
  // Defensive extension (not flagged by Codex but a sibling invariant): drop
  // duplicate part numbers as well. Two parts with the same `partNumber` would
  // also be a provider-side rejection on `CompleteMultipartUpload`, and would
  // mask the multipart-byte-range bug Codex P1 fixes by appearing "sorted".
  const seen = new Set<number>();
  const out: CreateUploadSessionPart[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (
      typeof entry.partNumber !== "number" ||
      !Number.isInteger(entry.partNumber) ||
      entry.partNumber < 1 ||
      entry.partNumber > 10_000
    ) {
      continue;
    }
    if (seen.has(entry.partNumber)) {
      continue;
    }
    if (!isNonEmptyString(entry.url) || !isNonEmptyString(entry.expiresAt)) {
      continue;
    }
    seen.add(entry.partNumber);
    out.push({
      partNumber: entry.partNumber,
      url: entry.url,
      expiresAt: entry.expiresAt,
    });
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────────────
// Safe error suffix extraction — never leaks signed URLs / provider config.
// ─────────────────────────────────────────────────────────────────────────

const PROVIDER_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  /X-Amz-Signature/i,
  /X-Amz-Credential/i,
  /X-Amz-Security-Token/i,
  /X-Amz-Date=/i,
  /X-Amz-Expires=/i,
  /X-Amz-SignedHeaders/i,
  /AKIA[A-Z0-9]{4,}/,
  /\bxynes_live_[a-f0-9]+/i,
  /r2\.cloudflarestorage\.com/i,
  /backblazeb2\.com/i,
  /idrivee2-\w+\.com/i,
  /amazonaws\.com/i,
];

/**
 * Returns `true` if `message` resembles a presigned-URL parameter, a
 * provider endpoint hostname, or a raw access-key string. Used by
 * `resolveSafeErrorCode` to bail out of message echo paths if anything
 * suspicious shows up. Defense-in-depth on top of the closed-set
 * code-only error suffix policy.
 */
const looksLikeProviderLeak = (message: string): boolean =>
  PROVIDER_LEAK_PATTERNS.some((re) => re.test(message));

async function resolveSafeErrorCode(
  response: Response,
): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as unknown;
    if (!isRecord(body)) return null;
    const error = isRecord(body.error) ? body.error : null;
    const code = error && isNonEmptyString(error.code) ? error.code.trim() : "";
    if (!code) return null;
    // Closed-set identifiers from the storage-service / gateway error
    // catalogue. Defensive double-check: if the code itself somehow
    // matches a known provider leak pattern, drop it.
    if (looksLikeProviderLeak(code)) return null;
    return code;
  } catch {
    return null;
  }
}

async function safeGatewayError(
  response: Response,
  errorContext: string,
): Promise<Error> {
  const code = await resolveSafeErrorCode(response);
  const suffix = code ? ` (${code})` : "";
  return new Error(
    `Failed to ${errorContext}: HTTP ${response.status} ${response.statusText}${suffix}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Gateway request helpers.
// ─────────────────────────────────────────────────────────────────────────

const createJsonHeaders = (accessToken: string): Record<string, string> => ({
  Accept: "application/json",
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});

const createReadHeaders = (accessToken: string): Record<string, string> => ({
  Accept: "application/json",
  Authorization: `Bearer ${accessToken}`,
});

const unwrapEnvelopeOrThrow = async (
  response: Response,
  errorContext: string,
): Promise<Record<string, unknown>> => {
  if (!response.ok) {
    throw await safeGatewayError(response, errorContext);
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error(`Invalid ${errorContext} response: non-JSON body`);
  }
  const unwrapped = unwrapGatewayEnvelope(raw);
  if (!isRecord(unwrapped)) {
    throw new Error(`Invalid ${errorContext} response`);
  }
  return unwrapped;
};

// ─────────────────────────────────────────────────────────────────────────
// 1) Create upload session.
// ─────────────────────────────────────────────────────────────────────────

export interface CreateUploadSessionFileInput {
  readonly filename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly sha256?: string;
  readonly purpose?: string;
  readonly visibility?: StorageObjectVisibility;
  readonly compression?: boolean;
}

export interface CreateUploadSessionArgs {
  readonly apiBaseUrl: string;
  readonly workspaceId: string;
  readonly accessToken: string;
  readonly file: CreateUploadSessionFileInput;
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
}

export async function createStorageUploadSession({
  apiBaseUrl,
  workspaceId,
  accessToken,
  file,
  fetchImpl = fetch,
  signal,
}: CreateUploadSessionArgs): Promise<CreateUploadSessionResult> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "create storage upload session",
  });

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/storage/uploads`;

  const body: Record<string, unknown> = {
    operation: "create",
    filename: file.filename,
    contentType: file.contentType,
    byteSize: file.byteSize,
    purpose: file.purpose ?? CMS_DEFAULT_UPLOAD_PURPOSE,
    visibility: file.visibility ?? CMS_DEFAULT_UPLOAD_VISIBILITY,
    compression: file.compression ?? CMS_DEFAULT_UPLOAD_COMPRESSION,
  };
  if (file.sha256 !== undefined) {
    body.sha256 = file.sha256;
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify(body),
    signal,
  });

  const unwrapped = await unwrapEnvelopeOrThrow(
    response,
    "create storage upload session",
  );

  if (
    !isUploadMethod(unwrapped.uploadMethod) ||
    !isNonEmptyString(unwrapped.uploadId) ||
    !isNonEmptyString(unwrapped.objectId) ||
    !isNonEmptyString(unwrapped.expiresAt) ||
    !isRecord(unwrapped.object)
  ) {
    throw new Error("Invalid create storage upload session response");
  }

  return {
    uploadId: unwrapped.uploadId,
    objectId: unwrapped.objectId,
    uploadMethod: unwrapped.uploadMethod,
    uploadUrl: isNonEmptyString(unwrapped.uploadUrl)
      ? unwrapped.uploadUrl
      : null,
    uploadHeaders: parseUploadHeaders(unwrapped.uploadHeaders),
    parts: parseUploadParts(unwrapped.parts),
    expiresAt: unwrapped.expiresAt,
    object: parseStorageObject(unwrapped.object),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 2) Direct provider upload.
//
// SECURITY CONTRACT (STORAGE-10):
//   - `credentials: 'omit'` so the browser does NOT attach the Xynes
//     session cookie to provider domains.
//   - Only the provider-signed headers from `session.uploadHeaders` (or
//     the part URL itself) are forwarded — no Xynes Authorization, no
//     Cookie, no X-XS-* actor headers.
//   - The request body is the raw `Blob` / `ArrayBuffer` — never an
//     envelope, never JSON.
// ─────────────────────────────────────────────────────────────────────────

export interface DirectProviderUploadArgs {
  readonly session: CreateUploadSessionResult;
  readonly blob: Blob;
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
}

async function putToProvider({
  url,
  body,
  providerHeaders,
  fetchImpl,
  signal,
}: {
  url: string;
  body: Blob;
  providerHeaders: Readonly<Record<string, string>>;
  fetchImpl: FetchLike;
  signal: AbortSignal | undefined;
}): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      // Defense-in-depth: a fresh credential-less fetch. Even though the
      // provider host is cross-origin, this guarantees no Xynes cookie
      // ever leaks if a future deploy puts the gateway and the provider
      // on the same parent domain.
      credentials: "omit",
      headers: { ...providerHeaders },
      body,
      signal,
    });
  } catch {
    // Re-throw a generic message — fetch errors can contain hostile data.
    throw new Error("Provider upload failed: network error");
  }

  if (!response.ok) {
    // Never echo the response body — it may include presigned URL
    // parameters or provider-side state.
    throw new Error(
      `Provider upload failed: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return response;
}

export async function directProviderUpload({
  session,
  blob,
  fetchImpl = fetch,
  signal,
}: DirectProviderUploadArgs): Promise<DirectUploadResult> {
  if (session.uploadMethod === "single") {
    if (!isNonEmptyString(session.uploadUrl)) {
      throw new Error("Cannot upload: missing uploadUrl on single session");
    }
    await putToProvider({
      url: session.uploadUrl,
      body: blob,
      providerHeaders: session.uploadHeaders,
      fetchImpl,
      signal,
    });
    return { parts: [] };
  }

  // multipart
  if (session.parts.length === 0) {
    throw new Error("Cannot upload: multipart session has no parts");
  }

  // Codex P1 (PR #33): map byte ranges to parts by `partNumber`, NOT by the
  // incoming array's iteration order. If the gateway / storage-service ever
  // returns `session.parts` out of order (or callers ever reorder it), slicing
  // by array index would upload part 1's bytes against part 2's URL and the
  // provider would reassemble the object in the wrong byte order — silent
  // corruption with no failure signal until a reader notices.
  //
  // The fix: sort a local copy ascending by `partNumber` (1-based), then slice
  // the blob by each part's *ordinal position in the sorted sequence*. The
  // result is identical to the old behaviour when `parts` already arrived
  // sorted (covers every today's case), and correct when it doesn't.
  //
  // `parseUploadParts` already rejects non-integer / out-of-range / duplicate
  // `partNumber` values, so the sort key is guaranteed unique here.
  const sortedParts = [...session.parts].sort(
    (a, b) => a.partNumber - b.partNumber,
  );

  const partSize = Math.ceil(blob.size / sortedParts.length);
  const completed: CompletedPart[] = [];

  for (let i = 0; i < sortedParts.length; i++) {
    const partSpec = sortedParts[i];
    const start = i * partSize;
    const end = Math.min(start + partSize, blob.size);
    const chunk = blob.slice(start, end);

    const response = await putToProvider({
      url: partSpec.url,
      body: chunk,
      // Multipart part URLs already carry the signature; uploadHeaders
      // are not re-sent per part (storage-service signs them into the
      // URL itself).
      providerHeaders: {},
      fetchImpl,
      signal,
    });

    const etag = response.headers.get("ETag");
    if (!isNonEmptyString(etag)) {
      throw new Error("Provider response missing ETag for multipart part");
    }
    completed.push({ partNumber: partSpec.partNumber, etag });
  }

  return { parts: completed };
}

// ─────────────────────────────────────────────────────────────────────────
// 3) Complete upload session.
// ─────────────────────────────────────────────────────────────────────────

export interface CompleteUploadSessionArgs {
  readonly apiBaseUrl: string;
  readonly workspaceId: string;
  readonly uploadId: string;
  readonly accessToken: string;
  readonly sha256?: string;
  readonly parts?: ReadonlyArray<CompletedPart>;
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
}

export async function completeStorageUploadSession({
  apiBaseUrl,
  workspaceId,
  uploadId,
  accessToken,
  sha256,
  parts,
  fetchImpl = fetch,
  signal,
}: CompleteUploadSessionArgs): Promise<CompleteUploadResult> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "complete storage upload session",
  });
  const normalizedUploadId = normalizeNonEmptyId(uploadId, "Upload id");

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/storage/uploads/${encodeURIComponent(normalizedUploadId)}/complete`;

  const body: Record<string, unknown> = {
    operation: "complete",
    uploadId: normalizedUploadId,
  };
  if (sha256 !== undefined) body.sha256 = sha256;
  if (parts !== undefined && parts.length > 0) body.parts = parts;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify(body),
    signal,
  });

  const unwrapped = await unwrapEnvelopeOrThrow(
    response,
    "complete storage upload session",
  );

  if (!isRecord(unwrapped.object) || !isRecord(unwrapped.session)) {
    throw new Error("Invalid complete storage upload session response");
  }

  const processingJobs: ProcessingJob[] = [];
  if (Array.isArray(unwrapped.processingJobs)) {
    for (const job of unwrapped.processingJobs) {
      try {
        processingJobs.push(parseProcessingJob(job));
      } catch {
        // Skip malformed entries — never fail the whole completion on a
        // single bad job row (parity with workspace-integrations-client
        // per-row tolerance).
      }
    }
  }

  return {
    object: parseStorageObject(unwrapped.object),
    session: parseUploadSession(unwrapped.session),
    processingJobs,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 4) Abort upload session.
// ─────────────────────────────────────────────────────────────────────────

export interface AbortUploadSessionArgs {
  readonly apiBaseUrl: string;
  readonly workspaceId: string;
  readonly uploadId: string;
  readonly accessToken: string;
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
}

export async function abortStorageUploadSession({
  apiBaseUrl,
  workspaceId,
  uploadId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: AbortUploadSessionArgs): Promise<AbortUploadResult> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "abort storage upload session",
  });
  const normalizedUploadId = normalizeNonEmptyId(uploadId, "Upload id");

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/storage/uploads/${encodeURIComponent(normalizedUploadId)}/abort`;

  const body = {
    operation: "abort",
    uploadId: normalizedUploadId,
  };

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify(body),
    signal,
  });

  const unwrapped = await unwrapEnvelopeOrThrow(
    response,
    "abort storage upload session",
  );

  if (!isRecord(unwrapped.session)) {
    throw new Error("Invalid abort storage upload session response");
  }

  return { session: parseUploadSession(unwrapped.session) };
}

// ─────────────────────────────────────────────────────────────────────────
// 5) Get storage object metadata.
// ─────────────────────────────────────────────────────────────────────────

export interface GetStorageObjectArgs {
  readonly apiBaseUrl: string;
  readonly workspaceId: string;
  readonly objectId: string;
  readonly accessToken: string;
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
}

export async function getStorageObject({
  apiBaseUrl,
  workspaceId,
  objectId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: GetStorageObjectArgs): Promise<StorageObjectDetail | null> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "load storage object",
  });
  const normalizedObjectId = normalizeNonEmptyId(objectId, "Object id");

  // The storage-service `objects.read` action key uses a payload-level
  // `operation` discriminator (see STORAGE-6). For GET routes the
  // gateway merges URL query into the payload, so we pass `operation`
  // as a query parameter rather than a JSON body.
  const endpoint =
    `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/storage/objects/${encodeURIComponent(normalizedObjectId)}` +
    `?operation=get`;

  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: createReadHeaders(normalized.accessToken),
    signal,
  });

  if (response.status === 404) {
    return null;
  }

  const unwrapped = await unwrapEnvelopeOrThrow(
    response,
    "load storage object",
  );

  if (!isRecord(unwrapped.object)) {
    throw new Error("Invalid load storage object response");
  }

  const variants: StorageObjectVariant[] = [];
  if (Array.isArray(unwrapped.variants)) {
    for (const v of unwrapped.variants) {
      try {
        variants.push(parseVariant(v));
      } catch {
        // Skip malformed entries.
      }
    }
  }

  const processingJobs: ProcessingJob[] = [];
  if (Array.isArray(unwrapped.processingJobs)) {
    for (const j of unwrapped.processingJobs) {
      try {
        processingJobs.push(parseProcessingJob(j));
      } catch {
        // Skip malformed entries.
      }
    }
  }

  return {
    object: parseStorageObject(unwrapped.object),
    variants,
    processingJobs,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 6) Create short-lived signed download URL.
// ─────────────────────────────────────────────────────────────────────────

export interface CreateDownloadUrlArgs {
  readonly apiBaseUrl: string;
  readonly workspaceId: string;
  readonly objectId: string;
  readonly accessToken: string;
  readonly expiresInSeconds?: number;
  readonly downloadFilename?: string;
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
}

export async function createStorageDownloadUrl({
  apiBaseUrl,
  workspaceId,
  objectId,
  accessToken,
  expiresInSeconds,
  downloadFilename,
  fetchImpl = fetch,
  signal,
}: CreateDownloadUrlArgs): Promise<DownloadUrlResult> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "create storage download URL",
  });
  const normalizedObjectId = normalizeNonEmptyId(objectId, "Object id");

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/storage/objects/${encodeURIComponent(normalizedObjectId)}/download-url`;

  const body: Record<string, unknown> = {
    operation: "download_url",
    objectId: normalizedObjectId,
  };
  if (expiresInSeconds !== undefined) {
    body.expiresInSeconds = expiresInSeconds;
  }
  if (downloadFilename !== undefined) {
    body.downloadFilename = downloadFilename;
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify(body),
    signal,
  });

  const unwrapped = await unwrapEnvelopeOrThrow(
    response,
    "create storage download URL",
  );

  if (
    !isNonEmptyString(unwrapped.objectId) ||
    !isNonEmptyString(unwrapped.url) ||
    !isNonEmptyString(unwrapped.expiresAt)
  ) {
    throw new Error("Invalid create storage download URL response");
  }

  // EXACTLY { objectId, url, expiresAt } — no hostile field bleed.
  return {
    objectId: unwrapped.objectId,
    url: unwrapped.url,
    expiresAt: unwrapped.expiresAt,
  };
}
