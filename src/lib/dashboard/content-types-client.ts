import type { ContentDirectoryNode } from "./content-directory-tree";
import {
  isNonEmptyString,
  isRecord,
  normalizeGatewayClientInputs,
  unwrapGatewayEnvelope,
} from "./gateway-client-utils";

type FetchLike = typeof fetch;

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
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content type lookup",
  });

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content-types`;
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${normalized.accessToken}`,
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
