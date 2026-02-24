import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceIntegrationsPage from "./page";

vi.mock("../../../../src/components/dashboard", () => ({
  CmsDashboardShell: ({
    children,
    workspaceSlug,
  }: {
    children: ReactNode;
    workspaceSlug: string;
  }) => (
    <div data-testid="cms-dashboard-shell" data-workspace-slug={workspaceSlug}>
      {children}
    </div>
  ),
  DashboardComingSoonPanel: ({ sectionLabel }: { sectionLabel: string }) => (
    <section data-testid="coming-soon-panel">{sectionLabel}</section>
  ),
}));

describe("Workspace Integrations Page", () => {
  it("renders integrations coming soon panel", async () => {
    const element = await WorkspaceIntegrationsPage({
      params: Promise.resolve({ workspaceSlug: "acme" }),
    });

    render(element);
    expect(screen.getByTestId("cms-dashboard-shell")).toHaveAttribute(
      "data-workspace-slug",
      "acme",
    );
    expect(screen.getByTestId("coming-soon-panel")).toHaveTextContent(
      "Integrations",
    );
  });
});
