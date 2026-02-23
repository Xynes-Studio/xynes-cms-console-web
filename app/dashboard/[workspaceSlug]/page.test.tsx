import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WorkspaceDashboardPage from "./page";

vi.mock("./WorkspaceSelectionSync.client", () => ({
  default: () => null,
}));

describe("Workspace Dashboard Page", () => {
  it("renders workspace slug from async params using dashboard namespace", async () => {
    const element = await WorkspaceDashboardPage({
      params: Promise.resolve({ workspaceSlug: "acme" }),
    });

    const html = renderToStaticMarkup(element);
    expect(html).toContain("Workspace: acme");
    expect(html).toContain("/dashboard/acme/content");
    expect(html).toContain("/logout?redirect=%2Fdashboard%2Facme");
  });
});
