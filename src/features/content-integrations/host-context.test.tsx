import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDirectoryIntegrationContext,
  buildEntryIntegrationContext,
  resolveIntegrationPublicationState,
  isContentIntegrationsEnabled,
} from "./host-context";
import { useIntegrationDialog } from "./useIntegrationDialog";
import { folderContext, entryContext } from "./workbench-test-fixtures";
const entry = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: folderContext.workspaceId,
  title: "First story",
  status: "published" as const,
  publishedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deliveryState: "republish_required" as const,
};
const workspace = {
  workspaceId: folderContext.workspaceId,
  workspaceSlug: folderContext.workspaceSlug,
  apiBaseUrl: folderContext.apiBaseUrl,
};
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe("integration host boundaries", () => {
  it.each([undefined, "", "0", "false", "true"])(
    "defaults rollout off for %s",
    (value) => {
      if (value === undefined)
        vi.stubEnv("NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED", undefined);
      else vi.stubEnv("NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED", value);
      expect(isContentIntegrationsEnabled()).toBe(false);
    },
  );
  it("accepts only explicit enabled rollout", () => {
    vi.stubEnv("NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED", "1");
    expect(isContentIntegrationsEnabled()).toBe(true);
  });
  it("refuses root or unresolved folder targets", () => {
    expect(
      buildDirectoryIntegrationContext({ ...workspace, directory: null }),
    ).toBeNull();
  });
  it("uses persisted folder UUID and label", () => {
    expect(
      buildDirectoryIntegrationContext({
        ...workspace,
        directory: {
          id: "22222222-2222-4222-8222-222222222222",
          label: "News",
          breadcrumb: "Content / News",
        },
      }),
    ).toMatchObject({
      target: {
        kind: "directory",
        directoryId: "22222222-2222-4222-8222-222222222222",
        label: "News",
      },
    });
  });
  it("refuses cross-workspace and stale entry IDs", () => {
    expect(
      buildEntryIntegrationContext({
        ...workspace,
        entryId: entry.id,
        entry: { ...entry, workspaceId: "other" },
      }),
    ).toBeNull();
    expect(
      buildEntryIntegrationContext({ ...workspace, entryId: "other", entry }),
    ).toBeNull();
  });
  it("retains optional delivery metadata and publication guidance", () => {
    expect(
      buildEntryIntegrationContext({ ...workspace, entryId: entry.id, entry }),
    ).toMatchObject({
      deliveryState: "republish_required",
      publicationState: "published",
      target: { entryId: entry.id },
    });
    expect(
      buildEntryIntegrationContext({
        ...workspace,
        entryId: entry.id,
        entry: { ...entry, deliveryState: undefined },
      }),
    ).toMatchObject({ deliveryState: "unknown" });
  });
  it("shares the editor's saved/unsaved publication classification", () => {
    expect(resolveIntegrationPublicationState(entry)).toBe("published");
    expect(resolveIntegrationPublicationState(entry, true)).toBe(
      "published-with-changes",
    );
    expect(
      resolveIntegrationPublicationState({
        ...entry,
        updatedAt: "2026-10-01T00:00:02.000Z",
      }),
    ).toBe("published-with-changes");
    expect(
      resolveIntegrationPublicationState({ ...entry, status: "scheduled" }),
    ).toBe("scheduled");
  });
});
describe("dialog host scope", () => {
  it("closes immediately on navigation/workspace switch and does not resurrect an old target", () => {
    const { result, rerender } = renderHook(
      ({ scope, enabled }) => useIntegrationDialog(scope, enabled),
      { initialProps: { scope: "workspace:folder-a", enabled: true } },
    );
    act(() => result.current.open(folderContext));
    expect(result.current.context).toBe(folderContext);
    rerender({ scope: "workspace:folder-b", enabled: true });
    expect(result.current.context).toBeNull();
    rerender({ scope: "workspace:folder-a", enabled: true });
    expect(result.current.context).toBeNull();
    act(() => result.current.open(entryContext));
    rerender({ scope: "other:folder-a", enabled: true });
    expect(result.current.context).toBeNull();
  });
  it("clears on flag off and leaves old triggers untouched", () => {
    const focus = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) => useIntegrationDialog("scope", enabled),
      { initialProps: { enabled: true } },
    );
    act(() => result.current.open(entryContext, focus));
    rerender({ enabled: false });
    expect(result.current.context).toBeNull();
    act(() => result.current.restoreFocus());
    expect(focus).not.toHaveBeenCalled();
  });
  it("restores only explicitly closed current-scope focus after the dialog unmounts", () => {
    const focus = vi.fn();
    const { result } = renderHook(() => useIntegrationDialog("scope", true));
    act(() => result.current.open(entryContext, focus));
    act(() => result.current.close());
    expect(result.current.context).toBeNull();
    expect(focus).not.toHaveBeenCalled();
    act(() => result.current.restoreFocus());
    expect(focus).toHaveBeenCalledOnce();
  });
});
describe("logical dialog focus and disabled open", () => {
  it("restores a connected element once and ignores detached or absent targets", () => {
    const { result } = renderHook(() => useIntegrationDialog("scope", true));
    const button = document.createElement("button");
    document.body.append(button);
    act(() => result.current.open(entryContext, button));
    act(() => result.current.close());
    act(() => result.current.restoreFocus());
    expect(button).toHaveFocus();
    button.remove();
    const focus = vi.spyOn(button, "focus");
    act(() => result.current.open(entryContext, button));
    act(() => result.current.restoreFocus());
    expect(focus).not.toHaveBeenCalled();
    act(() => result.current.open(entryContext));
    act(() => result.current.restoreFocus());
  });
  it("cannot open when rollout is disabled", () => {
    const { result } = renderHook(() => useIntegrationDialog("scope", false));
    act(() => result.current.open(entryContext));
    expect(result.current.context).toBeNull();
  });
});
