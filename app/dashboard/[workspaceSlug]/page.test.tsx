import { describe, expect, it, vi } from "vitest";
import WorkspaceDashboardPage from "./page";

const redirectMock = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Workspace Dashboard Page", () => {
  it("redirects legacy workspace root to canonical content route", async () => {
    await expect(
      WorkspaceDashboardPage({
        params: Promise.resolve({ workspaceSlug: "acme" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/acme/content");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/acme/content");
  });

  it("fails closed to /dashboard when workspace slug is unsafe", async () => {
    await expect(
      WorkspaceDashboardPage({
        params: Promise.resolve({ workspaceSlug: "../evil" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
