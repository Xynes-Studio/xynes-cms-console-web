import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../../messages/en-US/cms.content-integrations.json";
import xa from "../../../messages/en-XA/cms.content-integrations.json";
import metadata from "../../../messages.meta/cms.content-integrations.json";
import { getCmsMessages } from "../../i18n/config";
function leaves(value: unknown, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "string") result.set(prefix, value);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      for (const entry of leaves(child, prefix ? `${prefix}.${key}` : key))
        result.set(...entry);
    }
  }
  return result;
}
describe("integration catalogs", () => {
  it("uses the API access copy deck with a linear key/copy/publish flow", () => {
    const copy = leaves(en);
    expect(copy.get("trigger")).toBe("Use via API");
    expect(copy.get("title")).toBe('Use "{title}" via API');
    expect(copy.get("editor.tab")).toBe("API");
    expect(copy.get("steps.keyTitle")).toBe("Get a read-only key");
    expect(copy.get("steps.copyTitle")).toBe("Copy the request");
    expect(copy.get("steps.publishAction")).toBe("Publish from the editor");
    expect(copy.get("options.search")).toBe("Title or description contains");
    expect(copy.get("status.folder")).toBe(
      "Returns published entries in this folder. Drafts and subfolders aren't included. If you moved an entry here, republish it to include it.",
    );
    expect(copy.get("steps.copyHelper")).toContain("$XYNES_API_KEY");
    expect(copy.get("roadmap")).toBe("JavaScript SDK and scripts are coming soon.");
  });
  it("keeps internal delivery jargon and the root-folder helper out of all copy", () => {
    for (const text of leaves(en).values()) {
      expect(text).not.toMatch(/snapshot|validated|legacy content|delivery state|integrations|open a folder first/i);
    }
  });
  it("documents every ICU placeholder used by the new copy", () => {
    const documented = new Map(Object.entries(metadata.placeholders));
    for (const [key, text] of leaves(en)) {
      const placeholders = [...text.matchAll(/\{([A-Za-z][\w]*)(?:[,}])/g)].map(match => match[1]);
      if (placeholders.length) expect(documented.get(key)).toEqual([...new Set(placeholders)]);
    }
  });
  it("renders the URL header requirement as plain text without an ICU tag error", () => {
    const onError = vi.fn();
    const t = createTranslator({ locale: "en-US", messages: en, onError });
    expect(t("steps.urlHeader")).toBe(
      "Send it with the header Authorization: Bearer <your key>.",
    );
    expect(onError).not.toHaveBeenCalled();
  });
  it("keeps protocol identifiers readable in the generated pseudo locale", () => {
    const copy = leaves(xa);
    expect(copy.get("steps.copyHelper") ?? "").toContain("$XYNES_API_KEY");
    expect(copy.get("steps.urlHeader") ?? "").toContain("Authorization: Bearer");
    expect(copy.get("preview.pagination") ?? "").toContain("page.hasMore");
  });
  it("keeps pseudo keys and ICU placeholders identical", () => {
    const english = leaves(en),
      pseudo = leaves(xa);
    expect([...pseudo.keys()]).toEqual([...english.keys()]);
    for (const [key, text] of english) {
      const translation = pseudo.get(key);
      expect(translation).toMatch(/^\[/);
      expect(translation?.match(/\{[^}]+\}/g) ?? []).toEqual(
        text.match(/\{[^}]+\}/g) ?? [],
      );
      expect(text).not.toMatch(/<script|xynes_live_|https?:\/\//);
    }
  });
  it("registers only static allowlisted locale catalogs and metadata", () => {
    expect(getCmsMessages("en-US").cms.contentIntegrations).toBe(en);
    expect(getCmsMessages("en-XA").cms.contentIntegrations).toBe(xa);
    expect(getCmsMessages("../../private").cms.contentIntegrations).toBe(en);
    expect(metadata.namespace).toBe("cms.contentIntegrations");
    expect(metadata.placeholders["bounds.limit"]).toEqual(["min", "max"]);
  });
});
