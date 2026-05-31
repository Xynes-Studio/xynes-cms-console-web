import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EditorLayout from "./layout";

describe("Editor Layout (full-screen overlay)", () => {
  it("renders children inside a full-screen overlay container", () => {
    render(
      <EditorLayout>
        <div data-testid="editor-child">editor content</div>
      </EditorLayout>,
    );

    expect(screen.getByTestId("editor-child")).toBeInTheDocument();
  });

  it("applies fixed full-screen positioning to escape the dashboard shell", () => {
    const { container } = render(
      <EditorLayout>
        <span>content</span>
      </EditorLayout>,
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toMatch(/fixed/);
    expect(overlay.className).toMatch(/inset-0/);
    expect(overlay.className).toMatch(/z-50/);
  });

  it("marks the overlay as the documented BUG-CMS-9 escape hatch", () => {
    // The editor full-screen overlay is the single allowed bypass of the
    // BUG-LDS-1 dashboard-shell scroll-containment contract. The
    // `data-bug-cms-9` marker pairs with the allowlist in
    // `app/dashboard-shell-contract.test.ts` so future refactors keep the
    // intent visible at the markup level.
    const { container } = render(
      <EditorLayout>
        <span>content</span>
      </EditorLayout>,
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.getAttribute("data-bug-cms-9")).toBe(
      "editor-fullscreen-overlay",
    );
  });
});
