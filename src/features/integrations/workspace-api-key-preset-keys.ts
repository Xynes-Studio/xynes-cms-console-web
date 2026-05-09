/**
 * Workspace API key preset keys — local mirror of the canonical list.
 *
 * **Cross-package contract (PFU-6):** the canonical source of truth is
 * `@xynes/platform-contracts` (`WORKSPACE_API_KEY_PRESET_KEYS` in
 * `xynes/xynes-platform-contracts/src/integrations/api-key-presets.ts`).
 * The accounts-service preset → action-key scope mapping is server-only
 * authz wiring and intentionally not part of the cross-package contract.
 *
 * The CMS console only consumes a subset of the preset keys (the CMS-shaped
 * ones: `cms_readonly` and `cms_publisher`) when it builds Workspace Admin
 * deep links. The full list is mirrored here so the type system catches a
 * canonical-list rename even if the CMS console doesn't currently use the
 * affected key, and so a future feature that needs additional CMS-shaped
 * presets has a typed handle ready.
 *
 * This file does NOT host any preset → scope mapping (server-only) and
 * does NOT host any UI label (the CMS console is a contextual *consumer*
 * of the Workspace Admin integrations surface — labels live in the
 * Workspace Admin UI app).
 *
 * Parity with the canonical contract is enforced by
 * `workspace-api-key-preset-keys.contract.test.ts`.
 */

/**
 * MVP preset key allowlist for workspace API keys. Mirror of
 * `WORKSPACE_API_KEY_PRESET_KEYS` from `@xynes/platform-contracts`.
 */
export const WORKSPACE_API_KEY_PRESET_KEYS = [
  "cms_readonly",
  "cms_authoring",
  "cms_publisher",
  "telemetry_read",
  "workspace_admin",
] as const;

export type WorkspaceApiKeyPresetKey =
  (typeof WORKSPACE_API_KEY_PRESET_KEYS)[number];

/**
 * Type-safe preset key references for the CMS console's deep-link builder.
 *
 * Defining these as named constants (rather than embedding the literals in
 * query-string templates) means a canonical-list rename (e.g.
 * `cms_readonly` → `cms_read`) surfaces as a TS2322 here when the local
 * mirror is updated, instead of as a silently-broken `?preset=cms_readonly`
 * deep link in production.
 */
export const CMS_READONLY_PRESET_KEY: WorkspaceApiKeyPresetKey = "cms_readonly";
export const CMS_PUBLISHER_PRESET_KEY: WorkspaceApiKeyPresetKey =
  "cms_publisher";
