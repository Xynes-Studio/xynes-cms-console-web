import type { DashboardShellProps } from "@lumia-ui/layout";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsDashboardShell } from "./CmsDashboardShell";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockDashboardShell = vi.fn();
const mockRedirectToLogin = vi.fn();
const mockGetAccessToken = vi.fn();
const mockToastShow = vi.fn();

const pathnameState = vi.hoisted(() => ({
  value: "/dashboard/acme/plugins",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => pathnameState.value,
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => mockUseAuth(),
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        "cms.shell.nav.contents": "Contents",
        "cms.shell.nav.plugins": "Plugins",
        "cms.shell.nav.accessControl": "Access Control",
        "cms.shell.nav.integrations": "Integrations",
        "cms.shell.nav.settings": "Settings",
        "cms.shell.directory.ownerOnly":
          "Only workspace owners can manage directories right now.",
        "cms.shell.directory.mutationErrorDescription":
          "Please try again. If the issue persists, contact your workspace owner.",
        "cms.shell.directory.createFailedTitle": "Could not create directory",
        "cms.shell.directory.renameFailedTitle": "Could not rename directory",
        "cms.shell.directory.deleteFailedTitle": "Could not delete directory",
        "cms.shell.status.loadingDashboard": "Loading dashboard...",
        "cms.shell.status.redirectingToLogin": "Redirecting to login...",
        "cms.shell.status.noWorkspaceTitle": "Setting up your workspace…",
        "cms.shell.status.noWorkspaceDescription":
          "Redirecting you to create your first workspace.",
        "cms.shell.status.wrongWorkspaceTitle": "Switching workspace…",
        "cms.shell.status.wrongWorkspaceDescription":
          "We could not find that workspace. Taking you to one you can access.",
        "cms.shell.shell.workspaceCreationDisabledMessage":
          "Workspace creation is unavailable. Check settings or contact admin.",
        "cms.shell.shell.footerNote":
          "Need access? Contact your workspace owner.",
        "cms.shell.shell.navigation.mainContent": "Dashboard main content",
        "cms.shell.shell.navigation.sidebar": "Dashboard sidebar",
        "cms.shell.shell.navigation.sidebarScrollArea":
          "Sidebar navigation scroll area",
        "cms.shell.shell.navigation.dashboardNavigation":
          "Dashboard navigation",
        "cms.shell.shell.navigation.mobileDashboardNavigation":
          "Mobile dashboard navigation",
        "cms.shell.shell.navigation.mobileMenu": "Menu",
        "cms.shell.shell.navigation.openMobileMenu": "Open menu",
        "cms.shell.shell.workspace.trigger": "Switch workspace",
        "cms.shell.shell.workspace.fallbackName": "Workspace",
        "cms.shell.shell.workspace.currentSection": "Current Workspace",
        "cms.shell.shell.workspace.currentBadge": "Current",
        "cms.shell.shell.workspace.switchToSection": "Switch to",
        "cms.shell.shell.workspace.createAction": "Create new workspace",
        "cms.shell.shell.workspace.createUnavailableAction":
          "Workspace creation unavailable",
        "cms.shell.shell.profile.trigger": "Open profile menu",
        "cms.shell.shell.profile.profileAction": "Profile",
        "cms.shell.shell.profile.logoutAction": "Logout",
        "cms.shell.shell.notifications.open": "Open notifications",
        "cms.shell.shell.notifications.tab": "Notifications",
        "cms.shell.shell.notifications.empty": "No notifications",
        "cms.shell.shell.notifications.list": "Notification list",
        "cms.shell.shell.notifications.todayGroup": "Today",
        "cms.shell.shell.notifications.yesterdayGroup": "Yesterday",
        "cms.shell.shell.userMenu.fallbackName": "User",
        "cms.shell.shell.userMenu.fallbackEmail": "No email",
      };

      const fullKey = `${namespace}.${key}`;
      if (key === "titlePattern") {
        return `Notifications (${(values?.unreadCount as number | undefined) ?? 0})`;
      }
      if (key === "unreadCountPattern") {
        return `${(values?.unreadCount as number | undefined) ?? 0} unread notifications`;
      }
      if (key === "deletePattern") {
        return `Delete notification ${(values?.title as string | undefined) ?? ""}`;
      }
      return messages[fullKey] ?? fullKey;
    },
}));

vi.mock("@lumia-ui/layout", () => ({
  DashboardShell: (props: DashboardShellProps) => {
    mockDashboardShell(props);
    return <div data-testid="lumia-dashboard-shell">{props.children}</div>;
  },
}));

vi.mock("@lumia-ui/components", () => ({
  useToast: () => ({
    show: mockToastShow,
    dismiss: vi.fn(),
  }),
}));

describe("CmsDashboardShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    pathnameState.value = "/dashboard/acme/plugins";
    mockPush.mockReset();
    mockReplace.mockReset();
    mockDashboardShell.mockReset();
    mockRedirectToLogin.mockReset();
    mockGetAccessToken.mockReset();
    mockToastShow.mockReset();
    mockGetAccessToken.mockResolvedValue("test-access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-directories") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: {
                  id: "dir-test",
                  parentId: null,
                  name: "Docs",
                  pathSegment: "docs",
                },
              }),
              { status: 201 },
            ),
          );
        }

        if (url.includes("/content-directories/") && init?.method === "PATCH") {
          const body = init.body
            ? JSON.parse(String(init.body))
            : { name: "Docs" };
          const normalizedName =
            typeof body?.name === "string" && body.name.trim().length > 0
              ? body.name.trim()
              : "Docs";
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: {
                  id: "dir-test",
                  parentId: null,
                  name: normalizedName,
                  pathSegment: normalizedName.toLowerCase(),
                },
              }),
              { status: 200 },
            ),
          );
        }

        if (
          url.includes("/content-directories/") &&
          init?.method === "DELETE"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ ok: true, data: { deleted: true } }),
              {
                status: 200,
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), {
            status: 200,
          }),
        );
      }),
    );

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      redirectToLogin: mockRedirectToLogin,
      getAccessToken: mockGetAccessToken,
      user: {
        displayName: "Archie",
        email: "archie@xynes.com",
        avatarUrl: null,
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Xynes",
          slug: "acme",
          role: "workspace_owner",
        },
        {
          id: "ws-2",
          name: "Beta",
          slug: "beta-workspace",
          role: "workspace_member",
        },
      ],
    });

    mockUseWorkspace.mockReturnValue({
      currentWorkspace: {
        id: "ws-1",
        name: "Xynes",
        slug: "acme",
        role: "workspace_owner",
      },
      selectWorkspace: vi.fn(),
    });

    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4100";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
          expect.objectContaining({
            label: "Plugins",
            href: "/dashboard/acme/plugins",
          }),
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
          canManageDirectories: true,
          maxNameLength: 80,
        }),
      }),
    );
  });

  it("disables directory CRUD actions for non-owner roles", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      redirectToLogin: mockRedirectToLogin,
      getAccessToken: mockGetAccessToken,
      user: {
        displayName: "Member User",
        email: "member@xynes.com",
        avatarUrl: null,
      },
      workspaces: [
        {
          id: "ws-1",
          name: "Xynes",
          slug: "acme",
          role: "workspace_member",
        },
      ],
    });
    mockUseWorkspace.mockReturnValue({
      currentWorkspace: {
        id: "ws-1",
        name: "Xynes",
        slug: "acme",
        role: "workspace_member",
      },
      selectWorkspace: vi.fn(),
    });

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    expect(props.directorySection?.canManageDirectories).toBe(false);
    expect(props.directorySection?.directoryActionDisabledReason).toContain(
      "Only workspace owners",
    );
  });

  it("manages directory tree state through DashboardShell directory callbacks", () => {
    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    let props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
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

    act(() => {
      props.directorySection?.onRenameDirectory?.({
        nodeId: blogsId as string,
        name: "Articles",
      });
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes[0]?.label).toBe("Articles");

    act(() => {
      props.directorySection?.onDeleteDirectory?.({
        nodeId: blogsId as string,
      });
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual([]);
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

    const assignSpy = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => undefined);

    props.onCreateWorkspace?.();
    // WSA-FIX-2 (2026-05-12): CMS Console appends `?redirect=<encoded CMS
    // dashboard URL>` so the auth app's post-create flow returns the user
    // to CMS Console. `NEXT_PUBLIC_APP_URL` is injected as
    // `http://localhost:3000` by `infra/scripts/with-env.mjs` in the test
    // environment. The dedicated WSA-FIX-2 describe block below covers the
    // unset / malformed branches.
    expect(assignSpy).toHaveBeenCalledWith(
      "http://localhost:3100/onboarding?redirect=" +
        encodeURIComponent("http://localhost:3000/dashboard"),
    );
    expect(mockPush).not.toHaveBeenCalledWith("/onboarding");

    assignSpy.mockRestore();
  });

  it("preserves nested content path when switching workspace", () => {
    pathnameState.value = "/dashboard/acme/content/tests/guides";

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    props.onWorkspaceSelect("ws-2");

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/beta-workspace/content/tests/guides",
    );
  });

  it("loads content directory tree from gateway content-directories API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input) => {
        const url = String(input);
        if (url.endsWith("/content-directories")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [
                  {
                    id: "dir-1",
                    parentId: null,
                    name: "Docs",
                    pathSegment: "docs",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/ws-1/content-directories",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Docs",
          href: "/dashboard/acme/content/docs",
        }),
      ]),
    );
  });

  it("loads persisted custom content directories from gateway API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [
                  {
                    id: "dir-1",
                    parentId: null,
                    name: "Docs",
                    pathSegment: "docs",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/ws-1/content-directories",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dir-1",
          label: "Docs",
          href: "/dashboard/acme/content/docs",
        }),
      ]),
    );
  });

  it("persists directory creation via gateway content-directories API", async () => {
    let hasCreated = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: hasCreated
                  ? [
                      {
                        id: "dir-1",
                        parentId: null,
                        name: "Docs",
                        pathSegment: "docs",
                      },
                    ]
                  : [],
              }),
              { status: 200 },
            ),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "POST") {
          hasCreated = true;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: {
                  id: "dir-1",
                  parentId: null,
                  name: "Docs",
                  pathSegment: "docs",
                },
              }),
              { status: 201 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    let props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onCreateDirectory({
        parentId: null,
        name: "Docs",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/ws-1/content-directories",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          parentId: null,
          name: "Docs",
        }),
      }),
    );

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Docs",
        }),
      ]),
    );
  });

  it("persists directory rename via gateway content-directories API", async () => {
    let directoryName = "Docs";
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [
                  {
                    id: "dir-1",
                    parentId: null,
                    name: directoryName,
                    pathSegment: directoryName.toLowerCase(),
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (
          url.endsWith("/content-directories/dir-1") &&
          init?.method === "PATCH"
        ) {
          directoryName = "Articles";
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: {
                  id: "dir-1",
                  parentId: null,
                  name: "Articles",
                  pathSegment: "articles",
                },
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    let props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onRenameDirectory?.({
        nodeId: "dir-1",
        name: "Articles",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/ws-1/content-directories/dir-1",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name: "Articles" }),
      }),
    );

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dir-1", label: "Articles" }),
      ]),
    );
  });

  it("persists directory deletion via gateway content-directories API", async () => {
    let isDeleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: isDeleted
                  ? []
                  : [
                      {
                        id: "dir-1",
                        parentId: null,
                        name: "Docs",
                        pathSegment: "docs",
                      },
                    ],
              }),
              { status: 200 },
            ),
          );
        }
        if (
          url.endsWith("/content-directories/dir-1") &&
          init?.method === "DELETE"
        ) {
          isDeleted = true;
          return Promise.resolve(
            new Response(
              JSON.stringify({ ok: true, data: { deleted: true } }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    let props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onDeleteDirectory?.({
        nodeId: "dir-1",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4100/workspaces/ws-1/content-directories/dir-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual([]);
  });

  it("skips rename API request when local rename is a no-op", async () => {
    const fetchMock = vi.fn((input, init) => {
      const url = String(input);
      if (url.endsWith("/content-types")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      if (url.endsWith("/content-directories") && init?.method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "dir-1",
                  parentId: null,
                  name: "Docs",
                  pathSegment: "docs",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchMock.mockClear();

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onRenameDirectory?.({
        nodeId: "dir-1",
        name: "Docs",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips delete API request when local delete target is not found", async () => {
    const fetchMock = vi.fn((input, init) => {
      const url = String(input);
      if (url.endsWith("/content-types")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }
      if (url.endsWith("/content-directories") && init?.method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "dir-1",
                  parentId: null,
                  name: "Docs",
                  pathSegment: "docs",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fetchMock.mockClear();

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onDeleteDirectory?.({
        nodeId: "missing-dir",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows error toast when directory creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: false }), { status: 500 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onCreateDirectory({
        parentId: null,
        name: "Docs",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        title: "Could not create directory",
      }),
    );
  });

  it("shows error toast when directory rename fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [
                  {
                    id: "dir-1",
                    parentId: null,
                    name: "Docs",
                    pathSegment: "docs",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (
          url.endsWith("/content-directories/dir-1") &&
          init?.method === "PATCH"
        ) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: false }), { status: 500 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onRenameDirectory?.({
        nodeId: "dir-1",
        name: "Articles",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        title: "Could not rename directory",
      }),
    );
  });

  it("shows error toast when directory deletion fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), {
              status: 200,
            }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [
                  {
                    id: "dir-1",
                    parentId: null,
                    name: "Docs",
                    pathSegment: "docs",
                  },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        if (
          url.endsWith("/content-directories/dir-1") &&
          init?.method === "DELETE"
        ) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: false }), { status: 500 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
        );
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    act(() => {
      props.directorySection?.onDeleteDirectory?.({
        nodeId: "dir-1",
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        title: "Could not delete directory",
      }),
    );
  });

  it("resets API-backed root nodes when workspace changes to avoid cross-workspace leakage", async () => {
    pathnameState.value = "/dashboard/acme/content";

    const workspaceState = {
      currentWorkspace: {
        id: "ws-1",
        name: "Workspace One",
        slug: "acme",
      },
      selectWorkspace: vi.fn(),
    };
    mockUseWorkspace.mockImplementation(() => workspaceState);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      redirectToLogin: mockRedirectToLogin,
      getAccessToken: mockGetAccessToken,
      user: {
        displayName: "Archie",
        email: "archie@xynes.com",
        avatarUrl: null,
      },
      workspaces: [
        { id: "ws-1", name: "Workspace One", slug: "acme" },
        { id: "ws-2", name: "Workspace Two", slug: "beta" },
      ],
    });

    const fetchMock = vi.fn((input) => {
      const url = String(input);
      if (url.includes("/workspaces/ws-1/content-directories")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "dir-1",
                  parentId: null,
                  name: "Docs",
                  pathSegment: "docs",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      if (url.includes("/workspaces/ws-2/content-directories")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: [
                {
                  id: "dir-2",
                  parentId: null,
                  name: "Events",
                  pathSegment: "events",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    let props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Docs" })]),
    );

    workspaceState.currentWorkspace = {
      id: "ws-2",
      name: "Workspace Two",
      slug: "beta",
    };
    pathnameState.value = "/dashboard/beta/content";
    rerender(
      <CmsDashboardShell workspaceSlug="beta">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.nodes).toEqual([
      expect.objectContaining({
        label: "Events",
        href: "/dashboard/beta/content/events",
      }),
    ]);
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

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;

    expect(
      (props.directorySection as { activeHref?: string } | undefined)
        ?.activeHref,
    ).toBe("/dashboard/acme/content/tests/guides");
    expect(props.directorySection?.nodes).toEqual([]);
    expect(props.directorySection?.expandedIds).toEqual([]);
  });

  it("preserves manual expansions on navigation when route path has no persisted nodes", async () => {
    const { rerender } = render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    let props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;

    act(() => {
      props.directorySection?.onCreateDirectory({
        parentId: null,
        name: "Blogs",
      });
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    const blogsId = props.directorySection?.nodes[0]?.id;
    expect(blogsId).toBeTruthy();

    act(() => {
      props.directorySection?.onExpandedIdsChange([blogsId as string]);
    });

    pathnameState.value = "/dashboard/acme/content/tests/guides";
    rerender(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
    expect(props.directorySection?.expandedIds).toEqual([blogsId as string]);
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
      getAccessToken: mockGetAccessToken,
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
      getAccessToken: mockGetAccessToken,
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

  it("forwards a fully populated DashboardShell label bundle and translated workspace + footer copy (UXR-6)", () => {
    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;

    // sidebarFooterNote and workspaceCreationDisabledMessage now come from
    // the cms.shell catalog instead of being hard-coded English strings.
    expect(props.sidebarFooterNote).toBe(
      "Need access? Contact your workspace owner.",
    );
    expect(props.workspaceCreationDisabledMessage).toBe(
      "Workspace creation is unavailable. Check settings or contact admin.",
    );

    // userMenu fallbacks come from the catalog (User / No email).
    expect(props.userMenu.name).toBe("Archie");
    expect(props.userMenu.email).toBe("archie@xynes.com");

    // The Lumia DashboardShell label bundle is fully populated.
    const labels = props.labels;
    expect(labels?.navigation?.mainContent).toBe("Dashboard main content");
    expect(labels?.navigation?.sidebar).toBe("Dashboard sidebar");
    expect(labels?.navigation?.openMobileMenu).toBe("Open menu");
    expect(labels?.workspace?.trigger).toBe("Switch workspace");
    expect(labels?.workspace?.currentSection).toBe("Current Workspace");
    expect(labels?.workspace?.createAction).toBe("Create new workspace");
    expect(labels?.profile?.trigger).toBe("Open profile menu");
    expect(labels?.profile?.logoutAction).toBe("Logout");
    expect(labels?.notifications?.empty).toBe("No notifications");

    // ICU placeholders flow through the t-functions correctly.
    expect(labels?.notifications?.title?.(3)).toBe("Notifications (3)");
    expect(labels?.notifications?.unreadCount?.(3)).toBe(
      "3 unread notifications",
    );
    expect(
      labels?.notifications?.delete?.({
        id: "n-1",
        title: "Welcome",
        createdAt: "2026-05-10T00:00:00.000Z",
      }),
    ).toBe("Delete notification Welcome");
  });

  it("falls back to translated user menu copy when user has no display name or email (UXR-6)", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      redirectToLogin: mockRedirectToLogin,
      getAccessToken: mockGetAccessToken,
      user: { displayName: null, email: null, avatarUrl: null },
      workspaces: [
        {
          id: "ws-1",
          name: "Xynes",
          slug: "acme",
          role: "workspace_owner",
        },
      ],
    });

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    expect(props.userMenu.name).toBe("User");
    expect(props.userMenu.email).toBe("No email");
  });

  describe("WSA-FIX-2: create-workspace link forwards origin via ?redirect=", () => {
    /**
     * Plan: xynes/xynes-infra/docs/plans/2026-05-10-auth-app-workspace-admin-and-onboarding-fixes.md §4
     *
     * Contract: when CMS Console links to the auth app's /onboarding flow,
     * it must include `?redirect=<encoded CMS landing URL>` so the
     * post-create redirect honours the origin app. The redirect target is
     * `${NEXT_PUBLIC_APP_URL}/dashboard`, which the CMS dashboard resolver
     * page redirects to the user's current/first workspace once it exists.
     *
     * `infra/scripts/with-env.mjs` injects
     * `NEXT_PUBLIC_APP_URL=http://localhost:3000` by default for CMS console
     * tests, but each test below sets the env explicitly so the assertion
     * remains stable if the harness defaults ever shift.
     */

    let previousAppUrl: string | undefined;

    beforeEach(() => {
      previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    });

    afterEach(() => {
      if (previousAppUrl === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
      }
    });

    function captureCreateWorkspaceTarget(): string | undefined {
      const assignSpy = vi
        .spyOn(window.location, "assign")
        .mockImplementation(() => undefined);
      try {
        render(
          <CmsDashboardShell workspaceSlug="acme">
            <div>CMS content</div>
          </CmsDashboardShell>,
        );

        const props = mockDashboardShell.mock
          .calls[0][0] as DashboardShellProps;
        props.onCreateWorkspace?.();

        const absoluteCall = assignSpy.mock.calls.find(
          ([target]) =>
            typeof target === "string" && /^https?:\/\//i.test(target),
        );
        if (absoluteCall) {
          return absoluteCall[0] as string;
        }

        const routerCall = mockPush.mock.calls
          .map((call) => call[0])
          .find(
            (target): target is string =>
              typeof target === "string" && target.startsWith("/onboarding"),
          );
        return routerCall;
      } finally {
        assignSpy.mockRestore();
      }
    }

    it("appends ?redirect=<encoded CMS dashboard URL> when NEXT_PUBLIC_APP_URL is set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      const target = captureCreateWorkspaceTarget();

      expect(target).toBe(
        "http://localhost:3100/onboarding?redirect=" +
          encodeURIComponent("http://localhost:3000/dashboard"),
      );
    });

    it("strips a trailing slash on NEXT_PUBLIC_APP_URL before building the redirect target", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://cms.xynes.com/";

      const target = captureCreateWorkspaceTarget();

      expect(target).toBe(
        "http://localhost:3100/onboarding?redirect=" +
          encodeURIComponent("https://cms.xynes.com/dashboard"),
      );
    });

    it("omits ?redirect= entirely when NEXT_PUBLIC_APP_URL is not a valid http(s) URL", () => {
      // Malformed → fail closed: send the bare /onboarding URL and let the
      // auth app's Auth-Admin fallback take over instead of forwarding an
      // unsafe target.
      process.env.NEXT_PUBLIC_APP_URL = "not a url";

      const target = captureCreateWorkspaceTarget();

      expect(target).toBe("http://localhost:3100/onboarding");
    });

    it("omits ?redirect= when NEXT_PUBLIC_APP_URL uses a non-http(s) scheme", () => {
      // Defense-in-depth: javascript:/data: URLs would never pass the auth
      // app's allowlist either, but we strip them at the source.
      process.env.NEXT_PUBLIC_APP_URL = "javascript:alert(1)";

      const target = captureCreateWorkspaceTarget();

      expect(target).toBe("http://localhost:3100/onboarding");
    });

    it("URI-encodes the redirect target so reserved characters in the host/path are safe", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://cms.xynes.com:8443";

      const target = captureCreateWorkspaceTarget();

      // `:` must be percent-encoded inside the query value so query parsers
      // don't mistake the port for a separator.
      expect(target).toContain(
        "?redirect=" +
          encodeURIComponent("https://cms.xynes.com:8443/dashboard"),
      );
      expect(target).toContain("%3A8443");
    });

    it("falls back to the bare relative /onboarding URL when NEXT_PUBLIC_AUTH_APP_URL is unset (regression guard)", () => {
      const previousAuthAppUrl = process.env.NEXT_PUBLIC_AUTH_APP_URL;
      delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

      try {
        const target = captureCreateWorkspaceTarget();
        expect(target).toBe(
          "/onboarding?redirect=" +
            encodeURIComponent("http://localhost:3000/dashboard"),
        );
      } finally {
        if (previousAuthAppUrl !== undefined) {
          process.env.NEXT_PUBLIC_AUTH_APP_URL = previousAuthAppUrl;
        }
      }
    });
  });

  describe("workspace guard (BUG-AUTH-9)", () => {
    it("redirects to the first auth-validated workspace's dashboard path when the URL slug does not match any accessible workspace", () => {
      // Default beforeEach gives workspaces `acme` (ws-1) and
      // `beta-workspace` (ws-2). Pass an unknown slug — this is the
      // cross-tenant probe path.
      //
      // BUG-AUTH-9 follow-up (PR #43, Codex P1): the guard now redirects
      // DIRECTLY to the first auth-validated workspace (`ws-1` → `acme`)
      // instead of round-tripping through `/dashboard`. This avoids the
      // resolver round-trip that previously could re-pick a stale
      // `currentWorkspace` and loop the guard.
      const selectWorkspaceSpy = vi.fn();
      mockUseWorkspace.mockReturnValue({
        currentWorkspace: {
          id: "ws-1",
          name: "Xynes",
          slug: "acme",
          role: "workspace_owner",
        },
        selectWorkspace: selectWorkspaceSpy,
      });

      const { getByTestId, queryByTestId } = render(
        <CmsDashboardShell workspaceSlug="not-my-workspace">
          <div data-testid="dashboard-body">Should NOT render</div>
        </CmsDashboardShell>,
      );

      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/acme/content");

      // SDK selection synced to the auth-validated target so any later
      // navigation through the resolver does not bounce back to a stale
      // selection.
      expect(selectWorkspaceSpy).toHaveBeenCalledWith("ws-1");

      // Fallback main rendered with the wrong-slug copy + reason tag.
      const fallback = getByTestId("cms-dashboard-workspace-guard-fallback");
      expect(fallback.getAttribute("data-guard-reason")).toBe("wrong-slug");
      expect(fallback.textContent).toContain("Switching workspace");

      // Dashboard body NOT rendered (no flash of broken shell).
      expect(queryByTestId("dashboard-body")).toBeNull();
      // Lumia shell NOT rendered.
      expect(mockDashboardShell).not.toHaveBeenCalled();
    });

    it("breaks the stale-currentWorkspace redirect loop (BUG-AUTH-9 PR #43 Codex P1 regression guard)", () => {
      // Scenario: the user's access to workspace `acme` (ws-1) has been
      // revoked, but the auth SDK still has it selected as
      // `currentWorkspace`. The auth-validated `workspaces` list (which is
      // the source of truth) now contains ONLY `beta-workspace` (ws-2).
      // The user lands on `/dashboard/acme/content`. Pre-fix this would
      // redirect to `/dashboard`, the resolver would re-pick `currentWorkspace.slug`
      // (still `acme`), redirect back to `/dashboard/acme/content`, and
      // the guard would fire again forever.
      //
      // Post-fix: the guard ignores the stale selection, picks the first
      // accessible workspace (`beta-workspace`), syncs the SDK selection
      // to `ws-2`, and redirects DIRECTLY to `/dashboard/beta-workspace/content`.
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        redirectToLogin: mockRedirectToLogin,
        getAccessToken: mockGetAccessToken,
        user: {
          displayName: "Archie",
          email: "archie@xynes.com",
          avatarUrl: null,
        },
        workspaces: [
          {
            id: "ws-2",
            name: "Beta",
            slug: "beta-workspace",
            role: "workspace_member",
          },
        ],
      });
      const selectWorkspaceSpy = vi.fn();
      mockUseWorkspace.mockReturnValue({
        // Stale selection that no longer exists in the auth-validated list.
        currentWorkspace: {
          id: "ws-1",
          name: "Xynes",
          slug: "acme",
          role: "workspace_owner",
        },
        selectWorkspace: selectWorkspaceSpy,
      });

      render(
        <CmsDashboardShell workspaceSlug="acme">
          <div data-testid="dashboard-body">Should NOT render</div>
        </CmsDashboardShell>,
      );

      // Direct redirect to the only accessible workspace — no /dashboard
      // round-trip that would re-pick the stale slug.
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/beta-workspace/content",
      );
      // SDK selection is synced to the accessible workspace so any later
      // resolver navigation stays out of the loop.
      expect(selectWorkspaceSpy).toHaveBeenCalledWith("ws-2");
      // Lumia shell NOT mounted against the stale slug.
      expect(mockDashboardShell).not.toHaveBeenCalled();
    });

    it("does NOT redirect when the slug matches a workspace the user can access", () => {
      // Default beforeEach matches slug=acme → workspace ws-1. Existing
      // behaviour: shell renders normally and replace is NOT called.
      render(
        <CmsDashboardShell workspaceSlug="acme">
          <div data-testid="dashboard-body">Renders normally</div>
        </CmsDashboardShell>,
      );

      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockDashboardShell).toHaveBeenCalled();
    });

    it("does NOT redirect while auth bootstrap is still in flight", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        redirectToLogin: mockRedirectToLogin,
        getAccessToken: mockGetAccessToken,
        user: null,
        // empty list here would normally trigger the no-workspace guard;
        // but isLoading=true tells us the workspaces array is not final
        // yet — the guard must wait for isLoading to flip to false.
        workspaces: [],
      });
      mockUseWorkspace.mockReturnValue({
        currentWorkspace: null,
        selectWorkspace: vi.fn(),
      });

      render(
        <CmsDashboardShell workspaceSlug="acme">
          <div data-testid="dashboard-body">May render once loaded</div>
        </CmsDashboardShell>,
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("workspace guard fallback uses role=status for screen-reader announcement", () => {
      const { getByRole } = render(
        <CmsDashboardShell workspaceSlug="not-my-workspace">
          <div>body</div>
        </CmsDashboardShell>,
      );

      const status = getByRole("status");
      expect(status).toBeInTheDocument();
      expect(status.textContent).toContain("Switching workspace");
    });

    it("redirects to the auth-app onboarding URL when the user has zero workspaces", () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        redirectToLogin: mockRedirectToLogin,
        getAccessToken: mockGetAccessToken,
        user: {
          displayName: "Brand New",
          email: "new@example.com",
          avatarUrl: null,
        },
        workspaces: [],
      });
      mockUseWorkspace.mockReturnValue({
        currentWorkspace: null,
        selectWorkspace: vi.fn(),
      });

      const { getByTestId } = render(
        <CmsDashboardShell workspaceSlug="acme">
          <div data-testid="dashboard-body">Should NOT render</div>
        </CmsDashboardShell>,
      );

      // The shell uses buildAuthWorkspaceCreationUrl() which prepends
      // NEXT_PUBLIC_AUTH_APP_URL when set (default test env sets
      // http://localhost:3100). The URL also carries ?redirect= back to the
      // CMS dashboard resolver per WSA-FIX-2.
      expect(mockReplace).toHaveBeenCalledTimes(1);
      const calledWith = String(mockReplace.mock.calls[0]?.[0] ?? "");
      expect(calledWith.startsWith("http://localhost:3100/onboarding")).toBe(
        true,
      );

      // Fallback main rendered with the no-workspace copy + reason tag.
      const fallback = getByTestId("cms-dashboard-workspace-guard-fallback");
      expect(fallback.getAttribute("data-guard-reason")).toBe("no-workspace");
      expect(fallback.textContent).toContain("Setting up your workspace");

      expect(mockDashboardShell).not.toHaveBeenCalled();
    });
  });
});
