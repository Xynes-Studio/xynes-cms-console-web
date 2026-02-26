import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCmsContentEntries } from "./use-cms-content-entries";

const sampleListResult = {
  items: [
    {
      id: "entry-1",
      workspaceId: "workspace-1",
      contentTypeId: "content-type-1",
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
});
