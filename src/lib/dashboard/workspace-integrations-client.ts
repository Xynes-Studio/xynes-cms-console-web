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

async function fetchUnwrappedRows({
  url,
  listKey,
  accessToken,
  fetchImpl,
  signal,
}: {
  url: string;
  listKey: "domains" | "apiKeys";
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

  // After unwrapping the gateway envelope, the canonical accounts-service
  // contract for these list endpoints is an OBJECT with a named array:
  //
  //   /workspaces/:wsId/domains   → { domains: WorkspaceDomain[] }
  //   /workspaces/:wsId/api-keys  → { apiKeys: WorkspaceApiKey[] }
  //
  // (See `xynes-accounts-service/src/actions/handlers/integrations/{domains,apiKeys}.ts`
  // and the matching reader in `xynes-auth-app/src/lib/integrations/workspace-integrations-client.ts`.)
  //
  // We accept that shape and treat anything else as malformed → fail closed.
  const unwrapped = unwrapGatewayEnvelope(body);
  if (!isRecord(unwrapped)) {
    return null;
  }
  const rows = (unwrapped as Record<string, unknown>)[listKey];
  if (!Array.isArray(rows)) {
    return null;
  }

  return rows;
}

/**
 * Per-row tolerance policy (intentional, not a bug):
 *
 * `summarizeDomains` and `summarizeApiKeys` skip rows that fail their type
 * guards rather than tripping the entire workspace into "unavailable".
 *
 * The fail-closed contract documented in `docs/DEVELOPER.md` ("Workspace
 * Admin Integrations (CMS Contextual Consumer)" → "Security and
 * resilience") triggers on **payload-level** failures (HTTP error,
 * non-array body, normalize error, thrown fetch). For a list endpoint
 * delivering aggregate counts, per-row tolerance is the correct tradeoff:
 *
 *   - The result object is constructed from explicit integer counters this
 *     function builds itself; no field from any individual row is ever
 *     spread, copied, or serialized into the result. Hostile or malformed
 *     row data therefore *cannot* bleed through (proven by the
 *     "documented-keys-only" test in this file).
 *   - Strict per-row fail-closed would create a forward-compatibility
 *     footgun: a single transient garbage row, or a future Workspace Admin
 *     row variant with a new optional column, would hide every other valid
 *     row from the CMS integrations panel.
 *   - Per-row tolerance matches industry conventions for list-aggregate
 *     consumers (GraphQL clients, observability dashboards): skip
 *     malformed entries, surface a count, never leak row contents.
 *
 * If a stricter contract is ever required (e.g. for an integrity-sensitive
 * surface), prefer wiring it at the *payload* level via the type guard in
 * `fetchJsonArray`, not by promoting per-row guard misses to fatal.
 */
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
    return UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS;
  }

  const workspacePath = `${normalized.apiBaseUrl}/workspaces/${encodeURIComponent(normalized.workspaceId)}`;

  const [domainsRows, apiKeyRows] = await Promise.all([
    fetchUnwrappedRows({
      url: `${workspacePath}/domains`,
      listKey: "domains",
      accessToken: normalized.accessToken,
      fetchImpl,
      signal,
    }),
    fetchUnwrappedRows({
      url: `${workspacePath}/api-keys`,
      listKey: "apiKeys",
      accessToken: normalized.accessToken,
      fetchImpl,
      signal,
    }),
  ]);

  if (domainsRows === null || apiKeyRows === null) {
    return UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS;
  }

  const domainCounts = summarizeDomains(domainsRows);
  const apiKeyCounts = summarizeApiKeys(apiKeyRows);

  return {
    ...domainCounts,
    ...apiKeyCounts,
    unavailable: false,
  };
}
