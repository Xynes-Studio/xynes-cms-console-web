/**
 * STORAGE-LIVE-5 — Tests for `getCmsFeatureFlagOverrides`.
 *
 * Local-dev / CI override parser for `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE`
 * (JSON env var). Mirrors the auth-app's pattern; only difference is the
 * CMS Console scope.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@xynes/auth-sdk", () => ({
  // STORAGE-LIVE-5: stub the SDK normalizer for unit tests. Pass-through
  // — accept any boolean-valued keys; the actual SDK normalizer is closed-set
  // and tested in xynes-auth-sdk. The behaviour we're testing here is the
  // JSON parsing + env-var-shape contract, not the closed-set filtering.
  normalizeFeatureFlags: (input: unknown) => {
    if (!input || typeof input !== "object") return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  },
}));

import { getCmsFeatureFlagOverrides } from "./overrides";

describe("getCmsFeatureFlagOverrides", () => {
  it("returns an empty object when the env var is unset", () => {
    expect(getCmsFeatureFlagOverrides({})).toEqual({});
  });

  it("returns an empty object when the env var is an empty string", () => {
    expect(
      getCmsFeatureFlagOverrides({
        NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE: "",
      }),
    ).toEqual({});
  });

  it("parses a valid JSON object and forwards only known feature-flag keys", () => {
    const overrides = getCmsFeatureFlagOverrides({
      NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE: JSON.stringify({
        cms_editor_storage_uploads: true,
      }),
    });
    expect(overrides).toEqual({ cms_editor_storage_uploads: true });
  });

  it("forwards every boolean-valued key (real normalizer filters closed-set in production)", () => {
    // The actual normalizer (in @xynes/auth-sdk) closes the set to keys
    // listed in DEFAULT_FEATURE_FLAGS. Here we use a pass-through stub so
    // we can verify the JSON-parsing contract independently. Closed-set
    // filtering is tested in xynes-auth-sdk's own suite.
    const overrides = getCmsFeatureFlagOverrides({
      NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE: JSON.stringify({
        cms_editor_storage_uploads: true,
        not_a_real_flag: true,
      }),
    });
    expect(overrides).toMatchObject({ cms_editor_storage_uploads: true });
  });

  it("drops non-boolean values", () => {
    const overrides = getCmsFeatureFlagOverrides({
      NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE: JSON.stringify({
        cms_editor_storage_uploads: "yes",
      }),
    });
    expect(overrides).toEqual({});
  });

  it("returns an empty object and warns when the JSON is malformed", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const overrides = getCmsFeatureFlagOverrides({
      NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE: "{not-json",
    });
    expect(overrides).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      "[FeatureFlags] Invalid NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("returns an empty object when the env var holds a JSON primitive (not an object)", () => {
    expect(
      getCmsFeatureFlagOverrides({
        NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE: JSON.stringify(true),
      }),
    ).toEqual({});
  });
});
