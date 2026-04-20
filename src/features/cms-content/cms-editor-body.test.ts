import { describe, expect, it } from "vitest";
import {
  createEmptyLumiaDocument,
  normalizeEditorBody,
  hasEditorDraftChanged,
} from "./cms-editor-body";

describe("normalizeEditorBody", () => {
  it("returns an empty Lumia document when body is null", () => {
    expect(normalizeEditorBody(null)).toEqual(createEmptyLumiaDocument());
  });

  it("returns an empty Lumia document when body is empty", () => {
    expect(normalizeEditorBody("")).toEqual(createEmptyLumiaDocument());
  });

  it("returns an empty Lumia document when body is malformed", () => {
    expect(normalizeEditorBody({ bad: true })).toEqual(
      createEmptyLumiaDocument(),
    );
  });

  it("returns an empty Lumia document when body is incompatible", () => {
    expect(
      normalizeEditorBody({
        root: {
          children: {},
        },
      }),
    ).toEqual(createEmptyLumiaDocument());
  });

  it("returns an empty Lumia document when body contains non-finite numbers", () => {
    expect(
      normalizeEditorBody({
        root: {
          type: "root",
          version: Number.NaN,
          direction: "ltr",
          format: "",
          indent: 0,
          children: [],
        },
      }),
    ).toEqual(createEmptyLumiaDocument());

    expect(
      normalizeEditorBody({
        root: {
          type: "root",
          version: Number.POSITIVE_INFINITY,
          direction: "ltr",
          format: "",
          indent: 0,
          children: [],
        },
      }),
    ).toEqual(createEmptyLumiaDocument());
  });

  it("returns an empty Lumia document when body contains unsafe nested values", () => {
    const value: Record<string, unknown> = {
      root: {
        type: "root",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        children: [],
      },
    };
    value.root = {
      ...(value.root as Record<string, unknown>),
      children: [value],
    };

    expect(normalizeEditorBody(value)).toEqual(createEmptyLumiaDocument());
  });

  it("preserves acyclic bodies with repeated shared references", () => {
    const sharedParagraph = {
      type: "paragraph",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: [
        {
          type: "text",
          text: "Shared",
          version: 1,
          detail: 0,
          format: 0,
          mode: "normal",
          style: "",
        },
      ],
    };

    const value = {
      root: {
        type: "root",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        children: [sharedParagraph, sharedParagraph],
      },
    };

    expect(normalizeEditorBody(value)).toEqual(value);
  });

  it("preserves valid Lumia editor JSON", () => {
    const value = createEmptyLumiaDocument();
    expect(normalizeEditorBody(value)).toEqual(value);
  });
});

describe("hasEditorDraftChanged", () => {
  it("detects changes in body JSON", () => {
    const before = {
      title: "A",
      description: "",
      tags: "",
      body: createEmptyLumiaDocument(),
    };
    const after = {
      ...before,
      body: {
        root: {
          ...before.body.root,
          children: [
            {
              type: "paragraph",
              version: 1,
              direction: null,
              format: "",
              indent: 0,
              children: [
                {
                  type: "text",
                  text: "Hello",
                  version: 1,
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                },
              ],
            },
          ],
        },
      },
    };

    expect(hasEditorDraftChanged(before, after)).toBe(true);
  });

  it("treats comma-containing tags as distinct values", () => {
    const before = {
      title: "A",
      description: "",
      tags: ["a,b", "c"],
      body: createEmptyLumiaDocument(),
    };
    const after = {
      ...before,
      tags: ["a", "b,c"],
    };

    expect(hasEditorDraftChanged(before, after)).toBe(true);
  });

  it("does not throw when body contains unsafe nested values", () => {
    const circularBody: Record<string, unknown> = {
      root: {
        type: "root",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        children: [],
      },
    };
    (circularBody.root as Record<string, unknown>).children = [circularBody];

    const before = {
      title: "A",
      description: "",
      tags: [],
      body: circularBody,
    };
    const after = {
      ...before,
      body: createEmptyLumiaDocument(),
    };

    expect(() => hasEditorDraftChanged(before, after)).not.toThrow();
    expect(hasEditorDraftChanged(before, after)).toBe(false);
  });
});
