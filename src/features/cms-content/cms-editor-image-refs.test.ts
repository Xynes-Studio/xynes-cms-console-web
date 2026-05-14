import { describe, expect, it } from "vitest";
import {
  collectMediaObjectIds,
  stripTransientImageUrls,
} from "./cms-editor-image-refs";

const buildBody = (children: unknown[]): Record<string, unknown> => ({
  root: {
    type: "root",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    children,
  },
});

const imageBlock = (props: Record<string, unknown>) => ({
  type: "image-block",
  version: 1,
  alt: "",
  caption: "",
  ...props,
});

describe("stripTransientImageUrls", () => {
  it("clears src on image-block nodes that have an objectId", () => {
    const body = buildBody([
      imageBlock({
        src: "https://signed.example/object/abc?X-Amz-Signature=DEAD",
        objectId: "obj_abc",
      }),
    ]);
    const out = stripTransientImageUrls(body);
    const children = (
      out as { root: { children: Array<{ src: string; objectId?: string }> } }
    ).root.children;
    expect(children[0].src).toBe("");
    expect(children[0].objectId).toBe("obj_abc");
  });

  it("preserves src on image-block nodes WITHOUT an objectId (back-compat)", () => {
    const body = buildBody([
      imageBlock({ src: "https://cdn.example/legacy.png" }),
    ]);
    const out = stripTransientImageUrls(body);
    const children = (
      out as { root: { children: Array<{ src: string; objectId?: string }> } }
    ).root.children;
    expect(children[0].src).toBe("https://cdn.example/legacy.png");
    expect(children[0].objectId).toBeUndefined();
  });

  it("preserves src when objectId is an empty string", () => {
    const body = buildBody([
      imageBlock({
        src: "https://cdn.example/x.png",
        objectId: "",
      }),
    ]);
    const out = stripTransientImageUrls(body);
    const children = (out as { root: { children: Array<{ src: string }> } })
      .root.children;
    expect(children[0].src).toBe("https://cdn.example/x.png");
  });

  it("preserves non-image-block nodes byte-for-byte", () => {
    const body = buildBody([
      {
        type: "paragraph",
        version: 1,
        children: [{ type: "text", text: "Hello", version: 1 }],
      },
    ]);
    const out = stripTransientImageUrls(body);
    expect(out).toEqual(body);
  });

  it("walks deeply nested children", () => {
    const body = buildBody([
      {
        type: "column-list",
        version: 1,
        children: [
          {
            type: "column",
            version: 1,
            children: [
              imageBlock({
                src: "https://signed.example/inside.jpg",
                objectId: "obj_nested",
              }),
            ],
          },
        ],
      },
    ]);
    const out = stripTransientImageUrls(body);
    const innerSrc = (
      out as {
        root: {
          children: [
            {
              children: [
                {
                  children: [{ src: string; objectId: string }];
                },
              ];
            },
          ];
        };
      }
    ).root.children[0].children[0].children[0].src;
    expect(innerSrc).toBe("");
  });

  it("returns a deep-cloned tree (does not mutate input)", () => {
    const body = buildBody([
      imageBlock({
        src: "https://signed.example/object/abc",
        objectId: "obj_no_mutate",
      }),
    ]);
    const inputJSON = JSON.stringify(body);
    stripTransientImageUrls(body);
    expect(JSON.stringify(body)).toBe(inputJSON);
  });

  it("STORAGE-11 invariant: no signed URL survives when objectId is set", () => {
    const FORBIDDEN_PATTERNS = [
      /X-Amz-Signature=/i,
      /X-Amz-Credential=/i,
      /X-Amz-Security-Token=/i,
      /xynes_live_/i,
      /AKIA[0-9A-Z]+/,
    ];
    const body = buildBody([
      imageBlock({
        src: "https://example.r2.cloudflarestorage.com/bucket/obj?X-Amz-Signature=DEADBEEF&X-Amz-Credential=AKIATESTKEYID",
        objectId: "obj_signed",
      }),
    ]);
    const out = stripTransientImageUrls(body);
    const serialised = JSON.stringify(out);
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(pattern.test(serialised)).toBe(false);
    }
  });

  it("STORAGE-11 invariant: walker never INTRODUCES per-provider config fields", () => {
    // Defense-in-depth: even though the Lumia editor's ImageBlockNode
    // exportJSON only emits known fields, prove the walker itself does
    // not synthesise any provider-config field name into the output.
    // We feed a benign body and assert the resulting JSON does not
    // contain any of the documented banned field names as standalone
    // JSON keys — guarding against a future regression where the
    // normaliser accidentally adds a debug / passthrough field.
    const FORBIDDEN_FIELD_KEYS = [
      '"provider_kind"',
      '"providerKind"',
      '"providerId"',
      '"endpoint"',
      '"region"',
      '"bucket"',
      '"provider_object_key"',
      '"providerObjectKey"',
      '"credential_ref"',
      '"credentialRef"',
      '"accessKeyId"',
      '"secretAccessKey"',
      '"r2Token"',
      '"signedUrl"',
      '"presignedUrl"',
    ];
    const body = buildBody([
      imageBlock({
        src: "https://signed.example/object/abc",
        objectId: "obj_safe",
      }),
    ]);
    const out = stripTransientImageUrls(body);
    const serialised = JSON.stringify(out);
    for (const key of FORBIDDEN_FIELD_KEYS) {
      expect(serialised.includes(key)).toBe(false);
    }
  });

  it("handles null / non-object input by returning it unchanged", () => {
    expect(stripTransientImageUrls(null)).toBeNull();
    expect(stripTransientImageUrls(undefined)).toBeUndefined();
    expect(stripTransientImageUrls("hello")).toBe("hello");
    expect(stripTransientImageUrls(42)).toBe(42);
  });

  it("does not blow up on a hostile cyclic body (bounded depth)", () => {
    // Build a chain depth > MAX_WALK_DEPTH (64) to assert the walker is
    // depth-bounded. We don't actually create a cycle (JSON serialisation
    // would explode) — instead we nest plain records.
    let head: Record<string, unknown> = {
      type: "container",
      version: 1,
      child: imageBlock({
        src: "https://signed.example/deep",
        objectId: "obj_deep",
      }),
    };
    for (let i = 0; i < 100; i++) {
      head = { type: "wrapper", version: 1, inner: head };
    }
    // Must complete and return a plain object — even if deep nodes were
    // not visited.
    expect(() => stripTransientImageUrls({ root: head })).not.toThrow();
  });
});

describe("collectMediaObjectIds", () => {
  it("returns an empty array when there are no image-block nodes", () => {
    const body = buildBody([
      {
        type: "paragraph",
        version: 1,
        children: [{ type: "text", text: "hello", version: 1 }],
      },
    ]);
    expect(collectMediaObjectIds(body)).toEqual([]);
  });

  it("collects every objectId across all image-block nodes", () => {
    const body = buildBody([
      imageBlock({ src: "", objectId: "obj_a" }),
      imageBlock({ src: "", objectId: "obj_b" }),
    ]);
    expect(collectMediaObjectIds(body)).toEqual(["obj_a", "obj_b"]);
  });

  it("skips image-block nodes without an objectId", () => {
    const body = buildBody([
      imageBlock({ src: "https://cdn.example/legacy.png" }),
      imageBlock({ src: "", objectId: "obj_only_this" }),
    ]);
    expect(collectMediaObjectIds(body)).toEqual(["obj_only_this"]);
  });

  it("deduplicates objectIds, preserving first-seen order", () => {
    const body = buildBody([
      imageBlock({ src: "", objectId: "obj_a" }),
      imageBlock({ src: "", objectId: "obj_b" }),
      imageBlock({ src: "", objectId: "obj_a" }),
    ]);
    expect(collectMediaObjectIds(body)).toEqual(["obj_a", "obj_b"]);
  });

  it("walks deeply nested image-block nodes", () => {
    const body = buildBody([
      {
        type: "column",
        version: 1,
        children: [imageBlock({ src: "", objectId: "obj_inside" })],
      },
    ]);
    expect(collectMediaObjectIds(body)).toEqual(["obj_inside"]);
  });

  it("handles non-record / null / undefined input safely", () => {
    expect(collectMediaObjectIds(null)).toEqual([]);
    expect(collectMediaObjectIds(undefined)).toEqual([]);
    expect(collectMediaObjectIds("string")).toEqual([]);
    expect(collectMediaObjectIds(42)).toEqual([]);
  });
});
