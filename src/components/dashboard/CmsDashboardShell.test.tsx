import type { DashboardShellProps } from "@lumia-ui/layout";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsDashboardShell } from "./CmsDashboardShell";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();
const mockDashboardShell = vi.fn();
const mockRedirectToLogin = vi.fn();

const pathnameState = vi.hoisted(() => ({
  value: "/dashboard/acme/plugins",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => pathnameState.value,
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
    pathnameState.value = "/dashboard/acme/plugins";
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
        {
          id: "ws-2",
          name: "Beta",
          slug: "beta-workspace",
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
          expect.objectContaining({
            label: "Contents",
            href: "/dashboard/acme/content",
          }),
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
        directorySection: expect.objectContaining({
          navItemId: "contents",
          rootHref: "/dashboard/acme/content",
          nodes: [],
          expandedIds: [],
          maxNameLength: 80,
        }),
      }),
    );
  });

  it("manages directory tree state through DashboardShell directory callbacks", () => {
    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    let props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual([]);
    expect(props.directorySection?.expandedIds).toEqual([]);

    act(() => {
      props.directorySection?.onCreateDirectory({
        parentId: null,
        name: "Blogs",
      });
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toHaveLength(1);
    const blogsId = props.directorySection?.nodes[0]?.id;
    expect(blogsId).toBeTruthy();

    act(() => {
      props.directorySection?.onCreateDirectory({
        parentId: null,
        name: "blogs",
      });
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toHaveLength(1);

    act(() => {
      props.directorySection?.onExpandedIdsChange([blogsId as string]);
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.expandedIds).toEqual([blogsId]);

    act(() => {
      props.directorySection?.onCreateDirectory({
        parentId: blogsId as string,
        name: "Blogs",
      });
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes[0]?.children).toEqual([
      expect.objectContaining({
        label: "Blogs",
      }),
    ]);
  });

  it("routes navigation, workspace selection, and logout actions through next router", () => {
    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls[0][0] as DashboardShellProps;

    props.onNavigate("/dashboard/acme/settings");
    expect(mockPush).toHaveBeenCalledWith("/dashboard/acme/settings");

    props.onWorkspaceSelect("ws-2");
    expect(mockPush).toHaveBeenCalledWith("/dashboard/beta-workspace/plugins");

    props.onLogout();
    expect(mockPush).toHaveBeenCalledWith(
      "/logout?redirect=%2Fdashboard%2Facme%2Fplugins",
    );

    props.onCreateWorkspace?.();
    expect(mockPush).toHaveBeenCalledWith("/onboarding");
  });

  it("preserves nested content path when switching workspace", () => {
    pathnameState.value = "/dashboard/acme/content/tests/guides";

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    props.onWorkspaceSelect("ws-2");

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/beta-workspace/content/tests/guides",
    );
  });

  it("materializes nested directories from direct content URL and marks active href", async () => {
    pathnameState.value = "/dashboard/acme/content/tests/guides";

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    const rootNode = props.directorySection?.nodes[0];
    const childNode = rootNode?.children?.[0];

    expect((props.directorySection as { activeHref?: string } | undefined)?.activeHref).toBe(
      "/dashboard/acme/content/tests/guides",
    );
    expect(rootNode).toEqual(
      expect.objectContaining({
        label: "tests",
        href: "/dashboard/acme/content/tests",
      }),
    );
    expect(childNode).toEqual(
      expect.objectContaining({
        label: "guides",
        href: "/dashboard/acme/content/tests/guides",
      }),
    );
    expect(props.directorySection?.expandedIds.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back workspace switching to canonical content route when active path is non-dashboard", () => {
    pathnameState.value = "/settings";

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls[0][0] as DashboardShellProps;

    props.onWorkspaceSelect("ws-2");

    expect(mockPush).toHaveBeenCalledWith("/dashboard/beta-workspace/content");
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
