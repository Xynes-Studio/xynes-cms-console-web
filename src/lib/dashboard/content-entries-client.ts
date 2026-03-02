import {
  isNonEmptyString,
  isRecord,
  normalizeGatewayClientInputs,
  unwrapGatewayEnvelope,
} from "./gateway-client-utils";

type FetchLike = typeof fetch;

export type WorkspaceContentEntryStatus = "draft" | "published" | "archived";
export type WorkspaceContentEntrySortBy = "date" | "title" | "popularity";
export type WorkspaceContentEntrySortDirection = "asc" | "desc";

export interface WorkspaceContentEntry {
  id: string;
  workspaceId: string;
  directoryId: string | null;
  title: string;
  description: string;
  body: unknown;
  tags: string[];
  ownerName: string | null;
  avatarUrl: string | null;
  status: WorkspaceContentEntryStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  collaborators: string[];
  isFavorite: boolean;
}

export interface WorkspaceContentEntriesListResult {
  items: WorkspaceContentEntry[];
  count: number;
}

export interface WorkspaceContentEntriesListQuery {
  directoryId?: string | null;
  search?: string;
  sortBy?: WorkspaceContentEntrySortBy;
  sortDirection?: WorkspaceContentEntrySortDirection;
  status?: WorkspaceContentEntryStatus | "all";
  limit?: number;
  offset?: number;
}

export interface WorkspaceContentEntryCreatePayload {
  directoryId?: string | null;
  title: string;
  description?: string;
  body?: Record<string, unknown>;
  tags?: string[];
  ownerName?: string;
  avatarUrl?: string;
  publishNow?: boolean;
}

export interface WorkspaceContentEntryUpdatePayload {
  directoryId?: string | null;
  title?: string;
  description?: string;
  body?: Record<string, unknown>;
  tags?: string[];
  ownerName?: string;
  avatarUrl?: string;
}

const normalizeEntryId = (entryId: string) => {
  const normalizedEntryId = entryId.trim();
  if (!normalizedEntryId) {
    throw new Error("Entry id is required");
  }
  return normalizedEntryId;
};

const normalizeLimit = (limit: number | undefined, fallback: number) => {
  if (limit === undefined) {
    return fallback;
  }
  if (!Number.isFinite(limit)) {
    return fallback;
  }
  return Math.max(1, Math.min(100, Math.trunc(limit)));
};

const normalizeOffset = (offset: number | undefined, fallback: number) => {
  if (offset === undefined) {
    return fallback;
  }
  if (!Number.isFinite(offset)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(offset));
};

const normalizeStatus = (
  status: WorkspaceContentEntriesListQuery["status"],
): WorkspaceContentEntriesListQuery["status"] => {
  if (status === "draft" || status === "published" || status === "archived") {
    return status;
  }
  return "all";
};

const normalizeSortBy = (
  sortBy: WorkspaceContentEntriesListQuery["sortBy"],
): WorkspaceContentEntrySortBy => {
  if (sortBy === "title" || sortBy === "popularity") {
    return sortBy;
  }
  return "date";
};

const normalizeSortDirection = (
  sortDirection: WorkspaceContentEntriesListQuery["sortDirection"],
): WorkspaceContentEntrySortDirection => {
  return sortDirection === "asc" ? "asc" : "desc";
};

const buildEntriesListParams = ({
  query,
  includeSorting,
  includePaging,
}: {
  query: WorkspaceContentEntriesListQuery | undefined;
  includeSorting: boolean;
  includePaging: boolean;
}) => {
  const params = new URLSearchParams();
  const normalizedSearch = query?.search?.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);

  const normalizedDirectoryId = query?.directoryId?.trim();
  if (normalizedDirectoryId) params.set("directoryId", normalizedDirectoryId);

  const normalizedStatus = normalizeStatus(query?.status);
  if (normalizedStatus !== "all") {
    params.set("status", normalizedStatus);
  }

  const normalizedSortBy = normalizeSortBy(query?.sortBy);
  const normalizedSortDirection = normalizeSortDirection(query?.sortDirection);
  if (includeSorting && normalizedSortBy !== "date") {
    params.set("sortBy", normalizedSortBy);
  }
  if (includeSorting && normalizedSortDirection !== "desc") {
    params.set("sortDirection", normalizedSortDirection);
  }

  const normalizedLimit = normalizeLimit(query?.limit, 20);
  const normalizedOffset = normalizeOffset(query?.offset, 0);
  if (includePaging && normalizedLimit !== 20) {
    params.set("limit", String(normalizedLimit));
  }
  if (includePaging && normalizedOffset > 0) {
    params.set("offset", String(normalizedOffset));
  }

  return params;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return value.trim();
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => isNonEmptyString(item))
    .map((item) => item.trim());
};
const isOptionalString = (value: unknown): boolean =>
  value === undefined || value === null || typeof value === "string";

const isWorkspaceContentEntryStatus = (
  value: unknown,
): value is WorkspaceContentEntryStatus =>
  value === "draft" || value === "published" || value === "archived";

const parseWorkspaceContentEntry = (value: unknown): WorkspaceContentEntry => {
  if (!isRecord(value)) {
    throw new Error("Invalid workspace content entry");
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.workspaceId) ||
    !isOptionalString(value.title) ||
    !isOptionalString(value.description) ||
    !isWorkspaceContentEntryStatus(value.status) ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.updatedAt) ||
    typeof value.isFavorite !== "boolean"
  ) {
    throw new Error("Invalid workspace content entry");
  }

  const directoryId = normalizeOptionalString(value.directoryId);
  const ownerName = normalizeOptionalString(value.ownerName);
  const avatarUrl = normalizeOptionalString(value.avatarUrl);
  const publishedAt = normalizeOptionalString(value.publishedAt);
  const description = normalizeOptionalString(value.description) ?? "";
  const title = normalizeOptionalString(value.title) ?? "Untitled";

  return {
    id: value.id.trim(),
    workspaceId: value.workspaceId.trim(),
    directoryId,
    title,
    description,
    body: value.body,
    tags: normalizeStringArray(value.tags),
    ownerName,
    avatarUrl,
    status: value.status,
    publishedAt,
    createdAt: value.createdAt.trim(),
    updatedAt: value.updatedAt.trim(),
    collaborators: normalizeStringArray(value.collaborators),
    isFavorite: value.isFavorite,
  };
};

const createJsonHeaders = (accessToken: string): Record<string, string> => ({
  Accept: "application/json",
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});

const createReadHeaders = (accessToken: string): Record<string, string> => ({
  Accept: "application/json",
  Authorization: `Bearer ${accessToken}`,
});

async function resolveErrorSuffix(response: Response): Promise<string> {
  try {
    const responseJson = (await response.json()) as unknown;
    if (!isRecord(responseJson) || !isRecord(responseJson.error)) {
      return "";
    }

    const code = isNonEmptyString(responseJson.error.code)
      ? responseJson.error.code.trim()
      : "";
    const message = isNonEmptyString(responseJson.error.message)
      ? responseJson.error.message.trim()
      : "";

    if (code && message) {
      return ` (${code}: ${message})`;
    }
    if (message) {
      return ` (${message})`;
    }
    return code ? ` (${code})` : "";
  } catch {
    return "";
  }
}

async function resolveErrorDetails(response: Response): Promise<{
  code?: string;
  message?: string;
  requestId?: string;
}> {
  try {
    const responseJson = (await response.clone().json()) as unknown;
    const envelope = isRecord(responseJson) ? responseJson : null;
    const error = envelope && isRecord(envelope.error) ? envelope.error : null;
    const meta = envelope && isRecord(envelope.meta) ? envelope.meta : null;

    const code =
      error && isNonEmptyString(error.code) ? error.code.trim() : undefined;
    const message =
      error && isNonEmptyString(error.message)
        ? error.message.trim()
        : undefined;
    const requestId =
      meta && isNonEmptyString(meta.requestId)
        ? meta.requestId.trim()
        : undefined;

    return { code, message, requestId };
  } catch {
    return {};
  }
}

async function parseEntryResponse({
  response,
  errorContext,
}: {
  response: Response;
  errorContext: string;
}): Promise<WorkspaceContentEntry> {
  if (!response.ok) {
    const errorSuffix = await resolveErrorSuffix(response);
    throw new Error(
      `Failed to ${errorContext}: HTTP ${response.status} ${response.statusText}${errorSuffix}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);

  if (!isRecord(unwrapped) || !("entry" in unwrapped)) {
    throw new Error(`Invalid ${errorContext} response`);
  }

  return parseWorkspaceContentEntry(unwrapped.entry);
}

export async function listWorkspaceContentEntries({
  apiBaseUrl,
  workspaceId,
  accessToken,
  query,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  query?: WorkspaceContentEntriesListQuery;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentEntriesListResult> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entries lookup",
  });

  const endpointBase = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries`;
  const primaryParams = buildEntriesListParams({
    query,
    includeSorting: true,
    includePaging: true,
  });

  const buildEndpoint = (params: URLSearchParams) => {
    const queryString = params.toString();
    return queryString ? `${endpointBase}?${queryString}` : endpointBase;
  };

  let response = await fetchImpl(buildEndpoint(primaryParams), {
    method: "GET",
    headers: createReadHeaders(normalized.accessToken),
    signal,
  });

  if (response.status === 400) {
    const compatibilityParams = buildEntriesListParams({
      query,
      includeSorting: false,
      includePaging: false,
    });

    if (compatibilityParams.toString() !== primaryParams.toString()) {
      response = await fetchImpl(buildEndpoint(compatibilityParams), {
        method: "GET",
        headers: createReadHeaders(normalized.accessToken),
        signal,
      });
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      return { items: [], count: 0 };
    }
    const errorDetails = await resolveErrorDetails(response);
    console.error("[CMS][list] request failed", {
      status: response.status,
      statusText: response.statusText,
      code: errorDetails.code,
      requestId: errorDetails.requestId,
      message: errorDetails.message,
    });
    throw new Error(
      `Failed to load content entries: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (!isRecord(unwrapped) || !Array.isArray(unwrapped.items)) {
    throw new Error("Invalid content entries list response");
  }

  const items = unwrapped.items.flatMap((item) => {
    try {
      return [parseWorkspaceContentEntry(item)];
    } catch (parseError) {
      console.warn("[CMS][list] dropping malformed entry", {
        entryId:
          isRecord(item) && isNonEmptyString(item.id) ? item.id.trim() : null,
        reason:
          parseError instanceof Error
            ? parseError.message
            : String(parseError ?? "unknown"),
      });
      return [];
    }
  });
  const reportedCount =
    typeof unwrapped.count === "number" && Number.isFinite(unwrapped.count)
      ? Math.max(0, Math.trunc(unwrapped.count))
      : items.length;

  const count = items.length === 0 ? 0 : Math.min(reportedCount, items.length);

  return { items, count };
}

export async function getWorkspaceContentEntryById({
  apiBaseUrl,
  workspaceId,
  entryId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentEntry> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry lookup",
  });
  const normalizedEntryId = normalizeEntryId(entryId);

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}`;
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: createReadHeaders(normalized.accessToken),
    signal,
  });

  return parseEntryResponse({ response, errorContext: "load content entry" });
}

export async function createWorkspaceContentEntry({
  apiBaseUrl,
  workspaceId,
  accessToken,
  payload,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  payload: WorkspaceContentEntryCreatePayload;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentEntry> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry create",
  });

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorDetails = await resolveErrorDetails(response);
    console.error("[CMS][create] request failed", {
      workspaceId: normalized.workspaceId,
      hasDirectoryId: Boolean(payload.directoryId?.trim()),
      status: response.status,
      statusText: response.statusText,
      code: errorDetails.code,
      requestId: errorDetails.requestId,
      message: errorDetails.message,
    });
  }

  return parseEntryResponse({ response, errorContext: "create content entry" });
}

export async function updateWorkspaceContentEntry({
  apiBaseUrl,
  workspaceId,
  entryId,
  accessToken,
  payload,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  accessToken: string;
  payload: WorkspaceContentEntryUpdatePayload;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentEntry> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry update",
  });
  const normalizedEntryId = normalizeEntryId(entryId);

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}`;
  const response = await fetchImpl(endpoint, {
    method: "PATCH",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify(payload),
    signal,
  });

  return parseEntryResponse({ response, errorContext: "update content entry" });
}

export async function publishWorkspaceContentEntry({
  apiBaseUrl,
  workspaceId,
  entryId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentEntry> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry publish",
  });
  const normalizedEntryId = normalizeEntryId(entryId);

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}/publish`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify({}),
    signal,
  });

  return parseEntryResponse({
    response,
    errorContext: "publish content entry",
  });
}

export async function deleteWorkspaceContentEntry({
  apiBaseUrl,
  workspaceId,
  entryId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<{ success: boolean; entryId: string; deletedAt: string | null }> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry delete",
  });
  const normalizedEntryId = normalizeEntryId(entryId);

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}`;
  const response = await fetchImpl(endpoint, {
    method: "DELETE",
    headers: createReadHeaders(normalized.accessToken),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to delete content entry: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (
    !isRecord(unwrapped) ||
    unwrapped.success !== true ||
    !isNonEmptyString(unwrapped.entryId)
  ) {
    throw new Error("Invalid content entry delete response");
  }

  return {
    success: true,
    entryId: unwrapped.entryId.trim(),
    deletedAt: normalizeOptionalString(unwrapped.deletedAt),
  };
}

export async function setWorkspaceEntryCollaborators({
  apiBaseUrl,
  workspaceId,
  entryId,
  accessToken,
  collaborators,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  accessToken: string;
  collaborators: Array<{ userId: string; displayName?: string }>;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<{ entryId: string; collaborators: string[] }> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry collaborators update",
  });
  const normalizedEntryId = normalizeEntryId(entryId);

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}/collaborators`;
  const response = await fetchImpl(endpoint, {
    method: "PUT",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify({ collaborators }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update content entry collaborators: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);

  if (
    !isRecord(unwrapped) ||
    !isNonEmptyString(unwrapped.entryId) ||
    !Array.isArray(unwrapped.collaborators)
  ) {
    throw new Error("Invalid content entry collaborators response");
  }

  return {
    entryId: unwrapped.entryId.trim(),
    collaborators: normalizeStringArray(unwrapped.collaborators),
  };
}

export async function toggleWorkspaceEntryFavorite({
  apiBaseUrl,
  workspaceId,
  entryId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<{ entryId: string; isFavorite: boolean }> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry favorite toggle",
  });
  const normalizedEntryId = normalizeEntryId(entryId);

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}/favorite`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify({}),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to toggle content entry favorite: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (
    !isRecord(unwrapped) ||
    !isNonEmptyString(unwrapped.entryId) ||
    typeof unwrapped.isFavorite !== "boolean"
  ) {
    throw new Error("Invalid content entry favorite response");
  }

  return {
    entryId: unwrapped.entryId.trim(),
    isFavorite: unwrapped.isFavorite,
  };
}

export async function listWorkspaceFavoriteEntries({
  apiBaseUrl,
  workspaceId,
  accessToken,
  limit,
  offset,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  limit?: number;
  offset?: number;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentEntriesListResult> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "favorite content entries lookup",
  });

  const params = new URLSearchParams({
    limit: String(normalizeLimit(limit, 20)),
    offset: String(normalizeOffset(offset, 0)),
  });

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/favorites?${params.toString()}`;
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: createReadHeaders(normalized.accessToken),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load favorite content entries: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);

  if (!isRecord(unwrapped) || !Array.isArray(unwrapped.items)) {
    throw new Error("Invalid favorite content entries response");
  }

  const items = unwrapped.items.map(parseWorkspaceContentEntry);
  const count =
    typeof unwrapped.count === "number" && Number.isFinite(unwrapped.count)
      ? Math.max(0, Math.trunc(unwrapped.count))
      : items.length;

  return { items, count };
}

export async function generateWorkspaceEntryShareLink({
  apiBaseUrl,
  workspaceId,
  entryId,
  workspaceSlug,
  accessToken,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  entryId: string;
  workspaceSlug: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<{ url: string }> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content entry share link generation",
  });

  const normalizedEntryId = normalizeEntryId(entryId);
  const normalizedWorkspaceSlug = workspaceSlug.trim();
  if (!normalizedWorkspaceSlug) {
    throw new Error("Workspace slug is required");
  }

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content/entries/${encodeURIComponent(normalizedEntryId)}/share-link`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: createJsonHeaders(normalized.accessToken),
    body: JSON.stringify({ workspaceSlug: normalizedWorkspaceSlug }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to generate content entry share link: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (!isRecord(unwrapped) || !isNonEmptyString(unwrapped.url)) {
    throw new Error("Invalid content entry share link response");
  }

  return { url: unwrapped.url.trim() };
}
