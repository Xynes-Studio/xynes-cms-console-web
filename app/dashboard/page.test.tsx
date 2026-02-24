import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardResolverPage from "./page";

const replaceMock = vi.fn();
const selectWorkspaceMock = vi.fn();
const redirectToLoginMock = vi.hoisted(() => vi.fn());

const workspaceState = vi.hoisted(() => ({
  isLoading: true,
  currentWorkspace: null as null | { slug?: string | null },
}));
const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  isLoading: true,
  redirectToLogin: redirectToLoginMock,
  workspaces: [] as Array<{ id: string; slug?: string | null }>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@xynes/auth-sdk", () => ({
  useWorkspace: () => ({
    ...workspaceState,
    selectWorkspace: selectWorkspaceMock,
  }),
  useAuth: () => authState,
}));

describe("Dashboard Resolver Page", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    selectWorkspaceMock.mockReset();
    redirectToLoginMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders accessible loading status while workspace state is resolving", () => {
    workspaceState.isLoading = true;
    workspaceState.currentWorkspace = null;
    authState.isLoading = true;
    authState.isAuthenticated = true;
    authState.workspaces = [];

    render(<DashboardResolverPage />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading dashboard..."));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to namespaced workspace dashboard when workspace slug exists", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = { slug: "acme-team" };
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [];

    render(<DashboardResolverPage />);

    expect(replaceMock).toHaveBeenCalledWith("/dashboard/acme-team");
    expect(selectWorkspaceMock).not.toHaveBeenCalled();
  });

  it("falls back to first valid workspace when no current workspace is selected", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = null;
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [
      { id: "ws-1", slug: "bad slug" },
      { id: "ws-2", slug: "acme-fallback" },
    ];

    render(<DashboardResolverPage />);

    expect(selectWorkspaceMock).toHaveBeenCalledWith("ws-2");
    expect(replaceMock).toHaveBeenCalledWith("/dashboard/acme-fallback");
  });

  it("renders an accessible 404-style error when no workspace is available", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = null;
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [];

    render(<DashboardResolverPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders 404-style error for unsafe workspace slug", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = { slug: "../evil" };
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [];

    render(<DashboardResolverPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to auth-app login", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = null;
    authState.isLoading = false;
    authState.isAuthenticated = false;
    authState.workspaces = [];

    render(<DashboardResolverPage />);

    expect(redirectToLoginMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Redirecting to login...")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
