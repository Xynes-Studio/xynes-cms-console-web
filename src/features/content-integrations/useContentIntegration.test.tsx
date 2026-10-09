import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  folderContext as folderFixture,
  entryContext as entryFixture,
} from "./workbench-test-fixtures";
import { useContentIntegration } from "./useContentIntegration";
import type { IntegrationContext } from "./types";
let folderContext: IntegrationContext;
let entryContext: IntegrationContext;
let sequence = 0;
beforeEach(() => {
  const workspaceId = `90000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  folderContext = { ...folderFixture, workspaceId };
  entryContext = { ...entryFixture, workspaceId };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function clipboard(
  writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(),
) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  return writeText;
}
describe("content integration state", () => {
  it("highlights the latest changed parameter for 1.2 seconds, then cleans up", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useContentIntegration(folderContext),
    );
    expect(result.current.changedParam).toBeNull();
    act(() =>
      result.current.updateControls({ sortBy: "title", sortDirection: "asc" }),
    );
    expect(result.current.changedParam).toBe("sortBy");
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.updateControls({ limit: "5" }));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.changedParam).toBe("limit");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.changedParam).toBeNull();
    act(() => result.current.updateControls({ search: "news" }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("remembers controls and format on reopen, isolates targets, and never remembers copy status", async () => {
    clipboard();
    const first = renderHook(() => useContentIntegration(folderContext));
    act(() => {
      first.result.current.updateControls({ limit: "7", search: "news" });
      first.result.current.setFormat("url");
    });
    await act(() => first.result.current.copy());
    first.unmount();
    const reopened = renderHook(() => useContentIntegration(folderContext));
    expect(reopened.result.current.controls).toMatchObject({
      limit: "7",
      search: "news",
    });
    expect(reopened.result.current.format).toBe("url");
    expect(reopened.result.current.copyStatus).toBe("idle");
    expect(reopened.result.current.changedParam).toBeNull();
    const other = renderHook(() => useContentIntegration(entryContext));
    expect(other.result.current.controls.limit).toBe("20");
    expect(other.result.current.format).toBe("curl");
  });
  it("clears copied feedback after two seconds and allows the next copy to report success", async () => {
    vi.useFakeTimers();
    const write = clipboard();
    const { result } = renderHook(() => useContentIntegration(folderContext));
    await act(() => result.current.copy());
    expect(result.current.copyStatus).toBe("copied");
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.copyStatus).toBe("copied");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copyStatus).toBe("idle");
    await act(() => result.current.copy());
    expect(write).toHaveBeenCalledTimes(2);
    expect(result.current.copyStatus).toBe("copied");
  });
  it("cancels copied feedback timers on revision change and unmount", async () => {
    vi.useFakeTimers();
    clipboard();
    const { result, unmount } = renderHook(() =>
      useContentIntegration(folderContext),
    );
    await act(() => result.current.copy());
    expect(vi.getTimerCount()).toBe(1);
    act(() => result.current.updateControls({ limit: "5" }));
    expect(result.current.copyStatus).toBe("idle");
    act(() => vi.advanceTimersByTime(1200));
    expect(vi.getTimerCount()).toBe(0);
    await act(() => result.current.copy());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps feedback for two seconds after the latest successful copy", async () => {
    vi.useFakeTimers();
    clipboard();
    const { result } = renderHook(() => useContentIntegration(folderContext));
    await act(() => result.current.copy());
    act(() => vi.advanceTimersByTime(1500));
    await act(() => result.current.copy());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.copyStatus).toBe("copied");
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.copyStatus).toBe("idle");
  });
  it("uses contract defaults and no network or persistence", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useContentIntegration(folderContext));
    expect(result.current.result.ok).toBe(true);
    expect(result.current.controls.limit).toBe("20");

    expect(fetch).not.toHaveBeenCalled();
  });
  it("entry requests expose body and contain no directory options", () => {
    const { result } = renderHook(() => useContentIntegration(entryContext));
    expect(result.current.result).toMatchObject({
      ok: true,
      request: {
        kind: "entry",
        options: { fields: expect.arrayContaining(["body"]) },
      },
    });
    if (result.current.result.ok)
      expect(result.current.result.request.options).not.toHaveProperty("limit");
  });
  it.each(["0", "101", "1.5", "", "oops"])(
    "rejects invalid limit %s",
    (limit) => {
      const { result } = renderHook(() => useContentIntegration(folderContext));
      act(() => result.current.updateControls({ limit }));
      expect(result.current.result).toMatchObject({
        ok: false,
        error: { code: "INVALID_OPTIONS" },
      });
    },
  );
  it("rejects folder body, preserves ID, and omits blank search", () => {
    const { result } = renderHook(() => useContentIntegration(folderContext));
    act(() => result.current.updateControls({ fields: [], search: "   " }));
    expect(result.current.result).toMatchObject({
      ok: true,
      request: { fields: ["id"] },
    });
    act(() => result.current.updateControls({ fields: ["body"] }));
    expect(result.current.result.ok).toBe(false);
  });
  it.each(["-1", "10001", "0.5", ""])("rejects invalid offset %s", (offset) => {
    const { result } = renderHook(() => useContentIntegration(folderContext));
    act(() => result.current.updateControls({ offset }));
    expect(result.current.result.ok).toBe(false);
  });
  it("trims search and rejects excessive search", () => {
    const { result } = renderHook(() => useContentIntegration(folderContext));
    act(() =>
      result.current.updateControls({
        search: "  design  ",
        sortBy: "title",
        sortDirection: "asc",
      }),
    );
    expect(result.current.result).toMatchObject({
      ok: true,
      request: {
        options: { search: "design", sortBy: "title", sortDirection: "asc" },
      },
    });
    act(() => result.current.updateControls({ search: "x".repeat(201) }));
    expect(result.current.result.ok).toBe(false);
  });
  it.each(["entry", "workspace"] as const)(
    "resets all state on resource, workspace or config switch",
    (kind) => {
      const next =
        kind === "entry"
          ? entryContext
          : {
              ...folderContext,
              workspaceId: "44444444-4444-4444-8444-444444444444",
            };
      const { result, rerender } = renderHook(
        ({ context }: { context: IntegrationContext }) =>
          useContentIntegration(context),
        { initialProps: { context: folderContext } },
      );
      act(() => {
        result.current.updateControls({ limit: "0" });
        result.current.setFormat("serverFetch");
      });
      rerender({ context: next });
      expect(result.current.result.ok).toBe(true);
      expect(result.current.format).toBe("curl");
      expect(result.current.copyStatus).toBe("idle");
    },
  );
  it("only reports copy after fulfillment", async () => {
    let finish: (() => void) | undefined;
    const write = clipboard(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { result } = renderHook(() => useContentIntegration(folderContext));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.copy();
    });
    expect(result.current.copyStatus).toBe("pending");
    expect(write).toHaveBeenCalledOnce();
    await act(async () => {
      finish?.();
      await pending;
    });
    expect(result.current.copyStatus).toBe("copied");
    act(() => result.current.setFormat("url"));
    expect(result.current.copyStatus).toBe("idle");
  });
  it("ignores stale copy completion after options change", async () => {
    let finish: (() => void) | undefined;
    clipboard(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { result } = renderHook(() => useContentIntegration(folderContext));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.copy();
    });
    act(() => result.current.updateControls({ limit: "5" }));
    await act(async () => {
      finish?.();
      await pending;
    });
    expect(result.current.copyStatus).toBe("idle");
  });
  it("ignores stale clipboard completion after target switch", async () => {
    let finish: (() => void) | undefined;
    clipboard(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { result, rerender } = renderHook(
      ({ context }: { context: IntegrationContext }) =>
        useContentIntegration(context),
      { initialProps: { context: folderContext } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.copy();
    });
    rerender({ context: entryContext });
    rerender({ context: folderContext });
    await act(async () => {
      finish?.();
      await pending;
    });
    expect(result.current.copyStatus).toBe("idle");
  });
  it("handles denied and missing clipboard without exposing errors", async () => {
    clipboard(vi.fn().mockRejectedValue(new Error("private-secret")));
    const { result } = renderHook(() => useContentIntegration(folderContext));
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.copyStatus).toBe("manual");
    vi.stubGlobal("navigator", {});
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.copyStatus).toBe("manual");
  });
  it("serializes clipboard writes across option changes", async () => {
    let finish: (() => void) | undefined;
    const write = clipboard(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { result } = renderHook(() => useContentIntegration(folderContext));
    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.copy();
    });
    act(() => result.current.setFormat("url"));
    await act(async () => {
      await result.current.copy();
    });
    expect(write).toHaveBeenCalledOnce();
    await act(async () => {
      finish?.();
      await first;
    });
    write.mockResolvedValue();
    await act(async () => {
      await result.current.copy();
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(result.current.copyStatus).toBe("copied");
  });
  it("never copies invalid configuration", async () => {
    const write = clipboard();
    const { result } = renderHook(() =>
      useContentIntegration({ ...folderContext, apiBaseUrl: "" }),
    );
    await act(async () => {
      await result.current.copy();
    });
    expect(write).not.toHaveBeenCalled();
    expect(result.current.result.ok).toBe(false);
  });
});

describe("clipboard across workbench lifetimes", () => {
  it("serializes a reopened workbench behind the closing workbench's pending write", async () => {
    let finishFirst: (() => void) | undefined;
    let written = "";
    const write = clipboard(
      vi
        .fn<(text: string) => Promise<void>>()
        .mockImplementationOnce(
          (text) =>
            new Promise<void>((resolve) => {
              finishFirst = () => {
                written = text;
                resolve();
              };
            }),
        )
        .mockImplementation(async (text) => {
          written = text;
        }),
    );
    const first = renderHook(() => useContentIntegration(folderContext));
    let oldCopy: Promise<void> | undefined;
    act(() => {
      oldCopy = first.result.current.copy();
    });
    first.unmount();
    const reopened = renderHook(() => useContentIntegration(entryContext));
    let newCopy: Promise<void> | undefined;
    act(() => {
      newCopy = reopened.result.current.copy();
    });
    expect(write).toHaveBeenCalledOnce();
    await act(async () => {
      finishFirst?.();
      await oldCopy;
      await newCopy;
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(written).toBe(reopened.result.current.snippet);
    expect(reopened.result.current.copyStatus).toBe("copied");
  });
  it("allows a reopened copy after the previous clipboard write rejects", async () => {
    let rejectFirst: (() => void) | undefined;
    const write = clipboard(
      vi
        .fn<(text: string) => Promise<void>>()
        .mockImplementationOnce(
          () =>
            new Promise<void>((_resolve, reject) => {
              rejectFirst = () => reject(new Error("private-denial"));
            }),
        )
        .mockResolvedValue(undefined),
    );
    const first = renderHook(() => useContentIntegration(folderContext));
    let oldCopy: Promise<void> | undefined;
    act(() => {
      oldCopy = first.result.current.copy();
    });
    first.unmount();
    const reopened = renderHook(() => useContentIntegration(entryContext));
    let newCopy: Promise<void> | undefined;
    act(() => {
      newCopy = reopened.result.current.copy();
    });
    expect(write).toHaveBeenCalledOnce();
    await act(async () => {
      rejectFirst?.();
      await oldCopy;
      await newCopy;
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(reopened.result.current.copyStatus).toBe("copied");
  });
});
