import type React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();

const i18nState = vi.hoisted(() => {
  const defaultMessages = {
    heading: "Integrations",
    summary:
      "Verified domains, API keys, and future automation are managed from Workspace Admin so the rest of the platform can reuse them. This page summarizes what is configured for your workspace and links you to the right Workspace Admin tab to make changes.",
    slugLabel: "Workspace Admin · CMS context",
    statusUnavailableTitle: "Integration status unavailable",
    statusUnavailableDescription:
      "Integration status is temporarily unavailable. Counts shown below may be out of date -- refresh the page or open Workspace Admin to confirm.",
    futureAutomationTitle: "Webhooks & deployment hooks",
    futureAutomationDescription:
      "Workspace webhooks for content events and deployment hooks for downstream rebuilds are part of the Workspace Admin roadmap. They will appear here once Workspace Admin ships them -- CMS does not own the webhook lifecycle.",
    futureAutomationBadge: "Coming soon",
    "sections.domains.eyebrow": "Workspace setup",
    "sections.domains.title": "Verified domains",
    "sections.domains.description":
      "Verify domains in Workspace Admin once, then reuse them across CMS publishing, delivery, and any future workspace product.",
    "sections.domains.linkLabel": "Manage verified domains",
    "sections.domains.verifiedMetric": "Verified",
    "sections.domains.pendingMetric": "Pending",
    "sections.apiKeys.eyebrow": "Workspace setup",
    "sections.apiKeys.title": "Workspace API keys",
    "sections.apiKeys.description":
      "API keys are issued and scoped from Workspace Admin. Raw key values are shown once at creation and stored only as hashes -- they cannot be revealed again.",
    "sections.apiKeys.linkLabel": "Manage workspace API keys",
    "sections.apiKeys.activeMetric": "Active",
    "sections.apiKeys.cmsScopedMetric": "CMS-scoped",
    "sections.contentApi.eyebrow": "CMS delivery",
    "sections.contentApi.title": "Content API",
    "sections.contentApi.description":
      "Issue a read-only API key for headless content delivery. The key only grants access to published content and cannot mutate entries.",
    "sections.contentApi.linkLabel": "Create a read-only Content API key",
    "sections.publisher.eyebrow": "Publisher automation",
    "sections.publisher.title": "Publisher automation",
    "sections.publisher.description":
      "Issue a publisher API key for build pipelines or scheduled publishing tools that need to author and publish entries on your behalf.",
    "sections.publisher.linkLabel": "Create a publisher automation key",
  };

  return {
    defaultMessages,
    messages: { ...defaultMessages },
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    i18nState.messages[key as keyof typeof i18nState.defaultMessages] ?? key,
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => mockUseAuth(),
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("@lumia-ui/components", () => ({
  Alert: ({
    title,
    description,
    variant,
  }: {
    title?: string;
    description?: string;
    variant?: string;
  }) => {
    // Mirror the real Lumia Alert role mapping so tests assert the
    // actual a11y contract (warning/error -> 'alert', else 'status').
    const role =
      variant === "warning" || variant === "error" ? "alert" : "status";
    return (
      <div role={role} data-variant={variant}>
        {title ? <strong>{title}</strong> : null}
        {description ? <p>{description}</p> : null}
      </div>
    );
  },
  Badge: ({
    children,
    variant,
  }: {
    children?: React.ReactNode;
    variant?: string;
  }) => <span data-variant={variant}>{children}</span>,
  Card: ({
    children,
    className,
    ...rest
  }: {
    children?: React.ReactNode;
    className?: string;
  } & React.HTMLAttributes<HTMLDivElement>) => (
    <section className={className} {...rest}>
      {children}
    </section>
  ),
  // Re-export a no-op buttonStyles so `import { buttonStyles }` works at
  // runtime without exercising the Lumia compiled package in jsdom/happy-dom.
  buttonStyles: {
    base: "lumia-btn",
    variants: {
      primary: "v-primary",
      secondary: "v-secondary",
      outline: "v-outline",
      ghost: "v-ghost",
      destructive: "v-destructive",
      link: "v-link",
    },
    sizes: { sm: "s-sm", md: "s-md", lg: "s-lg", icon: "s-icon" },
  },
}));

const fetchStatusMock = vi.fn();
vi.mock("../../lib/dashboard/workspace-integrations-client", () => ({
  fetchCmsWorkspaceIntegrationStatus: (...args: unknown[]) =>
    fetchStatusMock(...args),
}));

import { CmsIntegrationsPanel } from "./CmsIntegrationsPanel";

const ORIGINAL_AUTH_APP_URL = process.env.NEXT_PUBLIC_AUTH_APP_URL;
const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

const restoreEnv = () => {
  if (ORIGINAL_AUTH_APP_URL === undefined) {
    delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = ORIGINAL_AUTH_APP_URL;
  }
  if (ORIGINAL_API_URL === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
  }
};

const setReadyAuth = () => {
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    getAccessToken: vi.fn().mockResolvedValue("test-token"),
  });
  mockUseWorkspace.mockReturnValue({
    currentWorkspace: { id: "workspace-1", name: "Acme Demo" },
  });
};

describe("CmsIntegrationsPanel", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4100";
    fetchStatusMock.mockReset();
    fetchStatusMock.mockResolvedValue({
      verifiedDomainCount: 2,
      pendingDomainCount: 1,
      activeApiKeyCount: 3,
      cmsScopedApiKeyCount: 2,
      unavailable: false,
    });
    mockUseAuth.mockReset();
    mockUseWorkspace.mockReset();
    setReadyAuth();
  });

  afterEach(() => {
    vi.clearAllMocks();
    i18nState.messages = { ...i18nState.defaultMessages };
    restoreEnv();
    cleanup();
  });

  it("communicates the integrations context in the page heading", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/integrations/i);
  });

  it("renders translated panel copy from the active locale catalog", () => {
    i18nState.messages = {
      ...i18nState.defaultMessages,
      heading: "[CCMMSS iinntteeggrraattiioonnss]",
      summary: "[WWoorrkkssppaaccee AAddmmiinn ssuummmmaarryy]",
      slugLabel: "[AAccttiivvee wwoorrkkssppaaccee]",
      futureAutomationTitle: "[WWoorrkkssppaaccee wweebbhhooookkss]",
      futureAutomationBadge: "[PPllaannnneedd]",
      "sections.domains.linkLabel":
        "[MMaannaaggee vveerriiffiieedd ddoommaaiinnss]",
    };

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "[CCMMSS iinntteeggrraattiioonnss]",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("[WWoorrkkssppaaccee AAddmmiinn ssuummmmaarryy]"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cms-integrations-workspace-slug").parentElement,
    ).toHaveTextContent("[AAccttiivvee wwoorrkkssppaaccee]");
    expect(
      screen.getByRole("link", {
        name: /\[MMaannaaggee vveerriiffiieedd ddoommaaiinnss\]/,
      }),
    ).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=domains&workspace=acme-demo",
    );
    expect(
      screen.getByRole("heading", {
        name: "[WWoorrkkssppaaccee wweebbhhooookkss]",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("[PPllaannnneedd]")).toBeInTheDocument();
  });

  it("does not render the under-development placeholder", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    expect(
      screen.queryByText(/integrations are under development/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("coming-soon-panel")).not.toBeInTheDocument();
  });

  it("renders a domains card that links to the Workspace Admin domains tab", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", { name: /manage verified domains/i });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=domains&workspace=acme-demo",
    );
  });

  it("renders an API keys card that links to the Workspace Admin api keys tab", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", {
      name: /manage workspace api keys/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=api-keys&workspace=acme-demo",
    );
  });

  it("renders a Content API card that links to the CMS read-only key preset", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", {
      name: /create a read-only content api key/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=api-keys&preset=cms_readonly&workspace=acme-demo",
    );
  });

  it("renders a Publisher Automation card that links to the CMS publisher key preset", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", {
      name: /create a publisher automation key/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=api-keys&preset=cms_publisher&workspace=acme-demo",
    );
  });

  it("does not render an add-domain form", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    // No form for adding domains, no hostname input, no verify button
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hostname/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add domain/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /verify domain/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render a create-api-key form", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    expect(
      screen.queryByRole("button", { name: /create api key/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /generate api key/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /revoke api key/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a future automation/webhooks section that is informational only (no lifecycle form)", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    // Section heading exists
    expect(
      screen.getByRole("heading", { name: /webhooks/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create webhook/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/webhook url/i)).not.toBeInTheDocument();
  });

  it("renders integration status counts when status loads successfully", async () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    await waitFor(() => {
      expect(fetchStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiBaseUrl: "http://localhost:4100",
          workspaceId: "workspace-1",
          accessToken: "test-token",
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("cms-integrations-domains-verified-count"),
      ).toHaveTextContent("2");
    });

    expect(
      screen.getByTestId("cms-integrations-domains-pending-count"),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId("cms-integrations-api-keys-active-count"),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId("cms-integrations-api-keys-cms-scoped-count"),
    ).toHaveTextContent("2");
  });

  it("shows an unavailable message with role=alert when the status request fails closed", async () => {
    fetchStatusMock.mockResolvedValue({
      verifiedDomainCount: 0,
      pendingDomainCount: 0,
      activeApiKeyCount: 0,
      cmsScopedApiKeyCount: 0,
      unavailable: true,
    });

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    await waitFor(() => {
      expect(
        screen.getByText(/integration status is temporarily unavailable/i),
      ).toBeInTheDocument();
    });

    // Warning-variant Alert must surface as an assertive a11y region.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not call fetchCmsWorkspaceIntegrationStatus until auth is ready and a workspace is selected", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      getAccessToken: vi.fn(),
    });
    mockUseWorkspace.mockReturnValue({ currentWorkspace: null });

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    expect(fetchStatusMock).not.toHaveBeenCalled();
  });

  it("uses safe relative fallbacks when NEXT_PUBLIC_AUTH_APP_URL is malformed", () => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "javascript:alert(1)";

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", { name: /manage verified domains/i });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/integrations?tab=domains&workspace=acme-demo",
    );
  });

  it("displays the active workspace slug as page context", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    expect(
      screen.getByTestId("cms-integrations-workspace-slug"),
    ).toHaveTextContent("acme-demo");
  });

  it("renders deep links as native anchors, not nested inside button elements", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", { name: /manage verified domains/i });

    // The element MUST be an <a>, not a <button>; nesting a link inside a
    // button is invalid HTML and an a11y violation.
    expect(link.tagName).toBe("A");
    expect(link.closest("button")).toBeNull();
  });

  it("marks external Workspace Admin links with target=_blank and a safe rel", () => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://auth.xynes.example";

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", { name: /manage verified domains/i });

    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel") ?? "").toMatch(/noopener/);
    expect(link.getAttribute("rel") ?? "").toMatch(/noreferrer/);
  });

  it("does NOT mark relative fallback links as external", () => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "javascript:alert(1)";

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", { name: /manage verified domains/i });

    expect(link).not.toHaveAttribute("target");
  });

  it("exposes an 'opens in new tab' hint to screen readers for external links", () => {
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://auth.xynes.example";

    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", { name: /manage verified domains/i });

    // The accessible name must include the opens-in-new-tab announcement so
    // sighted-via-icon (↗) users and AT users get the same affordance.
    expect(link).toHaveAccessibleName(/opens in new tab/i);
  });

  it("clears stale counts when the active workspace changes (no cross-workspace leak)", async () => {
    // Workspace A: a "deferred" promise the test controls so the fetch is
    // observably in-flight while we re-render with a new workspace.
    let resolveA!: (status: {
      verifiedDomainCount: number;
      pendingDomainCount: number;
      activeApiKeyCount: number;
      cmsScopedApiKeyCount: number;
      unavailable: boolean;
    }) => void;
    const pendingA = new Promise<{
      verifiedDomainCount: number;
      pendingDomainCount: number;
      activeApiKeyCount: number;
      cmsScopedApiKeyCount: number;
      unavailable: boolean;
    }>((resolve) => {
      resolveA = resolve;
    });

    // Workspace B: also deferred so we can assert state mid-transition.
    let resolveB!: (status: {
      verifiedDomainCount: number;
      pendingDomainCount: number;
      activeApiKeyCount: number;
      cmsScopedApiKeyCount: number;
      unavailable: boolean;
    }) => void;
    const pendingB = new Promise<{
      verifiedDomainCount: number;
      pendingDomainCount: number;
      activeApiKeyCount: number;
      cmsScopedApiKeyCount: number;
      unavailable: boolean;
    }>((resolve) => {
      resolveB = resolve;
    });

    fetchStatusMock.mockReset();
    fetchStatusMock.mockImplementationOnce(() => pendingA);
    fetchStatusMock.mockImplementationOnce(() => pendingB);

    // Mount with workspace A.
    mockUseWorkspace.mockReturnValue({
      currentWorkspace: { id: "workspace-A", name: "Workspace A" },
    });
    const { rerender } = render(
      <CmsIntegrationsPanel workspaceSlug="workspace-a" />,
    );

    // Workspace A's fetch resolves with very distinctive counts.
    resolveA({
      verifiedDomainCount: 999,
      pendingDomainCount: 999,
      activeApiKeyCount: 999,
      cmsScopedApiKeyCount: 999,
      unavailable: false,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("cms-integrations-domains-verified-count"),
      ).toHaveTextContent("999");
    });

    // Switch to workspace B. Workspace B's fetch is still pending — the user
    // must NOT see the 999s from workspace A while B loads.
    mockUseWorkspace.mockReturnValue({
      currentWorkspace: { id: "workspace-B", name: "Workspace B" },
    });
    rerender(<CmsIntegrationsPanel workspaceSlug="workspace-b" />);

    // Allow React to flush the effect cleanup + new effect run.
    await waitFor(() => {
      expect(
        screen.getByTestId("cms-integrations-domains-verified-count"),
      ).not.toHaveTextContent("999");
    });

    // While workspace B's fetch is in flight, the panel should show
    // placeholder dashes (the "—" we render when status is null).
    expect(
      screen.getByTestId("cms-integrations-domains-verified-count"),
    ).toHaveTextContent("—");

    // Resolve workspace B with its real counts; UI updates.
    resolveB({
      verifiedDomainCount: 1,
      pendingDomainCount: 0,
      activeApiKeyCount: 1,
      cmsScopedApiKeyCount: 1,
      unavailable: false,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("cms-integrations-domains-verified-count"),
      ).toHaveTextContent("1");
    });
  });

  it("clears stale counts when the user logs out (auth state goes false)", async () => {
    fetchStatusMock.mockResolvedValueOnce({
      verifiedDomainCount: 42,
      pendingDomainCount: 7,
      activeApiKeyCount: 5,
      cmsScopedApiKeyCount: 3,
      unavailable: false,
    });

    const { rerender } = render(
      <CmsIntegrationsPanel workspaceSlug="acme-demo" />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("cms-integrations-domains-verified-count"),
      ).toHaveTextContent("42");
    });

    // Auth flips to "logged out" — the previous user's counts must clear,
    // not persist on screen until middleware redirects.
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      getAccessToken: vi.fn(),
    });
    rerender(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("cms-integrations-domains-verified-count"),
      ).toHaveTextContent("—");
    });
  });
});
