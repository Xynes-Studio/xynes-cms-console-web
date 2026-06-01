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
      expect(state.retryAriaLabel).toBe("Retry loading");
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

  it("returns favourites-empty copy when favoritesOnly is on and no rows match (BUG-CMS-11)", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: null,
      count: 0,
      query: "",
      breadcrumbParts: [],
      favoritesOnly: true,
    });

    expect(state.kind).toBe("empty");
    if (state.kind === "empty") {
      expect(state.title).toBe("No favourites yet");
      expect(state.description).toBe(
        "Star entries you want to revisit, or turn off the favourites filter to see everything.",
      );
    }
  });

  it("prefers favourites-empty over directory-empty when both could apply (BUG-CMS-11)", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: null,
      count: 0,
      query: "",
      breadcrumbParts: ["marketing", "blog"],
      favoritesOnly: true,
    });

    expect(state.kind).toBe("empty");
    if (state.kind === "empty") {
      // Favourites-empty wins over directory-empty so the user sees the filter is the cause.
      expect(state.title).toBe("No favourites yet");
    }
  });

  it("uses provided translated copy for empty states", () => {
    const state = resolveCmsContentListState({
      isLoading: false,
      error: null,
      count: 0,
      query: "",
      breadcrumbParts: [],
      copy: {
        loadingTitle: "[LLooaaddiinngg]",
        loadingDescription: "[FFeettcchhiinngg]",
        errorTitle: "[UUnnaabbllee]",
        errorDescription: "[TTrryy aaggaaiinn]",
        retryLabel: "[RReettrryy]",
        retryAriaLabel: "[RReettrryy llooaaddiinngg]",
        searchEmptyTitle: "[NNoo mmaattcchheess]",
        searchEmptyDescription: "[TTrryy aannootthheerr]",
        directoryEmptyTitle: "[EEmmppttyy ddiirreeccttoorryy]",
        directoryEmptyDescription: "[CCrreeaattee hheerree]",
        rootEmptyTitle: "[NNoo eennttrriieess yyeett]",
        rootEmptyDescription: "[CCrreeaattee ffiirrsstt]",
        favoritesEmptyTitle: "[NNoo ffaavvoouurriitteess yyeett]",
        favoritesEmptyDescription: "[SSttaarr ffoorr llaatteerr]",
      },
    });

    expect(state.kind).toBe("empty");
    if (state.kind === "empty") {
      expect(state.title).toBe("[NNoo eennttrriieess yyeett]");
      expect(state.description).toBe("[CCrreeaattee ffiirrsstt]");
    }
  });
});
