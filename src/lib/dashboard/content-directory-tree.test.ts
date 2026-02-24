import { describe, expect, it } from "vitest";
import {
  addContentDirectory,
  ensureContentDirectoryPath,
  getContentDirectoryPathIds,
  getContentDirectoryPathSegment,
  isUniqueContentDirectoryName,
  normalizeContentDirectoryName,
  type ContentDirectoryNode,
} from "./content-directory-tree";

const fixture: ContentDirectoryNode[] = [
  {
    id: "blogs",
    label: "Blogs",
    children: [{ id: "guides", label: "Guides" }],
  },
  {
    id: "docs",
    label: "Docs",
  },
];

describe("content-directory-tree", () => {
  it("normalizes name by trimming surrounding whitespace", () => {
    expect(normalizeContentDirectoryName("  Blogs  ")).toBe("Blogs");
  });

  it("builds stable path segments from labels", () => {
    expect(
      getContentDirectoryPathSegment({
        id: "node-id",
        label: " Blogs & Drafts ",
      }),
    ).toBe("blogs-drafts");
  });

  it("enforces sibling-level case-insensitive uniqueness", () => {
    expect(
      isUniqueContentDirectoryName({
        nodes: fixture,
        parentId: null,
        name: "blogs",
      }),
    ).toBe(false);

    expect(
      isUniqueContentDirectoryName({
        nodes: fixture,
        parentId: "blogs",
        name: "blogs",
      }),
    ).toBe(true);
  });

  it("adds directories at root and nested levels", () => {
    const nextRoot = addContentDirectory({
      nodes: fixture,
      parentId: null,
      rawName: "News",
      createId: () => "news",
    });

    expect(nextRoot).toHaveLength(3);
    expect(nextRoot[2]).toEqual({
      id: "news",
      label: "News",
      children: [],
    });

    const nextNested = addContentDirectory({
      nodes: fixture,
      parentId: "blogs",
      rawName: "Blogs",
      createId: () => "blogs-child",
    });

    expect(nextNested[0]?.children).toEqual([
      { id: "guides", label: "Guides" },
      { id: "blogs-child", label: "Blogs", children: [] },
    ]);
  });

  it("fails closed for invalid names and duplicate siblings", () => {
    expect(
      addContentDirectory({
        nodes: fixture,
        parentId: null,
        rawName: " ",
      }),
    ).toBe(fixture);

    expect(
      addContentDirectory({
        nodes: fixture,
        parentId: null,
        rawName: "A".repeat(81),
      }),
    ).toBe(fixture);

    expect(
      addContentDirectory({
        nodes: fixture,
        parentId: null,
        rawName: "blogs",
      }),
    ).toBe(fixture);
  });

  it("returns path ids for nested URL segments", () => {
    expect(
      getContentDirectoryPathIds({
        nodes: fixture,
        pathSegments: ["blogs", "guides"],
      }),
    ).toEqual(["blogs", "guides"]);

    expect(
      getContentDirectoryPathIds({
        nodes: fixture,
        pathSegments: ["blogs", "missing"],
      }),
    ).toEqual([]);
  });

  it("ensures missing URL path directories are materialized", () => {
    const next = ensureContentDirectoryPath({
      nodes: fixture,
      pathSegments: ["blogs", "how-to", "intro"],
      createId: (() => {
        let index = 0;
        const ids = ["new-1", "new-2"];
        return () => ids[index++] ?? `new-${index}`;
      })(),
    });

    expect(next[0]?.children).toEqual([
      { id: "guides", label: "Guides" },
      {
        id: "new-2",
        label: "how-to",
        children: [{ id: "new-1", label: "intro", children: [] }],
      },
    ]);
  });
});
