/**
 * Workspace Admin integration link builder.
 *
 * The CMS console is a *consumer* of the Workspace Admin integrations surface
 * (per `xynes/xynes-infra/infra/architecture/epics/workspace-admin-integrations.md`).
 * It must not host global lifecycle forms for verified domains or API keys —
 * those forms live in the Workspace Admin (auth) app. Use this builder to
 * generate deep links that point users to the right Workspace Admin tab/preset.
 *
 * Security notes:
 *  - Only `http:` and `https:` origins from `NEXT_PUBLIC_AUTH_APP_URL` are honored.
 *  - Anything malformed, empty, whitespace, or with a non-http(s) scheme falls
 *    back to a same-origin relative path so the link cannot be hijacked into a
 *    `javascript:` / `data:` / `file:` redirect.
 */

export type WorkspaceAdminIntegrationTarget =
  | "domains"
  | "api_keys"
  | "cms_readonly_key"
  | "cms_publisher_key";

const RELATIVE_BASE_PATH = "/dashboard/integrations";

const QUERY_BY_TARGET: Record<WorkspaceAdminIntegrationTarget, string> = {
  domains: "tab=domains",
  api_keys: "tab=api-keys",
  cms_readonly_key: "tab=api-keys&preset=cms_readonly",
  cms_publisher_key: "tab=api-keys&preset=cms_publisher",
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function resolveAuthAppOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_AUTH_APP_URL?.trim();
  if (!raw) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  // Allowlist on the protocol *as parsed*, not on the raw string. A protocol
  // is `http:` or `https:` — anything else (including `javascript:`,
  // `data:`, `file:`, `vbscript:`, `ws:`, `ftp:`) is rejected.
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return null;
  }

  // Defense-in-depth: reject any URL that embeds credentials. `URL.origin`
  // would silently strip them, but accepting such an env value is a sign of
  // operator misconfiguration and the credentials could surface elsewhere.
  if (parsed.username !== "" || parsed.password !== "") {
    return null;
  }

  // `URL.origin` drops trailing slashes, paths, query, and fragment, and
  // (since Node 14 / WHATWG) lowercases the host. The result is always one
  // of: a real http(s) origin, the literal string `"null"` (for opaque
  // origins like `data:`), or `""` for some non-special schemes. We've
  // already filtered all of those by the protocol check above, but
  // belt-and-suspenders: re-assert the prefix.
  const origin = parsed.origin;
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    return null;
  }

  return origin;
}

export function buildWorkspaceAdminIntegrationUrl(
  target: WorkspaceAdminIntegrationTarget,
): string {
  const query = QUERY_BY_TARGET[target];
  const origin = resolveAuthAppOrigin();

  if (origin) {
    return `${origin}${RELATIVE_BASE_PATH}?${query}`;
  }

  return `${RELATIVE_BASE_PATH}?${query}`;
}
