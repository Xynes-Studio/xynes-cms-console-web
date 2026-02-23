import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceSelectionSync from "./WorkspaceSelectionSync.client";

const selectWorkspaceMock = vi.fn();

const authState = vi.hoisted(() => ({
  workspaces: [] as Array<{ id: string; slug?: string | null }>,
}));

const workspaceState = vi.hoisted(() => ({
  currentWorkspace: null as null | { slug?: string | null },
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => authState,
  useWorkspace: () => ({
    ...workspaceState,
    selectWorkspace: selectWorkspaceMock,
  }),
}));

describe("WorkspaceSelectionSync", () => {
  beforeEach(() => {
    selectWorkspaceMock.mockReset();
  });

  it("selects matching workspace by slug when current workspace differs", () => {
    workspaceState.currentWorkspace = { slug: "archan" };
    authState.workspaces = [
      { id: "ws-1", slug: "archan" },
      { id: "ws-2", slug: "xynes-studio-llp" },
    ];

    render(<WorkspaceSelectionSync workspaceSlug="xynes-studio-llp" />);

    expect(selectWorkspaceMock).toHaveBeenCalledWith("ws-2");
  });

  it("does not select when current workspace already matches route slug", () => {
    workspaceState.currentWorkspace = { slug: "xynes-studio-llp" };
    authState.workspaces = [{ id: "ws-2", slug: "xynes-studio-llp" }];

    render(<WorkspaceSelectionSync workspaceSlug="xynes-studio-llp" />);

    expect(selectWorkspaceMock).not.toHaveBeenCalled();
  });

  it("does not select when no workspace slug matches", () => {
    workspaceState.currentWorkspace = null;
    authState.workspaces = [{ id: "ws-1", slug: "archan" }];

    render(<WorkspaceSelectionSync workspaceSlug="xynes-studio-llp" />);

    expect(selectWorkspaceMock).not.toHaveBeenCalled();
  });
});
