import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCmsContentQueryState } from "./use-cms-content-query-state";

const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/acme/content",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));

describe("useCmsContentQueryState", () => {
  beforeEach(() => {
    push.mockReset();
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
    search = "?q=%20hello%20&sortBy=bad&sortDirection=bad&view=unknown&following=1&favorites=true&status=nope&limit=999&offset=-4&directoryId=%20";
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
});
