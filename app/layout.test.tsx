import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("@lumia-ui/icons", () => ({
  IconSprite: () => <span data-testid="icon-sprite" aria-hidden="true" />,
}));

const nextHeadersState = vi.hoisted(() => ({
  cookieLocale: undefined as string | undefined,
  acceptLanguage: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "xynes_locale" && nextHeadersState.cookieLocale
        ? { value: nextHeadersState.cookieLocale }
        : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === "accept-language"
        ? (nextHeadersState.acceptLanguage ?? null)
        : null,
  }),
}));

vi.mock("../src/app/providers", () => ({
  Providers: ({
    children,
    locale,
  }: {
    children: ReactNode;
    locale: string;
  }) => (
    <div data-testid="cms-providers" data-locale={locale}>
      {children}
    </div>
  ),
}));

describe("RootLayout", () => {
  beforeEach(() => {
    nextHeadersState.cookieLocale = undefined;
    nextHeadersState.acceptLanguage = undefined;
  });

  it("wraps children in Providers using the default locale", async () => {
    const ui = await RootLayout({
      children: <main>content</main>,
    });
    const html = renderToStaticMarkup(ui);

    expect(html).toContain("data-testid=\"cms-providers\"");
    expect(html).toContain("data-locale=\"en-US\"");
    expect(html).toContain("<html lang=\"en-US\"");
    expect(html).toContain("data-testid=\"icon-sprite\"");
    expect(html).toContain("<main>content</main>");
  });

  it("uses the allowlisted locale cookie for html language and provider locale", async () => {
    nextHeadersState.cookieLocale = "en-XA";

    const ui = await RootLayout({
      children: <main>content</main>,
    });
    const html = renderToStaticMarkup(ui);

    expect(html).toContain("data-locale=\"en-XA\"");
    expect(html).toContain("<html lang=\"en-XA\"");
  });

  it("falls back to Accept-Language when the cookie locale is invalid", async () => {
    nextHeadersState.cookieLocale = "../../secret";
    nextHeadersState.acceptLanguage = "en-XA,en-US;q=0.9";

    const ui = await RootLayout({
      children: <main>content</main>,
    });
    const html = renderToStaticMarkup(ui);

    expect(html).toContain("data-locale=\"en-XA\"");
    expect(html).toContain("<html lang=\"en-XA\"");
  });
});
