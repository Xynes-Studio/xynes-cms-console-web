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
});
