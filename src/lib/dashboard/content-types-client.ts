import type { ContentDirectoryNode } from "./content-directory-tree";

type FetchLike = typeof fetch;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export interface WorkspaceContentType {
  id: string;
  name: string;
  slug: string;
  routeSegment: string;
  templateKey: string;
}

const isWorkspaceContentType = (value: unknown): value is WorkspaceContentType => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.slug) &&
    isNonEmptyString(value.routeSegment) &&
    isNonEmptyString(value.templateKey)
  );
};

const unwrapGatewayEnvelope = (value: unknown): unknown => {
  let current: unknown = value;
  while (isRecord(current) && "data" in current && current.data !== undefined) {
    current = current.data;
  }
  return current;
};

export async function listWorkspaceContentTypes({
  apiBaseUrl,
  workspaceId,
  accessToken,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentType[]> {
  const normalizedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/g, "");
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedApiBaseUrl) {
    throw new Error("Missing apiBaseUrl for content type lookup");
  }
  if (!normalizedWorkspaceId) {
    throw new Error("Missing workspaceId for content type lookup");
  }
  if (!normalizedAccessToken) {
    throw new Error("Missing access token for content type lookup");
  }

  const endpoint = `${normalizedApiBaseUrl}/workspaces/${encodeURIComponent(normalizedWorkspaceId)}/content-types`;
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${normalizedAccessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(
      `Failed to load content types: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (!Array.isArray(unwrapped) || !unwrapped.every(isWorkspaceContentType)) {
    throw new Error("Invalid content types response");
  }

  return unwrapped;
}

export const mapContentTypesToDirectoryNodes = (
  contentTypes: WorkspaceContentType[],
): ContentDirectoryNode[] =>
  contentTypes.map((contentType) => ({
    id: `content-type-${contentType.id}`,
    label: contentType.name,
    pathSegment: contentType.routeSegment,
    children: [],
  }));
