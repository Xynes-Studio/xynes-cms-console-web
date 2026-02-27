import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCmsContentQueryState } from "./use-cms-content-query-state";

const push = vi.fn();
const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/acme/content",
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

describe("useCmsContentQueryState", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    search = "";
  });

  it("reads defaults from empty query", () => {
    const { result } = renderHook(() => useCmsContentQueryState());
    expect(result.current.state).toMatchObject({
      query: "",
      sortBy: "date",
      sortDirection: "desc",
      view: "list",
      followingOnly: false,
      favoritesOnly: false,
      status: "all",
      limit: 20,
      offset: 0,
      directoryId: null,
    });
  });

  it("normalizes malformed values from query", () => {
    search =
      "?q=%20hello%20&sortBy=bad&sortDirection=bad&view=unknown&following=1&favorites=true&status=nope&limit=999&offset=-4&directoryId=%20";
    const { result } = renderHook(() => useCmsContentQueryState());

    expect(result.current.state).toMatchObject({
      query: "hello",
      sortBy: "date",
      sortDirection: "desc",
      view: "list",
      followingOnly: true,
      favoritesOnly: true,
      status: "all",
      limit: 100,
      offset: 0,
      directoryId: null,
    });
  });

  it("parses valid query values", () => {
    search =
      "?q=hello&sortBy=popularity&sortDirection=asc&view=grid&following=true&favorites=1&status=published&limit=7&offset=14&directoryId=dir-123";
    const { result } = renderHook(() => useCmsContentQueryState());

    expect(result.current.state).toMatchObject({
      query: "hello",
      sortBy: "popularity",
      sortDirection: "asc",
      view: "grid",
      followingOnly: true,
      favoritesOnly: true,
      status: "published",
      limit: 7,
      offset: 14,
      directoryId: "dir-123",
    });
  });

  it("updates URL query params when setState is called", () => {
    const { result } = renderHook(() => useCmsContentQueryState());

    act(() => {
      result.current.setState({
        query: "post",
        sortBy: "title",
        view: "grid",
        favoritesOnly: true,
      });
    });

    expect(push).toHaveBeenCalledTimes(1);
    const nextUrl = push.mock.calls[0][0] as string;
    expect(nextUrl).toContain("/dashboard/acme/content?");
    expect(nextUrl).toContain("q=post");
    expect(nextUrl).toContain("sortBy=title");
    expect(nextUrl).toContain("view=grid");
    expect(nextUrl).toContain("favorites=1");
  });

  it("serializes non-default values and omits defaults", () => {
    const { result } = renderHook(() => useCmsContentQueryState());

    act(() => {
      result.current.setState({
        query: "abc",
        directoryId: "dir-1",
        sortBy: "popularity",
        sortDirection: "asc",
        view: "grid",
        followingOnly: true,
        favoritesOnly: true,
        status: "draft",
        limit: 50,
        offset: 40,
      });
    });

    expect(push).toHaveBeenCalledTimes(1);
    const nextUrl = push.mock.calls[0][0] as string;
    expect(nextUrl).toContain("q=abc");
    expect(nextUrl).toContain("directoryId=dir-1");
    expect(nextUrl).toContain("sortBy=popularity");
    expect(nextUrl).toContain("sortDirection=asc");
    expect(nextUrl).toContain("view=grid");
    expect(nextUrl).toContain("following=1");
    expect(nextUrl).toContain("favorites=1");
    expect(nextUrl).toContain("status=draft");
    expect(nextUrl).toContain("limit=50");
    expect(nextUrl).toContain("offset=40");
  });

  it("can clear all params back to defaults", () => {
    search =
      "?q=abc&directoryId=dir-1&sortBy=title&sortDirection=asc&view=grid&following=1&favorites=1&status=archived&limit=25&offset=10";
    const { result } = renderHook(() => useCmsContentQueryState());

    act(() => {
      result.current.setState({
        query: "",
        directoryId: null,
        sortBy: "date",
        sortDirection: "desc",
        view: "list",
        followingOnly: false,
        favoritesOnly: false,
        status: "all",
        limit: 20,
        offset: 0,
      });
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe("/dashboard/acme/content");
  });

  it("does not push when resulting URL is unchanged", () => {
    search = "?q=stable&view=grid";
    const { result } = renderHook(() => useCmsContentQueryState());

    act(() => {
      result.current.setState({
        query: "stable",
        view: "grid",
      });
    });

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("uses router.replace when replace navigation is requested", () => {
    const { result } = renderHook(() => useCmsContentQueryState());

    act(() => {
      result.current.setState(
        {
          query: "debounced",
          offset: 0,
        },
        { navigation: "replace" },
      );
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toContain("q=debounced");
    expect(push).not.toHaveBeenCalled();
  });
});
