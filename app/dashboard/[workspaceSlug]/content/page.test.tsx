import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceContentPage from "./page";

vi.mock("../../../../src/components/dashboard", () => ({
  DashboardComingSoonPanel: ({ sectionLabel }: { sectionLabel: string }) => (
    <section data-testid="coming-soon-panel">{sectionLabel}</section>
  ),
}));

describe("Workspace Content Page", () => {
  it("renders content coming soon panel", () => {
    render(<WorkspaceContentPage />);

    expect(screen.getByTestId("coming-soon-panel")).toHaveTextContent("Contents");
  });
});
