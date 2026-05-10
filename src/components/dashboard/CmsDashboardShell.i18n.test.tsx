/**
 * I18n + pseudo-locale tests for CmsDashboardShell (UXR-6).
 *
 * Mirrors the auth-app's AuthDashboardShell.i18n.test.tsx contract: drives the
 * real `next-intl` provider with the en-US and en-XA cms.shell catalogs to
 * verify (a) every shell label flows through the Lumia DashboardShell label
 * bundle, (b) the en-XA pseudo-locale renders bracketed/doubled characters
 * without breaking the shell shape, (c) ICU placeholders ({unreadCount},
 * {title}) interpolate correctly, and (d) raw catalog key paths never leak
 * into a forwarded label.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import type {
  DashboardShellLabels,
  DashboardShellProps,
} from "@lumia-ui/layout";

import { NextIntlClientProvider } from "next-intl";
import { CmsDashboardShell } from "./CmsDashboardShell";

import enUsShell from "../../../messages/en-US/cms.shell.json";
import enXaShell from "../../../messages/en-XA/cms.shell.json";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();
const mockDashboardShell = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard/acme/content",
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
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));

function withIntl(locale: "en-US" | "en-XA", children: ReactNode) {
  const messages =
    locale === "en-US"
      ? { cms: { shell: enUsShell } }
      : { cms: { shell: enXaShell } };
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe("CmsDashboardShell i18n (UXR-6)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    process.env.NEXT_PUBLIC_API_URL = "";
    mockPush.mockReset();
    mockDashboardShell.mockReset();
    mockGetAccessToken.mockReset();
    mockGetAccessToken.mockResolvedValue("test-access-token");

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      redirectToLogin: vi.fn(),
      getAccessToken: mockGetAccessToken,
      user: {
        displayName: "Archie",
        email: "archie@xynes.com",
        avatarUrl: null,
      },
      workspaces: [
        { id: "ws-1", name: "Xynes", slug: "acme", role: "workspace_owner" },
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
  });

  afterEach(() => cleanup());

  it("renders en-US navigation labels and shell labels from the cms.shell catalog", () => {
    render(
      withIntl(
        "en-US",
        <CmsDashboardShell workspaceSlug="acme">
          <div>Body</div>
        </CmsDashboardShell>,
      ),
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;

    // Cross-app navigation vocabulary — must match
    // xynes/xynes-infra/docs/research/ux-review/02-cross-app-navigation-vocabulary.md.
    const navLabels = props.navItems.map((item) => item.label);
    expect(navLabels).toEqual([
      "Contents",
      "Plugins",
      "Access Control",
      "Integrations",
      "Settings",
    ]);

    const labels = props.labels as DashboardShellLabels;
    expect(labels.navigation?.mainContent).toBe("Dashboard main content");
    expect(labels.navigation?.openMobileMenu).toBe("Open menu");
    expect(labels.workspace?.currentSection).toBe("Current Workspace");
    expect(labels.workspace?.createAction).toBe("Create new workspace");
    expect(labels.profile?.logoutAction).toBe("Logout");
    expect(labels.notifications?.empty).toBe("No notifications");

    // ICU placeholder interpolation
    expect(labels.notifications?.title?.(2)).toBe("Notifications (2)");
    expect(labels.notifications?.unreadCount?.(2)).toBe(
      "2 unread notifications",
    );
    expect(
      labels.notifications?.delete?.({
        id: "n-1",
        title: "Welcome",
        createdAt: "2026-05-10T00:00:00.000Z",
      }),
    ).toBe("Delete notification Welcome");

    expect(props.sidebarFooterNote).toBe(
      "Need access? Contact your workspace owner.",
    );
    expect(props.workspaceCreationDisabledMessage).toBe(
      "Workspace creation is unavailable. Check settings or contact admin.",
    );
  });

  it("renders en-XA pseudo-locale navigation + shell labels (long-string stress test)", () => {
    render(
      withIntl(
        "en-XA",
        <CmsDashboardShell workspaceSlug="acme">
          <div>Body</div>
        </CmsDashboardShell>,
      ),
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;

    // Pseudo-locale wraps + doubles characters: "Contents" -> "[CCoonntteennttss]".
    const navLabels = props.navItems.map((item) => item.label);
    expect(navLabels[0]).toMatch(/^\[CCoonntteennttss\]$/);
    expect(navLabels[2]).toMatch(/\[AAcccceessss CCoonnttrrooll\]/);
    expect(navLabels[3]).toMatch(/\[IInntteeggrraattiioonnss\]/);

    const labels = props.labels as DashboardShellLabels;
    expect(labels.profile?.logoutAction).toMatch(/\[LLooggoouutt\]/);
    expect(labels.workspace?.createAction).toMatch(
      /\[CCrreeaattee nneeww wwoorrkkssppaaccee\]/,
    );

    // ICU placeholder is preserved at render time even in pseudo-locale.
    expect(labels.notifications?.title?.(7)).toMatch(/7/);
    expect(labels.notifications?.unreadCount?.(7)).toMatch(/7/);
    expect(
      labels.notifications?.delete?.({
        id: "n-1",
        title: "Welcome",
        createdAt: "2026-05-10T00:00:00.000Z",
      }),
    ).toMatch(/Welcome/);

    expect(props.sidebarFooterNote).toMatch(/\[NNeeeedd aacccceessss\?/);
    expect(props.workspaceCreationDisabledMessage).toMatch(
      /\[WWoorrkkssppaaccee ccrreeaattiioonn iiss uunnaavvaaiillaabbllee\./,
    );

    // Sentinel: no raw catalog key path leaks (e.g. "cms.shell.shell.profile").
    expect(labels.profile?.trigger).not.toMatch(/cms\.shell\./);
  });

  it("never leaks raw catalog key paths through any forwarded label (en-US)", () => {
    render(
      withIntl(
        "en-US",
        <CmsDashboardShell workspaceSlug="acme">
          <div>Body</div>
        </CmsDashboardShell>,
      ),
    );

    const props = mockDashboardShell.mock.calls.at(
      -1,
    )?.[0] as DashboardShellProps;
    const stringValues: string[] = [
      ...props.navItems.map((item) => item.label),
      props.workspaceCreationDisabledMessage ?? "",
      props.sidebarFooterNote ?? "",
      props.userMenu.name,
      props.userMenu.email,
    ];
    for (const value of stringValues) {
      expect(value).not.toMatch(/cms\.shell\./);
    }
  });
});
