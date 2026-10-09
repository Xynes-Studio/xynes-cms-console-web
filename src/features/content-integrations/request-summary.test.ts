import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en-US/cms.content-integrations.json";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import type { IntegrationControls } from "./useContentIntegration";
import { summarizeOptions } from "./request-summary";

const t = createTranslator({ locale: "en-US", messages: en });
const controls: IntegrationControls = {
  sortBy: "publishedAt",
  sortDirection: "desc",
  limit: "20",
  offset: "0",
  search: "",
  fields: DELIVERY_CONTRACT.operations.directory.fields,
};
describe("request option summary", () => {
  it.each([
    ["publishedAt", "desc", "Newest first"],
    ["publishedAt", "asc", "Oldest first"],
    ["title", "asc", "Title A–Z"],
    ["title", "desc", "Title Z–A"],
  ] as const)(
    "summarizes %s/%s with the contract's selected fields",
    (sortBy, sortDirection, sort) => {
      expect(
        summarizeOptions(
          { ...controls, sortBy, sortDirection },
          "directory",
          t,
        ),
      ).toBe(`20 items · ${sort} · 5 fields`);
    },
  );
  it("normalizes numeric text and trimmed search to match request parameters", () => {
    expect(
      summarizeOptions(
        { ...controls, limit: "020", offset: "003", search: "  launch  " },
        "directory",
        t,
      ),
    ).toBe(
      '20 items · Newest first · 5 fields · skip 3 · title contains "launch"',
    );
  });
  it("omits blank search and zero skip and always counts ID", () => {
    expect(
      summarizeOptions(
        { ...controls, fields: [], offset: "00", search: "   " },
        "directory",
        t,
      ),
    ).toBe("20 items · Newest first · 1 field");
  });
  it("uses singular wording for a one-item page", () => {
    expect(
      summarizeOptions(
        { ...controls, limit: "1", fields: ["id"] },
        "directory",
        t,
      ),
    ).toBe("1 item · Newest first · 1 field");
  });
  it("uses all six entry fields without directory options", () => {
    expect(
      summarizeOptions(
        {
          ...controls,
          fields: DELIVERY_CONTRACT.operations.entry.fields,
          search: "ignored",
          offset: "50",
        },
        "entry",
        t,
      ),
    ).toBe("6 of 6 fields");
  });
  it("counts normalized entry selections without duplicate ID", () => {
    expect(
      summarizeOptions(
        { ...controls, fields: ["title", "title", "id"] },
        "entry",
        t,
      ),
    ).toBe("2 of 6 fields");
  });
  it("does not expose NaN while an incomplete numeric field is being corrected", () => {
    expect(summarizeOptions({ ...controls, limit: "" }, "directory", t)).toBe(
      "— items · Newest first · 5 fields",
    );
  });
});
