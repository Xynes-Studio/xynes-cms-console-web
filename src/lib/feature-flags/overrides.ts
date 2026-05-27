/**
 * STORAGE-LIVE-5 — Local-dev / CI feature-flag overrides for the CMS Console.
 *
 * Mirrors the auth-app pattern at `xynes-auth-app/src/lib/feature-flags/overrides.ts`:
 * accepts `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` as a JSON-shaped env var
 * (e.g. `'{"cms_editor_storage_uploads": true}'`) so developers and CI can
 * force a flag state without touching PostHog.
 *
 * PostHog (via the gateway `/flags` route) wins over these overrides only
 * when the SDK polls and re-fetches. The provider applies `flagOverrides`
 * AFTER the fetched flags, so for local dev the override IS the source of
 * truth for the lifetime of the page. Same posture as auth-app.
 *
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-14-storage-live-provider-rollout.md` §8.
 */
import type { FeatureFlags } from "@xynes/auth-sdk";
import { normalizeFeatureFlags } from "@xynes/auth-sdk";

type EnvSource = Record<string, string | undefined>;

const getObjectFromJson = (
  value: string | undefined,
): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn(
      "[FeatureFlags] Invalid NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE",
      error,
    );
  }
  return null;
};

/**
 * Parse the JSON-shaped override env var. Returns an empty object when
 * unset, empty, or malformed — never throws into the React render path.
 */
export function getCmsFeatureFlagOverrides(
  env: EnvSource = process.env,
): Partial<FeatureFlags> {
  const jsonOverrides = getObjectFromJson(
    env.NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE,
  );
  return normalizeFeatureFlags(jsonOverrides ?? {});
}
