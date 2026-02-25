import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceSettingsPage from "./page";

vi.mock("../../../../src/components/dashboard", () => ({
  DashboardComingSoonPanel: ({ sectionLabel }: { sectionLabel: string }) => (
    <section data-testid="coming-soon-panel">{sectionLabel}</section>
  ),
}));

describe("Workspace Settings Page", () => {
  it("renders settings coming soon panel", () => {
    render(<WorkspaceSettingsPage />);

    expect(screen.getByTestId("coming-soon-panel")).toHaveTextContent("Settings");
  });
});
