import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WorkspaceHomePage from "./page";

describe("Workspace Home Page", () => {
  it("renders current workspace slug from async route params", async () => {
    const element = await WorkspaceHomePage({
      params: Promise.resolve({ workspaceSlug: "acme" }),
    });

    const html = renderToStaticMarkup(element);
    expect(html).toContain("Workspace: acme");
    expect(html).toContain("/acme/content");
  });
});

