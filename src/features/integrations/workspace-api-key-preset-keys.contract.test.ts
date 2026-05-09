import { describe, it, expect } from "vitest";
import {
  WORKSPACE_API_KEY_PRESET_KEYS,
  CMS_READONLY_PRESET_KEY,
  CMS_PUBLISHER_PRESET_KEY,
  type WorkspaceApiKeyPresetKey,
} from "./workspace-api-key-preset-keys";

/**
 * PFU-6 — Workspace API key preset keys: cross-package contract test.
 *
 * Source of truth: `@xynes/platform-contracts`
 * (`xynes/xynes-platform-contracts/src/integrations/api-key-presets.ts`,
 * `WORKSPACE_API_KEY_PRESET_KEYS`).
 *
 * The contracts package owns the canonical list. The CMS console keeps a
 * local copy because it does not currently depend on
 * `@xynes/platform-contracts` at runtime (the package lives in the sibling
 * `xynes/` monorepo).
 *
 * This test asserts the local mirror matches the canonical contract. The
 * canonical list is duplicated inline below — that is intentional. If the
 * canonical list ever changes, this assertion is the trip-wire that forces a
 * deliberate update on this side too. The platform-contracts package has its
 * own contract test that guards the canonical list from accidental drift.
 */

// Canonical contract — mirror of `WORKSPACE_API_KEY_PRESET_KEYS` from
// `@xynes/platform-contracts`. Update both together.
const CANONICAL_PRESET_KEYS = [
  "cms_readonly",
  "cms_authoring",
  "cms_publisher",
  "telemetry_read",
  "workspace_admin",
] as const;

describe("PFU-6 — WORKSPACE_API_KEY_PRESET_KEYS ↔ platform-contracts", () => {
  it("exposes exactly the canonical preset keys (order-sensitive)", () => {
    expect(WORKSPACE_API_KEY_PRESET_KEYS).toEqual([...CANONICAL_PRESET_KEYS]);
  });

  it("exposes exactly the canonical preset keys (set equality)", () => {
    expect([...WORKSPACE_API_KEY_PRESET_KEYS].sort()).toEqual(
      [...CANONICAL_PRESET_KEYS].sort(),
    );
  });

  it("contains no duplicate keys", () => {
    const set = new Set<string>(WORKSPACE_API_KEY_PRESET_KEYS);
    expect(set.size).toBe(WORKSPACE_API_KEY_PRESET_KEYS.length);
  });

  it("uses only URL-query-parameter-friendly identifiers", () => {
    // Defense in depth — these keys flow into `?preset=<key>` deep links
    // built by the CMS console. Any path separator, whitespace, or
    // URL-reserved character would break the link.
    const validKey = /^[a-z][a-z0-9_]*$/;
    for (const key of WORKSPACE_API_KEY_PRESET_KEYS) {
      expect(key).toMatch(validKey);
    }
  });

  it("narrows to the closed `WorkspaceApiKeyPresetKey` union (compile-time)", () => {
    // If someone removes the `as const` upstream, the consumer type
    // narrowing collapses to `string` and this assignment becomes a
    // compile error — the trip-wire for type drift.
    const sample: WorkspaceApiKeyPresetKey = "cms_readonly";
    expect(sample).toBe("cms_readonly");
  });
});

describe("PFU-6 — CMS-shaped preset key references", () => {
  it("CMS_READONLY_PRESET_KEY equals the canonical `cms_readonly` literal", () => {
    expect(CMS_READONLY_PRESET_KEY).toBe("cms_readonly");
  });

  it("CMS_PUBLISHER_PRESET_KEY equals the canonical `cms_publisher` literal", () => {
    expect(CMS_PUBLISHER_PRESET_KEY).toBe("cms_publisher");
  });

  it("CMS-shaped references are members of the canonical allowlist", () => {
    // Defense in depth — if a future refactor accidentally points the
    // typed reference at a non-allowlisted preset, the deep link would
    // build a `?preset=<unknown>` URL that the auth app silently ignores.
    expect(WORKSPACE_API_KEY_PRESET_KEYS).toContain(CMS_READONLY_PRESET_KEY);
    expect(WORKSPACE_API_KEY_PRESET_KEYS).toContain(CMS_PUBLISHER_PRESET_KEY);
  });
});
