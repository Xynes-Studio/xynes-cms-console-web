"use client";

/**
 * STORAGE-LIVE-5 — CMS Console binding for the auth-sdk's `FeatureFlagsProvider`.
 *
 * Why this file exists
 * ───────────────────
 * `@xynes/auth-sdk` ships `FeatureFlagsProvider` + `useFeatureFlag(flag)`. The
 * provider needs `apiBaseUrl` + an optional `getAccessToken` callable to send
 * authenticated `GET ${apiBaseUrl}/flags` requests so per-workspace overrides
 * resolve correctly. `useAuth()` only works inside `<AuthProvider>`, so we
 * thread it via a small bridge component that lives inside `<AuthProvider>`
 * (and inside `<WorkspaceProvider>`, so the SDK's polling — if enabled —
 * refetches on workspace switch).
 *
 * Architecture
 * ────────────
 *   Browser → @xynes/auth-sdk useFeatureFlag(flag)
 *           → React context (FeatureFlagsContext)
 *           → FeatureFlagsProvider fetch(`${apiBaseUrl}/flags`, { Authorization })
 *           → xynes-gateway FeatureFlagService (INFRA-BE-1, posthog-node-backed)
 *           → PostHog Cloud
 *
 * No `phc_*` key in the browser. No `posthog-js` dependency. Adblocker-
 * resilient because the call rides the first-party gateway domain.
 *
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-14-storage-live-provider-rollout.md` §8.
 */
import type { ReactNode } from "react";
import { FeatureFlagsProvider, useAuth } from "@xynes/auth-sdk";

import { getCmsFeatureFlagOverrides } from "./overrides";

interface CmsFeatureFlagsProviderProps {
  readonly apiBaseUrl: string;
  readonly children: ReactNode;
}

/**
 * Bridge component that wires the SDK's `FeatureFlagsProvider` to the
 * CMS Console's auth context. MUST be rendered INSIDE the SDK's
 * `<AuthProvider>` so `useAuth().getAccessToken` is available.
 */
export function CmsFeatureFlagsProvider({
  apiBaseUrl,
  children,
}: CmsFeatureFlagsProviderProps) {
  const { getAccessToken } = useAuth();
  const flagOverrides = getCmsFeatureFlagOverrides();

  return (
    <FeatureFlagsProvider
      apiBaseUrl={apiBaseUrl}
      fetchOnMount
      getAccessToken={getAccessToken}
      flagOverrides={flagOverrides}
    >
      {children}
    </FeatureFlagsProvider>
  );
}
