import { describe, expect, it } from "vitest";
import { resolveCmsContentListState } from "./CmsContentListState";

describe("resolveCmsContentListState", () => {
  it("returns loading when request is in progress", () => {
    const state = resolveCmsContentListState({
      isLoading: true,
      error: null,
      count: 0,
      query: "",
      breadcrumbParts: [],
    });

    expect(state.kind).toBe("loading");
  });

  it("returns error when request failed", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: new Error("boom"),
      count: 0,
      query: "",
      breadcrumbParts: [],
    });

    expect(state.kind).toBe("error");
    if (state.kind === "error") {
      expect(state.retryLabel).toBe("Retry");
    }
  });

  it("returns ready when entries exist", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: null,
      count: 3,
      query: "",
      breadcrumbParts: [],
    });

    expect(state.kind).toBe("ready");
  });

  it("returns search-empty copy when query has no matches", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: null,
      count: 0,
      query: "docs",
      breadcrumbParts: [],
    });

    expect(state.kind).toBe("empty");
    if (state.kind === "empty") {
      expect(state.title).toBe("No content matched your search");
    }
  });

  it("returns directory-empty copy when inside nested content path", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: null,
      count: 0,
      query: "",
      breadcrumbParts: ["marketing", "blog"],
    });

    expect(state.kind).toBe("empty");
    if (state.kind === "empty") {
      expect(state.title).toBe("This directory is empty");
    }
  });
});
