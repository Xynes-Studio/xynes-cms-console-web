import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCmsContentEntries } from "./use-cms-content-entries";

const sampleListResult = {
  items: [
    {
      id: "entry-1",
      workspaceId: "workspace-1",
      directoryId: null,
      title: "Title",
      description: "Desc",
      body: null,
      tags: [],
      ownerName: null,
      avatarUrl: null,
      status: "draft" as const,
      publishedAt: null,
      createdAt: "2026-02-26T10:00:00.000Z",
      updatedAt: "2026-02-26T10:00:00.000Z",
      collaborators: [],
      isFavorite: false,
    },
  ],
  count: 1,
};

describe("useCmsContentEntries", () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it("loads entries and exposes success state", async () => {
    const listEntries = vi.fn().mockResolvedValue(sampleListResult);

    const { result } = renderHook(() =>
      useCmsContentEntries({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        query: { sortBy: "date", sortDirection: "desc", view: "list" },
        listEntries,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listEntries).toHaveBeenCalledTimes(1);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("exposes error state on fetch failure and refresh retries", async () => {
    const listEntries = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(sampleListResult);

    const { result } = renderHook(() =>
      useCmsContentEntries({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        query: { sortBy: "date", sortDirection: "desc", view: "list" },
        listEntries,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.items).toHaveLength(1);
    });
  });

  it("skips loading when disabled", async () => {
    const listEntries = vi.fn().mockResolvedValue(sampleListResult);

    const { result } = renderHook(() =>
      useCmsContentEntries({
        apiBaseUrl: "http://localhost:4100",
        workspaceId: "workspace-1",
        accessToken: "jwt-token",
        query: { sortBy: "date", sortDirection: "desc", view: "list" },
        listEntries,
        enabled: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listEntries).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("ignores stale responses and keeps latest request result", async () => {
    const first = deferred<typeof sampleListResult>();
    const second = deferred<typeof sampleListResult>();
    const listEntries = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ search }) =>
        useCmsContentEntries({
          apiBaseUrl: "http://localhost:4100",
          workspaceId: "workspace-1",
          accessToken: "jwt-token",
          query: {
            sortBy: "date",
            sortDirection: "desc",
            view: "list",
            search,
          },
          listEntries,
        }),
      { initialProps: { search: "a" } },
    );

    rerender({ search: "b" });

    await act(async () => {
      second.resolve({
        items: [
          { ...sampleListResult.items[0], id: "entry-new", title: "New" },
        ],
        count: 1,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.items[0]?.id).toBe("entry-new");
    });

    await act(async () => {
      first.resolve(sampleListResult);
      await Promise.resolve();
    });

    expect(result.current.items[0]?.id).toBe("entry-new");
  });
});
