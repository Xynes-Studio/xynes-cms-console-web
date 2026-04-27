import {
  isNonEmptyString,
  isRecord,
  normalizeGatewayClientInputs,
  unwrapGatewayEnvelope,
} from "./gateway-client-utils";

type FetchLike = typeof fetch;

/**
 * Read-only integration status surfaced to the CMS console.
 *
 * The CMS console is a *consumer* of the Workspace Admin integrations surface
 * (see `xynes/xynes-infra/infra/architecture/epics/workspace-admin-integrations.md`).
 * It must never expose raw API keys or hashes to the UI — only aggregate counts.
 *
 * `unavailable: true` means we could not reliably load the status (network
 * error, gateway error, malformed response, missing inputs). Counts default to
 * `0` in that case so the UI can fail closed.
 */
export type CmsWorkspaceIntegrationStatus = {
  verifiedDomainCount: number;
  pendingDomainCount: number;
  activeApiKeyCount: number;
  cmsScopedApiKeyCount: number;
  unavailable: boolean;
};

/**
 * Sentinel returned whenever the integration status cannot be reliably
 * loaded (network/HTTP error, malformed payload, missing inputs, thrown
 * fetch). Counts default to `0` so any consuming UI can fail closed without
 * leaking partial data.
 *
 * Exported so callers (panels, tests) can `===` compare or import the
 * canonical shape instead of redeclaring it.
 */
export const UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS: CmsWorkspaceIntegrationStatus =
  Object.freeze({
    verifiedDomainCount: 0,
    pendingDomainCount: 0,
    activeApiKeyCount: 0,
    cmsScopedApiKeyCount: 0,
    unavailable: true,
  });

const UNAVAILABLE_STATUS = UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isWorkspaceDomainSummary = (
  value: unknown,
): value is { status: string } => {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.status);
};

const isWorkspaceApiKeySummary = (
  value: unknown,
): value is { status: string; presetKey: unknown; scopes?: unknown } => {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.status);
};

async function fetchJsonArray({
  url,
  accessToken,
  fetchImpl,
  signal,
}: {
  url: string;
  accessToken: string;
  fetchImpl: FetchLike;
  signal?: AbortSignal;
}): Promise<unknown[] | null> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const unwrapped = unwrapGatewayEnvelope(body);
  if (!Array.isArray(unwrapped)) {
    return null;
  }

  return unwrapped;
}

function summarizeDomains(rows: unknown[]): {
  verifiedDomainCount: number;
  pendingDomainCount: number;
} {
  let verifiedDomainCount = 0;
  let pendingDomainCount = 0;
  for (const row of rows) {
    if (!isWorkspaceDomainSummary(row)) {
      continue;
    }
    if (row.status === "verified") {
      verifiedDomainCount += 1;
    } else if (row.status === "pending") {
      pendingDomainCount += 1;
    }
  }
  return { verifiedDomainCount, pendingDomainCount };
}

function summarizeApiKeys(rows: unknown[]): {
  activeApiKeyCount: number;
  cmsScopedApiKeyCount: number;
} {
  let activeApiKeyCount = 0;
  let cmsScopedApiKeyCount = 0;
  for (const row of rows) {
    if (!isWorkspaceApiKeySummary(row)) {
      continue;
    }
    if (row.status !== "active") {
      continue;
    }
    activeApiKeyCount += 1;

    const isCmsPreset =
      typeof row.presetKey === "string" && row.presetKey.startsWith("cms_");
    const cmsScoped =
      isStringArray(row.scopes) &&
      row.scopes.some((scope) => scope.startsWith("cms."));

    if (isCmsPreset || cmsScoped) {
      cmsScopedApiKeyCount += 1;
    }
  }
  return { activeApiKeyCount, cmsScopedApiKeyCount };
}

export async function fetchCmsWorkspaceIntegrationStatus({
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
}): Promise<CmsWorkspaceIntegrationStatus> {
  let normalized: ReturnType<typeof normalizeGatewayClientInputs>;
  try {
    normalized = normalizeGatewayClientInputs({
      apiBaseUrl,
      workspaceId,
      accessToken,
      errorContext: "workspace integration status",
    });
  } catch {
    return UNAVAILABLE_STATUS;
  }

  const workspacePath = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}`;

  const [domainsRows, apiKeyRows] = await Promise.all([
    fetchJsonArray({
      url: `${workspacePath}/domains`,
      accessToken: normalized.accessToken,
      fetchImpl,
      signal,
    }),
    fetchJsonArray({
      url: `${workspacePath}/api-keys`,
      accessToken: normalized.accessToken,
      fetchImpl,
      signal,
    }),
  ]);

  if (domainsRows === null || apiKeyRows === null) {
    return UNAVAILABLE_STATUS;
  }

  const domainCounts = summarizeDomains(domainsRows);
  const apiKeyCounts = summarizeApiKeys(apiKeyRows);

  return {
    ...domainCounts,
    ...apiKeyCounts,
    unavailable: false,
  };
}
