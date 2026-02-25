import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceDashboardLayout from "./layout";

vi.mock("../../../src/components/dashboard", () => ({
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
}));

describe("Workspace Dashboard Layout", () => {
  it("renders dashboard shell once around workspace routes", async () => {
    const element = await WorkspaceDashboardLayout({
      params: Promise.resolve({ workspaceSlug: "acme" }),
      children: <div data-testid="page-content">Page content</div>,
    });

    render(element);

    expect(screen.getByTestId("cms-dashboard-shell")).toHaveAttribute(
      "data-workspace-slug",
      "acme",
    );
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });
});
