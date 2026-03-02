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
});
