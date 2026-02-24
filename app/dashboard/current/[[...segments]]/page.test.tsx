import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardCurrentAliasPage from "./page";

const replaceMock = vi.fn();
const selectWorkspaceMock = vi.fn();
const redirectToLoginMock = vi.hoisted(() => vi.fn());

const paramsState = vi.hoisted(() => ({
  segments: [] as string[],
}));

const workspaceState = vi.hoisted(() => ({
  isLoading: true,
  currentWorkspace: null as null | { id: string; slug?: string | null },
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
  useParams: () => paramsState,
}));

vi.mock("@xynes/auth-sdk", () => ({
  useWorkspace: () => ({
    ...workspaceState,
    selectWorkspace: selectWorkspaceMock,
  }),
  useAuth: () => authState,
}));

describe("Dashboard Current Alias Page", () => {
  beforeEach(() => {
    paramsState.segments = [];
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

    render(<DashboardCurrentAliasPage />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading dashboard..."));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects using current workspace slug while preserving dashboard section", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = { id: "ws-1", slug: "acme-team" };
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [
      { id: "ws-1", slug: "acme-team" },
      { id: "ws-2", slug: "beta-team" },
    ];
    paramsState.segments = ["access-control"];

    render(<DashboardCurrentAliasPage />);

    expect(replaceMock).toHaveBeenCalledWith("/dashboard/acme-team/access-control");
    expect(selectWorkspaceMock).not.toHaveBeenCalled();
  });

  it("normalizes content tail segments and defaults unknown section to content", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = { id: "ws-1", slug: "acme-team" };
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [{ id: "ws-1", slug: "acme-team" }];

    paramsState.segments = ["content", " Blogs ", "Drafts 2026"];
    render(<DashboardCurrentAliasPage />);
    expect(replaceMock).toHaveBeenCalledWith(
      "/dashboard/acme-team/content/blogs/drafts-2026",
    );

    cleanup();
    replaceMock.mockReset();

    paramsState.segments = ["unknown", "ignored"];
    render(<DashboardCurrentAliasPage />);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard/acme-team/content");
  });

  it("falls back to first valid workspace when current workspace is missing", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = null;
    authState.isLoading = false;
    authState.isAuthenticated = true;
    authState.workspaces = [
      { id: "ws-1", slug: "bad slug" },
      { id: "ws-2", slug: "acme-fallback" },
    ];
    paramsState.segments = ["integrations"];

    render(<DashboardCurrentAliasPage />);

    expect(selectWorkspaceMock).toHaveBeenCalledWith("ws-2");
    expect(replaceMock).toHaveBeenCalledWith("/dashboard/acme-fallback/integrations");
  });

  it("redirects unauthenticated users to auth-app login", () => {
    workspaceState.isLoading = false;
    workspaceState.currentWorkspace = null;
    authState.isLoading = false;
    authState.isAuthenticated = false;
    authState.workspaces = [];
    paramsState.segments = [];

    render(<DashboardCurrentAliasPage />);

    expect(redirectToLoginMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Redirecting to login...")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
