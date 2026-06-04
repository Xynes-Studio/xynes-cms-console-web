import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("global stylesheet package imports", () => {
  it("imports Lumia editor CSS through the public package subpath", () => {
    const globalsCss = readFileSync(resolve("app/globals.css"), "utf8");

    expect(globalsCss).toContain('@import "@lumia-ui/editor/styles.css";');
    expect(globalsCss).not.toMatch(
      /node_modules\/@lumia-ui\/editor\/dist\/index\.css/,
    );
  });

  it("imports Lumia marketing CSS through the public package subpath", () => {
    const globalsCss = readFileSync(resolve("app/globals.css"), "utf8");

    expect(globalsCss).toContain('@import "@lumia-ui/marketing/styles.css";');
    expect(globalsCss).not.toMatch(
      /node_modules\/@lumia-ui\/marketing\/dist\/index\.css/,
    );
  });

  it("keeps the Lumia marketing source scan as a development fallback", () => {
    const globalsCss = readFileSync(resolve("app/globals.css"), "utf8");

    expect(globalsCss).toContain(
      '@source "../node_modules/@lumia-ui/marketing/dist/**/*.{js,mjs,cjs}";',
    );
    expect(globalsCss).toContain(
      '@source "../lumia-ds/packages/marketing/src/**/*.{js,ts,jsx,tsx}";',
    );
  });
});
