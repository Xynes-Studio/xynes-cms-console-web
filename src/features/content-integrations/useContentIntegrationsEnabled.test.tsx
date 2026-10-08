import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { FeatureFlagsProvider, useFeatureFlags } from "@xynes/auth-sdk";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useContentIntegrationsEnabled } from "./useContentIntegrationsEnabled";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FeatureFlagsProvider
      apiBaseUrl="https://gateway.example"
      workspaceId="workspace-a"
      getAccessToken={async () => "fixture-token"}
    >
      {children}
    </FeatureFlagsProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("content integration remote rollout", () => {
  it.each([
    {},
    { cms_content_integrations: false },
    { cms_content_integrations: "true" },
  ])(
    "defaults off for missing, disabled or non-boolean flags: %j",
    async (flags) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ flags, authenticated: true })),
      );
      const { result } = renderHook(
        () => ({
          enabled: useContentIntegrationsEnabled(),
          state: useFeatureFlags(),
        }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.state.isLoading).toBe(false));
      expect(result.current.enabled).toBe(false);
    },
  );
  it("enables after authenticated workspace evaluation and hides cached true on fetch failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          flags: { cms_content_integrations: true },
          authenticated: true,
        }),
      )
      .mockRejectedValueOnce(new Error("Flags unavailable"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(
      () => ({
        enabled: useContentIntegrationsEnabled(),
        state: useFeatureFlags(),
      }),
      { wrapper },
    );
    expect(result.current.enabled).toBe(false);
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "https://gateway.example/flags",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fixture-token",
          "X-XS-Workspace-Id": "workspace-a",
        }),
      }),
    );
    await act(() => result.current.state.refetch());
    expect(result.current.state.error).toBeInstanceOf(Error);
    expect(result.current.enabled).toBe(false);
  });
});
