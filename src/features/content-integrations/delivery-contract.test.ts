import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import mirror from "./fixtures/cms-delivery.v1.json";
import metadata from "./fixtures/cms-delivery.v1.source.json";
import {
  DELIVERY_CONTRACT,
  parseDeliveryContract,
  buildExampleResponse,
  getResponseFields,
} from "./delivery-contract";
import { buildIntegrationRequest } from "./build-request";
const entryContext = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workspaceSlug: "fixture",
  apiBaseUrl: "https://api.example.com",
  target: {
    kind: "entry",
    entryId: "33333333-3333-4333-8333-333333333333",
    label: "Draft must never become sample data",
  },
};
describe("generated delivery metadata and examples", () => {
  it("matches the generated fixture and pinned digest/version metadata", () => {
    expect(DELIVERY_CONTRACT).toEqual(mirror);
    expect(metadata.version).toBe(mirror.version);
    expect(metadata.revision).toMatch(/^[a-f0-9]{40}$/);
    const bytes = readFileSync("src/features/content-integrations/fixtures/cms-delivery.v1.json");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(metadata.sha256);
    expect(Object.isFrozen(DELIVERY_CONTRACT.operations.directory.fields)).toBe(true);
    expect(parseDeliveryContract(mirror).success).toBe(true);
  });
  it("rejects malformed or unsupported contract metadata", () => {
    for (const input of [
      null,
      {},
      { ...mirror, version: 2 },
      { ...mirror, extra: true },
      { ...mirror, requiredField: "body" },
      {
        ...mirror,
        operations: {
          ...mirror.operations,
          directory: {
            ...mirror.operations.directory,
            fields: ["id", "id", "description", "tags", "publishedAt"],
          },
        },
      },
    ])
      expect(parseDeliveryContract(input).success).toBe(false);
  });
  it("projects static detail examples and field definitions without editor data", () => {
    const result = buildIntegrationRequest(entryContext, { fields: ["body", "title"] });
    if (!result.ok) throw new Error("Expected request");
    const example = buildExampleResponse(result.request);
    expect(example.kind).toBe("static-example");
    expect(example.response).toMatchObject({
      ok: true,
      data: {
        entry: { id: expect.any(String), title: expect.any(String), body: expect.anything() },
      },
    });
    if (!("entry" in example.response.data)) throw new Error("Expected detail");
    expect(Object.keys(example.response.data.entry)).toEqual(["id", "title", "body"]);
    expect(JSON.stringify(example)).not.toContain("Draft must never");
    expect(getResponseFields(result.request).map((field) => field.name)).toEqual([
      "id",
      "title",
      "body",
    ]);
  });
  it("projects only allowed list fields and respects the requested page size", () => {
    const result = buildIntegrationRequest(
      {
        ...entryContext,
        target: {
          kind: "directory",
          directoryId: entryContext.target.entryId,
          label: "Folder",
          breadcrumb: "Contents",
        },
      },
      { fields: ["tags"], limit: 1, offset: 2 },
    );
    if (!result.ok) throw new Error("Expected request");
    const example = buildExampleResponse(result.request);
    if (!("items" in example.response.data)) throw new Error("Expected list");
    expect(example.response.data.items).toHaveLength(1);
    expect(Object.keys(example.response.data.items[0])).toEqual(["id", "tags"]);
    expect(example.response.data.page).toEqual({ limit: 1, offset: 2, hasMore: false });
  });
});
