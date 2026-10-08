"use client";

import { useFeatureFlag, useFeatureFlags } from "@xynes/auth-sdk";

/** Hide integration controls until the gateway's flag evaluation succeeds. */
export function useContentIntegrationsEnabled(): boolean {
  const enabled = useFeatureFlag("cms_content_integrations");
  const { isLoading, error } = useFeatureFlags();
  return enabled && !isLoading && !error;
}
