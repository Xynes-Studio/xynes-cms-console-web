import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContentEntryEditPage from "./page";

vi.mock(
  "../../../../../../../src/features/cms-content/CmsEditorScreen",
  () => ({
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
  }),
);

describe("Content Entry Edit Page", () => {
  it("renders CmsEditorScreen with entryId and workspaceSlug from params", async () => {
    render(
      await ContentEntryEditPage({
        params: Promise.resolve({
          workspaceSlug: "acme-team",
          entryId: "entry-42",
        }),
      }),
    );

    const screen$ = screen.getByTestId("cms-editor-screen");
    expect(screen$).toBeInTheDocument();
    expect(screen$).toHaveAttribute("data-entry-id", "entry-42");
    expect(screen$).toHaveAttribute("data-workspace-slug", "acme-team");
  });
});
