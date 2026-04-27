import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();

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
    restoreEnv();
    cleanup();
  });

  it("communicates the integrations context in the page heading", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/integrations/i);
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
      "http://localhost:3100/dashboard/integrations?tab=domains",
    );
  });

  it("renders an API keys card that links to the Workspace Admin api keys tab", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", {
      name: /manage workspace api keys/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=api-keys",
    );
  });

  it("renders a Content API card that links to the CMS read-only key preset", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", {
      name: /create a read-only content api key/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=api-keys&preset=cms_readonly",
    );
  });

  it("renders a Publisher Automation card that links to the CMS publisher key preset", () => {
    render(<CmsIntegrationsPanel workspaceSlug="acme-demo" />);

    const link = screen.getByRole("link", {
      name: /create a publisher automation key/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:3100/dashboard/integrations?tab=api-keys&preset=cms_publisher",
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
    expect(link).toHaveAttribute("href", "/dashboard/integrations?tab=domains");
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
});
