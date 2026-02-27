import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspaceNestedContentPage from "./page";

vi.mock("../../../../../src/features/cms-content/CmsContentListPanel", () => ({
  CmsContentListPanel: () => (
    <section data-testid="cms-content-list-panel">
      cms-content-list-panel
    </section>
  ),
}));

describe("Workspace Nested Content Page", () => {
  it("renders cms content list panel for nested content routes", () => {
    render(<WorkspaceNestedContentPage />);

    expect(screen.getByTestId("cms-content-list-panel")).toBeInTheDocument();
  });
});
