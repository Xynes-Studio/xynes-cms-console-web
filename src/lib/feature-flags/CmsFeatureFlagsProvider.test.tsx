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
  mockUseWorkspace,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockFeatureFlagsProvider: vi.fn(),
  mockUseWorkspace: vi.fn(),
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: mockUseAuth,
  useWorkspace: mockUseWorkspace,
  FeatureFlagsProvider: ({
    children,
    apiBaseUrl,
    fetchOnMount,
    getAccessToken,
    workspaceId,
    flagOverrides,
  }: {
    children: ReactNode;
    apiBaseUrl: string;
    fetchOnMount: boolean;
    getAccessToken?: () => Promise<string | null>;
    workspaceId?: string | null;
    flagOverrides?: Record<string, boolean>;
  }) => {
    mockFeatureFlagsProvider({
      apiBaseUrl,
      fetchOnMount,
      getAccessToken,
      workspaceId,
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
  // Default to no workspace selected; individual tests override.
  mockUseWorkspace.mockReturnValue({
    currentWorkspace: null,
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

  // BUG-CMS-5: thread the active workspace id into the SDK provider so the
  // gateway can resolve workspace-scoped flag rollouts (e.g.
  // cms_editor_storage_uploads turned ON for a single workspace from the
  // PostHog admin UI).
  describe("workspace context (BUG-CMS-5)", () => {
    it("threads currentWorkspace.id into the SDK provider as workspaceId", () => {
      mockUseWorkspace.mockReturnValue({
        currentWorkspace: { id: "ws-abc123", name: "Acme", slug: "acme" },
      });

      render(
        <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
          <span>child</span>
        </CmsFeatureFlagsProvider>,
      );

      expect(mockFeatureFlagsProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-abc123",
        }),
      );
    });

    it("passes workspaceId=null when no workspace is selected (mid-onboarding)", () => {
      mockUseWorkspace.mockReturnValue({
        currentWorkspace: null,
      });

      render(
        <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
          <span>child</span>
        </CmsFeatureFlagsProvider>,
      );

      expect(mockFeatureFlagsProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: null,
        }),
      );
    });

    it("re-renders pass through the new workspaceId when the active workspace changes", () => {
      mockUseWorkspace.mockReturnValue({
        currentWorkspace: { id: "ws-aaa", name: "A", slug: "a" },
      });

      const { rerender } = render(
        <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
          <span>child</span>
        </CmsFeatureFlagsProvider>,
      );

      expect(mockFeatureFlagsProvider).toHaveBeenLastCalledWith(
        expect.objectContaining({ workspaceId: "ws-aaa" }),
      );

      mockUseWorkspace.mockReturnValue({
        currentWorkspace: { id: "ws-bbb", name: "B", slug: "b" },
      });

      rerender(
        <CmsFeatureFlagsProvider apiBaseUrl="http://localhost:4100">
          <span>child</span>
        </CmsFeatureFlagsProvider>,
      );

      expect(mockFeatureFlagsProvider).toHaveBeenLastCalledWith(
        expect.objectContaining({ workspaceId: "ws-bbb" }),
      );
    });
  });
});
