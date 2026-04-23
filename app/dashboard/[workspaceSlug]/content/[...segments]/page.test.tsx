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

vi.mock("../../../../../src/features/cms-content/CmsEditorScreen", () => ({
  CmsEditorScreen: ({
    entryId,
    workspaceSlug,
  }: {
    entryId: string;
    workspaceSlug: string;
  }) => (
    <section
      data-testid="cms-editor-screen"
      data-entry-id={entryId}
      data-workspace-slug={workspaceSlug}
    >
      cms-editor-screen
    </section>
  ),
}));

describe("Workspace Nested Content Page", () => {
  it("renders cms content list panel for directory-like nested content routes", async () => {
    render(
      await WorkspaceNestedContentPage({
        params: Promise.resolve({
          workspaceSlug: "acme-team",
          segments: ["level-1", "level-2"],
        }),
      }),
    );

    expect(screen.getByTestId("cms-content-list-panel")).toBeInTheDocument();
  });

  it("renders cms editor screen for reserved editor route segments", async () => {
    render(
      await WorkspaceNestedContentPage({
        params: Promise.resolve({
          workspaceSlug: "acme-team",
          segments: ["entry", "entry-42", "edit"],
        }),
      }),
    );

    const editor = screen.getByTestId("cms-editor-screen");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-entry-id", "entry-42");
    expect(editor).toHaveAttribute("data-workspace-slug", "acme-team");
  });
});
