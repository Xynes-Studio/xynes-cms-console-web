import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

const { getCmsAuthConfigMock } = vi.hoisted(() => ({
  getCmsAuthConfigMock: vi.fn(() => ({
    authAppUrl: "http://localhost:3100",
    apiBaseUrl: "http://localhost:4100",
  })),
}));

vi.mock("../lib/auth/config", () => ({
  getCmsAuthConfig: getCmsAuthConfigMock,
}));

vi.mock("@xynes/auth-sdk", () => ({
  AuthProvider: ({
    children,
    config,
  }: {
    children: ReactNode;
    config: { authAppUrl: string };
  }) => (
    <div data-testid="auth-provider" data-auth-app-url={config.authAppUrl}>
      {children}
    </div>
  ),
  WorkspaceProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="workspace-provider">{children}</div>
  ),
}));

// STORAGE-LIVE-5: stub the CmsFeatureFlagsProvider bridge so the
// composition test stays focused on shape. The real bridge calls into the
// auth-sdk's FeatureFlagsProvider; that has its own dedicated test suite
// in `xynes-auth-sdk/src/providers/FeatureFlagsProvider.test.tsx`.
vi.mock("../lib/feature-flags/CmsFeatureFlagsProvider", () => ({
  CmsFeatureFlagsProvider: ({
    children,
    apiBaseUrl,
  }: {
    children: ReactNode;
    apiBaseUrl: string;
  }) => (
    <div
      data-testid="cms-feature-flags-provider"
      data-api-base-url={apiBaseUrl}
    >
      {children}
    </div>
  ),
}));

vi.mock("@lumia-ui/components", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="toast-provider">{children}</div>
  ),
}));

vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({
    children,
    locale,
    messages,
    timeZone,
  }: {
    children: ReactNode;
    locale: string;
    messages: Record<string, unknown>;
    timeZone: string;
  }) => (
    <div
      data-testid="intl-provider"
      data-locale={locale}
      data-time-zone={timeZone}
      data-has-cms-messages={String(Boolean(messages.cms))}
    >
      {children}
    </div>
  ),
}));

describe("Providers", () => {
  it("composes i18n, AuthProvider, CmsFeatureFlagsProvider, WorkspaceProvider, and ToastProvider at app root", () => {
    render(
      <Providers locale="en-XA" messages={{ cms: { shell: {} } }}>
        <span data-testid="child">cms</span>
      </Providers>,
    );

    expect(screen.getByTestId("intl-provider")).toHaveAttribute(
      "data-locale",
      "en-XA",
    );
    expect(screen.getByTestId("intl-provider")).toHaveAttribute(
      "data-has-cms-messages",
      "true",
    );
    expect(screen.getByTestId("intl-provider")).toHaveAttribute(
      "data-time-zone",
      "UTC",
    );
    expect(screen.getByTestId("auth-provider")).toBeInTheDocument();
    expect(screen.getByTestId("auth-provider")).toHaveAttribute(
      "data-auth-app-url",
      "http://localhost:3100",
    );
    // STORAGE-LIVE-5: the feature-flag bridge is mounted inside the auth
    // provider so it can read `useAuth().getAccessToken` for authenticated
    // /flags fetches.
    expect(
      screen.getByTestId("cms-feature-flags-provider"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("cms-feature-flags-provider")).toHaveAttribute(
      "data-api-base-url",
      "http://localhost:4100",
    );
    expect(screen.getByTestId("workspace-provider")).toBeInTheDocument();
    expect(screen.getByTestId("toast-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getCmsAuthConfigMock).toHaveBeenCalledTimes(1);
  });
});
