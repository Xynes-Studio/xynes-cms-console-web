import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("@lumia-ui/icons", () => ({
  IconSprite: () => <span data-testid="icon-sprite" aria-hidden="true" />,
}));

vi.mock("../src/app/providers", () => ({
  Providers: ({ children }: { children: ReactNode }) => (
    <div data-testid="cms-providers">{children}</div>
  ),
}));

describe("RootLayout", () => {
  it("wraps children in Providers", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>content</main>
      </RootLayout>
    );

    expect(html).toContain("data-testid=\"cms-providers\"");
    expect(html).toContain("data-testid=\"icon-sprite\"");
    expect(html).toContain("<main>content</main>");
  });
});
