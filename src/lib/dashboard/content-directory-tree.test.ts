import { describe, expect, it } from "vitest";
import {
  addContentDirectory,
  ensureContentDirectoryPath,
  getContentDirectoryPathIds,
  getContentDirectoryPathSegment,
  materializePersistedContentDirectories,
  mergeContentDirectoryRoots,
  isUniqueContentDirectoryName,
  normalizeContentDirectoryName,
  type ContentDirectoryNode,
  type PersistedContentDirectory,
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

  it("prefers explicit pathSegment over derived label segment", () => {
    expect(
      getContentDirectoryPathSegment({
        id: "node-id",
        label: "Blog Posts",
        pathSegment: "blog",
      }),
    ).toBe("blog");
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

  it("treats URL-segment-equivalent sibling names as duplicates", () => {
    const nodes: ContentDirectoryNode[] = [
      { id: "foo-hyphen", label: "Foo-Bar" },
    ];

    expect(
      isUniqueContentDirectoryName({
        nodes,
        parentId: null,
        name: "Foo Bar",
      }),
    ).toBe(false);
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
        pathSegment: "how-to",
        children: [
          {
            id: "new-1",
            label: "intro",
            pathSegment: "intro",
            children: [],
          },
        ],
      },
    ]);
  });

  it("merges root nodes by normalized path segment without duplicating existing segments", () => {
    const primaryNodes: ContentDirectoryNode[] = [
      {
        id: "ct-blog",
        label: "Blog Posts",
        pathSegment: "blog",
        children: [],
      },
      {
        id: "ct-programs",
        label: "Programs",
        pathSegment: "programs",
        children: [],
      },
    ];

    const secondaryNodes: ContentDirectoryNode[] = [
      {
        id: "legacy-blog-node",
        label: "Blog",
        pathSegment: "blog",
        children: [{ id: "legacy-child", label: "Legacy Child" }],
      },
      {
        id: "custom-manual",
        label: "Custom",
        children: [],
      },
    ];

    expect(
      mergeContentDirectoryRoots({
        primaryNodes,
        secondaryNodes,
      }),
    ).toEqual([
      primaryNodes[0],
      primaryNodes[1],
      secondaryNodes[1],
    ]);
  });

  it("materializes persisted directories under matching parent IDs", () => {
    const baseNodes: ContentDirectoryNode[] = [
      {
        id: "content-type-1",
        label: "Blog",
        pathSegment: "blog",
        children: [],
      },
    ];
    const persisted: PersistedContentDirectory[] = [
      {
        id: "dir-1",
        parentId: null,
        name: "Docs",
        pathSegment: "docs",
      },
      {
        id: "dir-2",
        parentId: "content-type-1",
        name: "Drafts",
        pathSegment: "drafts",
      },
    ];

    expect(
      materializePersistedContentDirectories({
        baseNodes,
        directories: persisted,
      }),
    ).toEqual([
      {
        id: "content-type-1",
        label: "Blog",
        pathSegment: "blog",
        children: [
          {
            id: "dir-2",
            label: "Drafts",
            pathSegment: "drafts",
            children: [],
          },
        ],
      },
      {
        id: "dir-1",
        label: "Docs",
        pathSegment: "docs",
        children: [],
      },
    ]);
  });

  it("falls back orphaned persisted directories to root", () => {
    const persisted: PersistedContentDirectory[] = [
      {
        id: "dir-1",
        parentId: "missing-parent",
        name: "Docs",
        pathSegment: "docs",
      },
    ];

    expect(
      materializePersistedContentDirectories({
        baseNodes: [],
        directories: persisted,
      }),
    ).toEqual([
      {
        id: "dir-1",
        label: "Docs",
        pathSegment: "docs",
        children: [],
      },
    ]);
  });

  it("attaches children even when API order returns child before parent", () => {
    const persisted: PersistedContentDirectory[] = [
      {
        id: "dir-child",
        parentId: "dir-parent",
        name: "Child",
        pathSegment: "child",
      },
      {
        id: "dir-parent",
        parentId: null,
        name: "Parent",
        pathSegment: "parent",
      },
    ];

    expect(
      materializePersistedContentDirectories({
        baseNodes: [],
        directories: persisted,
      }),
    ).toEqual([
      {
        id: "dir-parent",
        label: "Parent",
        pathSegment: "parent",
        children: [
          {
            id: "dir-child",
            label: "Child",
            pathSegment: "child",
            children: [],
          },
        ],
      },
    ]);
  });
});
