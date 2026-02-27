import type { DashboardShellProps } from "@lumia-ui/layout";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsDashboardShell } from "./CmsDashboardShell";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();
const mockDashboardShell = vi.fn();
const mockRedirectToLogin = vi.fn();
const mockGetAccessToken = vi.fn();
const mockToastShow = vi.fn();

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
    pathnameState.value = "/dashboard/acme/plugins";
    mockPush.mockReset();
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
          const body = init.body ? JSON.parse(String(init.body)) : { name: "Docs" };
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

        if (url.includes("/content-directories/") && init?.method === "DELETE") {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
              status: 200,
            }),
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
                data: [{ id: "dir-1", parentId: null, name: "Docs", pathSegment: "docs" }],
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
          return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    let props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
          return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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
        if (url.endsWith("/content-directories/dir-1") && init?.method === "PATCH") {
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
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    let props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
      expect.arrayContaining([expect.objectContaining({ id: "dir-1", label: "Articles" })]),
    );
  });

  it("persists directory deletion via gateway content-directories API", async () => {
    let isDeleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const url = String(input);
        if (url.endsWith("/content-types")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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
        if (url.endsWith("/content-directories/dir-1") && init?.method === "DELETE") {
          isDeleted = true;
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: { deleted: true } }), { status: 200 }),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    let props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
          return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
          );
        }
        if (url.endsWith("/content-directories") && init?.method === "POST") {
          return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 500 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
      }),
    );

    render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
          return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [{ id: "dir-1", parentId: null, name: "Docs", pathSegment: "docs" }],
              }),
              { status: 200 },
            ),
          );
        }
        if (url.endsWith("/content-directories/dir-1") && init?.method === "PATCH") {
          return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 500 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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
          return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
        }
        if (url.endsWith("/content-directories") && init?.method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                data: [{ id: "dir-1", parentId: null, name: "Docs", pathSegment: "docs" }],
              }),
              { status: 200 },
            ),
          );
        }
        if (url.endsWith("/content-directories/dir-1") && init?.method === "DELETE") {
          return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 500 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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

    let props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;
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

    const props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;

    expect((props.directorySection as { activeHref?: string } | undefined)?.activeHref).toBe(
      "/dashboard/acme/content/tests/guides",
    );
    expect(props.directorySection?.nodes).toEqual([]);
    expect(props.directorySection?.expandedIds).toEqual([]);
  });

  it("preserves manual expansions on navigation when route path has no persisted nodes", async () => {
    const { rerender } = render(
      <CmsDashboardShell workspaceSlug="acme">
        <div>CMS content</div>
      </CmsDashboardShell>,
    );

    let props = mockDashboardShell.mock.calls.at(-1)?.[0] as DashboardShellProps;

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
});
