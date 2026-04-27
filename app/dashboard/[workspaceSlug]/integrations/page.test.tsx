import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/features/integrations/CmsIntegrationsPanel", () => ({
  CmsIntegrationsPanel: ({ workspaceSlug }: { workspaceSlug: string }) => (
    <section data-testid="cms-integrations-panel">{workspaceSlug}</section>
  ),
}));

import WorkspaceIntegrationsPage from "./page";

describe("Workspace Integrations Page", () => {
  it("renders the CMS integrations panel and forwards the workspace slug from params", async () => {
    const ui = await WorkspaceIntegrationsPage({
      params: Promise.resolve({ workspaceSlug: "acme-demo" }),
    });

    render(ui);

    const panel = screen.getByTestId("cms-integrations-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("acme-demo");
  });

  it("does not render the under-development placeholder", async () => {
    const ui = await WorkspaceIntegrationsPage({
      params: Promise.resolve({ workspaceSlug: "acme-demo" }),
    });

    render(ui);

    expect(screen.queryByTestId("coming-soon-panel")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/integrations are under development/i),
    ).not.toBeInTheDocument();
  });
});
