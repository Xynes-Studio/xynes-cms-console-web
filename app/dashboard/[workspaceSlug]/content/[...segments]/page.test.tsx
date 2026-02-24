import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceNestedContentPage from "./page";

vi.mock("../../../../../src/components/dashboard", () => ({
  DashboardComingSoonPanel: ({ sectionLabel }: { sectionLabel: string }) => (
    <section data-testid="coming-soon-panel">{sectionLabel}</section>
  ),
}));

describe("Workspace Nested Content Page", () => {
  it("renders content panel for nested content routes", () => {
    render(<WorkspaceNestedContentPage />);

    expect(screen.getByTestId("coming-soon-panel")).toHaveTextContent("Contents");
  });
});
