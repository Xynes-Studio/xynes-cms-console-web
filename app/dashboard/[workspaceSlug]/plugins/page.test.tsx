import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspacePluginsPage from "./page";

vi.mock("../../../../src/components/dashboard", () => ({
  DashboardComingSoonPanel: ({ sectionLabel }: { sectionLabel: string }) => (
    <section data-testid="coming-soon-panel">{sectionLabel}</section>
  ),
}));

describe("Workspace Plugins Page", () => {
  it("renders plugins coming soon panel", () => {
    render(<WorkspacePluginsPage />);

    expect(screen.getByTestId("coming-soon-panel")).toHaveTextContent("Plugins");
  });
});
