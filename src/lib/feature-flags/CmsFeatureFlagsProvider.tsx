"use client";

/**
 * STORAGE-LIVE-5 — CMS Console binding for the auth-sdk's `FeatureFlagsProvider`.
 *
 * BUG-CMS-5 (2026-05-30) — threads the active workspace id into the gateway
 * `/flags` call so PostHog can resolve workspace-scoped flag rollouts
 * (e.g. flipping `cms_editor_storage_uploads` ON for a single workspace in
 * the PostHog admin UI). The SDK forwards the id as `X-XS-Workspace-Id`,
 * which the gateway extracts in `flags.route.ts` and lifts into a PostHog
 * `workspace` group + groupProperties.
 *
 * Why this file exists
 * ───────────────────
 * `@xynes/auth-sdk` ships `FeatureFlagsProvider` + `useFeatureFlag(flag)`. The
 * provider needs `apiBaseUrl`, an optional `getAccessToken` callable, and now
 * an optional `workspaceId` to send authenticated, workspace-scoped
 * `GET ${apiBaseUrl}/flags` requests. `useAuth()` and `useWorkspace()` only
 * work inside their respective providers, so we thread both values via this
 * small bridge component that lives inside `<AuthProvider>` AND inside
 * `<WorkspaceProvider>` (see `src/app/providers.tsx`).
 *
 * Architecture
 * ────────────
 *   Browser → @xynes/auth-sdk useFeatureFlag(flag)
 *           → React context (FeatureFlagsContext)
 *           → FeatureFlagsProvider fetch(`${apiBaseUrl}/flags`, {
 *                 Authorization, X-XS-Workspace-Id })
 *           → xynes-gateway FeatureFlagService (INFRA-BE-1, posthog-node-backed)
 *           → PostHog Cloud (workspace group + person targeting)
 *
 * No `phc_*` key in the browser. No `posthog-js` dependency. Adblocker-
 * resilient because the call rides the first-party gateway domain.
 *
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-14-storage-live-provider-rollout.md` §8.
 */
import type { ReactNode } from "react";
import {
  FeatureFlagsProvider,
  useAuth,
  useWorkspace,
} from "@xynes/auth-sdk";

import { getCmsFeatureFlagOverrides } from "./overrides";

interface CmsFeatureFlagsProviderProps {
  readonly apiBaseUrl: string;
  readonly children: ReactNode;
}

/**
 * Bridge component that wires the SDK's `FeatureFlagsProvider` to the
 * CMS Console's auth + workspace contexts. MUST be rendered INSIDE the SDK's
 * `<AuthProvider>` (for `useAuth().getAccessToken`) AND INSIDE the SDK's
 * `<WorkspaceProvider>` (for `useWorkspace().currentWorkspace`).
 *
 * When the user has not yet selected a workspace (e.g. mid-onboarding), the
 * provider sends the `/flags` request without a workspace context and falls
 * back to user-scoped evaluation — same posture as anonymous calls.
 */
export function CmsFeatureFlagsProvider({
  apiBaseUrl,
  children,
}: CmsFeatureFlagsProviderProps) {
  const { getAccessToken } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const flagOverrides = getCmsFeatureFlagOverrides();

  return (
    <FeatureFlagsProvider
      apiBaseUrl={apiBaseUrl}
      fetchOnMount
      getAccessToken={getAccessToken}
      workspaceId={currentWorkspace?.id ?? null}
      flagOverrides={flagOverrides}
    >
      {children}
    </FeatureFlagsProvider>
  );
}
