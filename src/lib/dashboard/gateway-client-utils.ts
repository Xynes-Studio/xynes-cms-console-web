export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const unwrapGatewayEnvelope = (value: unknown): unknown => {
  let current: unknown = value;
  while (isRecord(current) && "data" in current && current.data !== undefined) {
    current = current.data;
  }
  return current;
};

export function normalizeGatewayClientInputs({
  apiBaseUrl,
  workspaceId,
  accessToken,
  errorContext,
}: {
  apiBaseUrl: string;
  workspaceId: string;
  accessToken: string;
  errorContext: string;
}) {
  const normalizedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/g, "");
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedApiBaseUrl) {
    throw new Error(`Missing apiBaseUrl for ${errorContext}`);
  }
  if (!normalizedWorkspaceId) {
    throw new Error(`Missing workspaceId for ${errorContext}`);
  }
  if (!normalizedAccessToken) {
    throw new Error(`Missing access token for ${errorContext}`);
  }

  return {
    apiBaseUrl: normalizedApiBaseUrl,
    workspaceId: normalizedWorkspaceId,
    accessToken: normalizedAccessToken,
  };
}

