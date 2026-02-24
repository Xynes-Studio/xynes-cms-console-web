import type { DashboardShellProps } from "@lumia-ui/layout";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsDashboardShell } from "./CmsDashboardShell";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();
const mockDashboardShell = vi.fn();
const mockRedirectToLogin = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard/acme/plugins",
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => mockUseAuth(),
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("@lumia-ui/layout", () => ({
  DashboardShell: (props: DashboardShellProps) => {
    mockDashboardShell(props);
    return <div data-testid="lumia-dashboard-shell">{props.children}</div>;
  },
}));

describe("CmsDashboardShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockPush.mockReset();
    mockDashboardShell.mockReset();
    mockRedirectToLogin.mockReset();

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      redirectToLogin: mockRedirectToLogin,
      user: {
        displayName: "Archie",
        email: "archie@xynes.com",
        avatarUrl: null,
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Xynes",
          slug: "xynes",
        },
      ],
    });

    mockUseWorkspace.mockReturnValue({
      currentWorkspace: {
        id: "ws-1",
        name: "Xynes",
        slug: "xynes",
      },
      selectWorkspace: vi.fn(),
    });
  });

  it("provides the required nav items and identity data to Lumia DashboardShell", () => {
    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    expect(mockDashboardShell).toHaveBeenCalledWith(
      expect.objectContaining({
        activePath: "/dashboard/acme/plugins",
        navItems: expect.arrayContaining([
          expect.objectContaining({ label: "Contents", href: "/dashboard/acme" }),
          expect.objectContaining({ label: "Plugins", href: "/dashboard/acme/plugins" }),
          expect.objectContaining({
            label: "Access Control",
            href: "/dashboard/acme/access-control",
          }),
          expect.objectContaining({ label: "Integrations" }),
          expect.objectContaining({ label: "Settings" }),
        ]),
        workspace: expect.objectContaining({ id: "ws-1", name: "Xynes" }),
        userMenu: expect.objectContaining({
          name: "Archie",
          email: "archie@xynes.com",
        }),
        enableWorkspaceCreation: true,
      }),
    );
  });

  it("routes navigation and logout actions through next router", () => {
    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls[0][0] as DashboardShellProps;

    props.onNavigate("/dashboard/acme/settings");
    expect(mockPush).toHaveBeenCalledWith("/dashboard/acme/settings");

    props.onLogout();
    expect(mockPush).toHaveBeenCalledWith(
      "/logout?redirect=%2Fdashboard%2Facme%2Fplugins",
    );

    props.onCreateWorkspace?.();
    expect(mockPush).toHaveBeenCalledWith("/onboarding");
  });

  it("redirects unauthenticated users to login and avoids rendering dashboard shell", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      redirectToLogin: mockRedirectToLogin,
      user: null,
      workspaces: [],
    });

    const { getByRole } = render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    expect(mockDashboardShell).not.toHaveBeenCalled();
    expect(mockRedirectToLogin).toHaveBeenCalledTimes(1);
    expect(getByRole("status")).toHaveTextContent("Redirecting to login...");
  });

  it("shows loading state while auth is still resolving", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      redirectToLogin: mockRedirectToLogin,
      user: null,
      workspaces: [],
    });

    const { getByRole } = render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    expect(mockDashboardShell).not.toHaveBeenCalled();
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
    expect(getByRole("status")).toHaveTextContent("Loading dashboard...");
  });
});
