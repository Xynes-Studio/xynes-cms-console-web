/**
 * Workspace Admin integration link builder.
 *
 * The CMS console is a *consumer* of the Workspace Admin integrations surface
 * (per `xynes/xynes-infra/infra/architecture/epics/workspace-admin-integrations.md`).
 * It must not host global lifecycle forms for verified domains or API keys —
 * those forms live in the Workspace Admin (auth) app. Use this builder to
 * generate deep links that point users to the right Workspace Admin tab/preset.
 *
 * **Cross-package contract (PFU-6):** the `?preset=<key>` query-parameter
 * values are typed against the canonical
 * `@xynes/platform-contracts` `WORKSPACE_API_KEY_PRESET_KEYS` list (mirrored
 * locally in `./workspace-api-key-preset-keys.ts`). A canonical-list rename
 * surfaces as a TypeScript error in the mirror file, not as a silently
 * broken `?preset=…` URL in production.
 *
 * **Cross-app workspace handoff (FE-XAPP-BUG-001):** the builder appends an
 * additional `&workspace=<slug>` query parameter so the Auth App can resolve
 * the originating workspace and call `selectWorkspace(matchedId)` on landing.
 * Without this, the two apps maintain independent `currentWorkspace` state
 * (separate localStorage origins) and the user silently lands on a different
 * workspace than the one they were administering in CMS Console.
 *
 * The slug is NOT a permission grant. The Auth App must verify the recipient
 * is actually a member of the slug-resolved workspace (via the server-
 * authoritative `useAuth().workspaces`) before honoring the override. A
 * malicious or stale slug fails closed — the Auth App keeps its prior
 * selection.
 *
 * Security notes:
 *  - Only `http:` and `https:` origins from `NEXT_PUBLIC_AUTH_APP_URL` are honored.
 *  - Anything malformed, empty, whitespace, or with a non-http(s) scheme falls
 *    back to a same-origin relative path so the link cannot be hijacked into a
 *    `javascript:` / `data:` / `file:` redirect.
 *  - The `workspaceSlug` is URL-encoded before being embedded.
 *  - An empty / whitespace-only slug is omitted from the URL — the recipient
 *    falls through to its existing localStorage-based selection.
 */

import {
  CMS_READONLY_PRESET_KEY,
  CMS_PUBLISHER_PRESET_KEY,
} from "./workspace-api-key-preset-keys";

export type WorkspaceAdminIntegrationTarget =
  | "domains"
  | "api_keys"
  | "cms_readonly_key"
  | "cms_publisher_key";

const RELATIVE_BASE_PATH = "/dashboard/integrations";

const QUERY_BY_TARGET: Record<WorkspaceAdminIntegrationTarget, string> = {
  domains: "tab=domains",
  api_keys: "tab=api-keys",
  cms_readonly_key: `tab=api-keys&preset=${CMS_READONLY_PRESET_KEY}`,
  cms_publisher_key: `tab=api-keys&preset=${CMS_PUBLISHER_PRESET_KEY}`,
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

/**
 * Build a Workspace Admin deep link for the given target tab/preset, carrying
 * the originating workspace identity via `?workspace=<slug>`.
 *
 * @param target          Which Workspace Admin surface to deep-link into.
 * @param workspaceSlug   Slug of the workspace currently selected in CMS
 *                        Console. When non-empty (after trimming), it is
 *                        URL-encoded and appended as `&workspace=<slug>`.
 *                        Empty / whitespace-only slugs are omitted so the
 *                        recipient falls through to its existing selection.
 *                        Slug is NOT a permission grant — the Auth App
 *                        re-verifies membership before honoring it.
 */
export function buildWorkspaceAdminIntegrationUrl(
  target: WorkspaceAdminIntegrationTarget,
  workspaceSlug: string,
): string {
  const baseQuery = QUERY_BY_TARGET[target];
  const trimmedSlug = workspaceSlug.trim();
  const query =
    trimmedSlug === ""
      ? baseQuery
      : `${baseQuery}&workspace=${encodeURIComponent(trimmedSlug)}`;
  const origin = resolveAuthAppOrigin();

  if (origin) {
    return `${origin}${RELATIVE_BASE_PATH}?${query}`;
  }

  return `${RELATIVE_BASE_PATH}?${query}`;
}
