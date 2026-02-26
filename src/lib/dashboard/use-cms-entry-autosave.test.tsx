import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCmsEntryAutosave } from "./use-cms-entry-autosave";

describe("useCmsEntryAutosave", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (localStorageDescriptor) {
      Object.defineProperty(window, "localStorage", localStorageDescriptor);
    }
  });

  it("debounces draft save and clears snapshot on success", async () => {
    const saveDraft = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ value }) =>
        useCmsEntryAutosave({
          enabled: true,
          cacheKey: "entry-1",
          value,
          delayMs: 200,
          saveDraft,
        }),
      {
        initialProps: {
          value: { title: "first" },
        },
      },
    );

    rerender({ value: { title: "second" } });

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(result.current.saveState).toBe("saved");

    expect(result.current.pendingSnapshot).toBeNull();
  });

  it("keeps snapshot and supports retry when save fails", async () => {
    const saveDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useCmsEntryAutosave({
        enabled: true,
        cacheKey: "entry-2",
        value: { title: "draft" },
        delayMs: 100,
        saveDraft,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(result.current.saveState).toBe("error");
    expect(result.current.pendingSnapshot).toEqual({ title: "draft" });

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.saveState).toBe("saved");
  });

  it("restores cached snapshot on mount", () => {
    localStorage.setItem("cms-entry-autosave:entry-3", JSON.stringify({ title: "cached" }));

    const { result } = renderHook(() =>
      useCmsEntryAutosave({
        enabled: true,
        cacheKey: "entry-3",
        value: { title: "live" },
        delayMs: 100,
        saveDraft: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.pendingSnapshot).toEqual({ title: "cached" });
    expect(result.current.restoreSnapshot()).toEqual({ title: "cached" });
  });

  it("handles unavailable localStorage without crashing", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() =>
      useCmsEntryAutosave({
        enabled: true,
        cacheKey: "entry-4",
        value: { title: "live" },
        delayMs: 100,
        saveDraft: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.pendingSnapshot).toBeNull();
    expect(result.current.restoreSnapshot()).toBeNull();
  });

  it("handles throwing localStorage operations without crashing", () => {
    const getItem = vi.fn(() => {
      throw new Error("blocked");
    });
    const setItem = vi.fn(() => {
      throw new Error("blocked");
    });
    const removeItem = vi.fn(() => {
      throw new Error("blocked");
    });

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem,
        setItem,
        removeItem,
      },
    });

    const { result } = renderHook(() =>
      useCmsEntryAutosave({
        enabled: true,
        cacheKey: "entry-5",
        value: { title: "live" },
        delayMs: 50,
        saveDraft: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.pendingSnapshot).toBeNull();
    expect(result.current.restoreSnapshot()).toBeNull();
  });

  it("rehydrates snapshot when cacheKey changes", async () => {
    localStorage.setItem("cms-entry-autosave:entry-a", JSON.stringify({ title: "A" }));
    localStorage.setItem("cms-entry-autosave:entry-b", JSON.stringify({ title: "B" }));

    const { result, rerender } = renderHook(
      ({ cacheKey }) =>
        useCmsEntryAutosave({
          enabled: true,
          cacheKey,
          value: { title: "live" },
          delayMs: 100,
          saveDraft: vi.fn().mockResolvedValue(undefined),
        }),
      { initialProps: { cacheKey: "entry-a" } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pendingSnapshot).toEqual({ title: "A" });

    rerender({ cacheKey: "entry-b" });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pendingSnapshot).toEqual({ title: "B" });
  });

  it("does not auto-retry after save error until state is cleared", async () => {
    const saveDraft = vi.fn().mockRejectedValue(new Error("fail"));

    const { rerender } = renderHook(
      ({ value }) =>
        useCmsEntryAutosave({
          enabled: true,
          cacheKey: "entry-6",
          value,
          delayMs: 50,
          saveDraft,
        }),
      { initialProps: { value: { title: "first" } } },
    );

    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);

    rerender({ value: { title: "second" } });
    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });
});
