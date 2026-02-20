import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

const { getCmsAuthConfigMock } = vi.hoisted(() => ({
  getCmsAuthConfigMock: vi.fn(() => ({ authAppUrl: "http://localhost:3100" })),
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

describe("Providers", () => {
  it("composes AuthProvider and WorkspaceProvider at app root", () => {
    render(
      <Providers>
        <span data-testid="child">cms</span>
      </Providers>
    );

    expect(screen.getByTestId("auth-provider")).toBeInTheDocument();
    expect(screen.getByTestId("auth-provider")).toHaveAttribute(
      "data-auth-app-url",
      "http://localhost:3100"
    );
    expect(screen.getByTestId("workspace-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getCmsAuthConfigMock).toHaveBeenCalledTimes(1);
  });
});
