import { describe, expect, it } from "vitest";
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
