import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceAccessControlPage from "./page";

vi.mock("../../../../src/components/dashboard", () => ({
  DashboardComingSoonPanel: ({ sectionLabel }: { sectionLabel: string }) => (
    <section data-testid="coming-soon-panel">{sectionLabel}</section>
  ),
}));

describe("Workspace Access Control Page", () => {
  it("renders access control coming soon panel", () => {
    render(<WorkspaceAccessControlPage />);

    expect(screen.getByTestId("coming-soon-panel")).toHaveTextContent(
      "Access Control",
    );
  });
});
