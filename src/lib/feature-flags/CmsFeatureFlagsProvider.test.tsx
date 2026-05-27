/**
 * STORAGE-LIVE-5 — Tests for the `CmsFeatureFlagsProvider` bridge.
 *
 * The bridge is a thin wrapper: it reads `useAuth().getAccessToken` from
 * the CMS Console's auth context and forwards it (plus `apiBaseUrl` +
 * `flagOverrides` from the env-var override helper) to the auth-sdk's
 * `FeatureFlagsProvider`. Tests verify the wiring contract — the actual
 * fetch behaviour is covered by the SDK's own `FeatureFlagsProvider`
 * suite.
 */
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseAuth,
  mockGetAccessToken,
  mockFeatureFlagsProvider,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockFeatureFlagsProvider: vi.fn(),
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: mockUseAuth,
  FeatureFlagsProvider: ({
    children,
    apiBaseUrl,
    fetchOnMount,
    getAccessToken,
    flagOverrides,
  }: {
    children: ReactNode;
    apiBaseUrl: string;
    fetchOnMount: boolean;
    getAccessToken?: () => Promise<string | null>;
    flagOverrides?: Record<string, boolean>;
  }) => {
    mockFeatureFlagsProvider({
      apiBaseUrl,
      fetchOnMount,
      getAccessToken,
      flagOverrides,
    });
    return <div data-testid="sdk-feature-flags-provider">{children}</div>;
  },
  // STORAGE-LIVE-5: stub for `overrides.ts` which calls
  // normalizeFeatureFlags from the SDK. Pass-through (filter no keys) so
  // tests assert against the raw env-var override object.
  normalizeFeatureFlags: (input: unknown) => {
    if (!input || typeof input !== "object") return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  },
}));

import { CmsFeatureFlagsProvider } from "./CmsFeatureFlagsProvider";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE;
  mockUseAuth.mockReturnValue({
    getAccessToken: mockGetAccessToken,
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("CmsFeatureFlagsProvider", () => {
  it("renders children", () => {
    const { getByTestId } = render(
      <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
        <span data-testid="child">cms</span>
      </CmsFeatureFlagsProvider>,
    );
    expect(getByTestId("child")).toBeInTheDocument();
    expect(getByTestId("sdk-feature-flags-provider")).toBeInTheDocument();
  });

  it("forwards apiBaseUrl and fetchOnMount=true to the SDK provider", () => {
    render(
      <CmsFeatureFlagsProvider apiBaseUrl="http://gateway.example/api">
        <span>child</span>
      </CmsFeatureFlagsProvider>,
    );
    expect(mockFeatureFlagsProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: "http://gateway.example/api",
        fetchOnMount: true,
      }),
    );
  });

  it("threads getAccessToken from useAuth() into the SDK provider", () => {
    render(
      <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
        <span>child</span>
      </CmsFeatureFlagsProvider>,
    );
    const args = mockFeatureFlagsProvider.mock.calls[0]?.[0] as
      | { getAccessToken?: () => Promise<string | null> }
      | undefined;
    expect(args?.getAccessToken).toBe(mockGetAccessToken);
  });

  it("forwards env-var overrides through to the SDK provider's flagOverrides", () => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE = JSON.stringify({
      cms_editor_storage_uploads: true,
    });

    render(
      <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
        <span>child</span>
      </CmsFeatureFlagsProvider>,
    );

    expect(mockFeatureFlagsProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        flagOverrides: { cms_editor_storage_uploads: true },
      }),
    );
  });

  it("forwards an empty overrides object when env var is unset", () => {
    render(
      <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
        <span>child</span>
      </CmsFeatureFlagsProvider>,
    );

    expect(mockFeatureFlagsProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        flagOverrides: {},
      }),
    );
  });
});
