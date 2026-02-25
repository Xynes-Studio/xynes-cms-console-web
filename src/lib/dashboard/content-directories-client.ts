type FetchLike = typeof fetch;
import {
  isNonEmptyString,
  isRecord,
  normalizeGatewayClientInputs,
  unwrapGatewayEnvelope,
} from "./gateway-client-utils";

export interface WorkspaceContentDirectory {
  id: string;
  parentId: string | null;
  name: string;
  pathSegment: string;
}

const isWorkspaceContentDirectory = (
  value: unknown,
): value is WorkspaceContentDirectory => {
  if (!isRecord(value)) {
    return false;
  }

  const parentId = "parentId" in value ? value.parentId : null;
  const isValidParentId =
    parentId === null || parentId === undefined || isNonEmptyString(parentId);

  return (
    isNonEmptyString(value.id) &&
    isValidParentId &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.pathSegment)
  );
};

export async function listWorkspaceContentDirectories({
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
}): Promise<WorkspaceContentDirectory[]> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content directories lookup",
  });

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content-directories`;
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
      `Failed to load content directories: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (
    !Array.isArray(unwrapped) ||
    !unwrapped.every(isWorkspaceContentDirectory)
  ) {
    throw new Error("Invalid content directories response");
  }

  return unwrapped.map((entry) => ({
    id: entry.id.trim(),
    parentId:
      entry.parentId && entry.parentId.trim().length > 0
        ? entry.parentId.trim()
        : null,
    name: entry.name.trim(),
    pathSegment: entry.pathSegment.trim(),
  }));
}

export async function createWorkspaceContentDirectory({
  apiBaseUrl,
  workspaceId,
  accessToken,
  parentId,
  name,
  fetchImpl = fetch,
  signal,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  parentId: string | null;
  name: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<WorkspaceContentDirectory> {
  const normalized = normalizeGatewayClientInputs({
    apiBaseUrl,
    workspaceId,
    accessToken,
    errorContext: "content directories lookup",
  });
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Directory name is required");
  }

  const endpoint = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}/content-directories`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${normalized.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parentId,
      name: normalizedName,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create content directory: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const responseJson = (await response.json()) as unknown;
  const unwrapped = unwrapGatewayEnvelope(responseJson);
  if (!isWorkspaceContentDirectory(unwrapped)) {
    throw new Error("Invalid content directory create response");
  }

  return {
    id: unwrapped.id.trim(),
    parentId:
      unwrapped.parentId && unwrapped.parentId.trim().length > 0
        ? unwrapped.parentId.trim()
        : null,
    name: unwrapped.name.trim(),
    pathSegment: unwrapped.pathSegment.trim(),
  };
}
