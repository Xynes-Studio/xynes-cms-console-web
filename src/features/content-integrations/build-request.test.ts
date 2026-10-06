import { describe, expect, it, vi } from "vitest";
import { buildIntegrationRequest } from "./build-request";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const directoryId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";
const context = {
  workspaceId,
  workspaceSlug: "fixture",
  apiBaseUrl: "https://api.erp.xynes.in/api/v1/",
  target: { kind: "directory", directoryId, label: "News", breadcrumb: "Contents / News" },
};
const entryContext = { ...context, target: { kind: "entry", entryId, label: "Article" } };
function success(input: unknown = context, options: unknown = {}) {
  const result = buildIntegrationRequest(input, options);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected request");
  return result.request;
}

describe("metadata-backed integration requests", () => {
  it("preserves gateway prefix and emits the frozen directory defaults", () => {
    const request = success();
    const url = new URL(request.url);
    expect(url.pathname).toBe(`/api/v1/workspaces/${workspaceId}/delivery/entries`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      directoryId,
      sortBy: "publishedAt",
      sortDirection: "desc",
      limit: "20",
      offset: "0",
      fields: "id,title,description,tags,publishedAt",
    });
    expect(request.method).toBe("GET");
    expect(request.headers).toEqual({ Authorization: "Bearer ${XYNES_API_KEY}" });
    expect(request.contextKey).toBe(`${workspaceId}:directory:${directoryId}`);
  });
  it("builds entry reads without list-only controls", () => {
    const result = buildIntegrationRequest(entryContext, { fields: ["body", "title"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new URL(result.request.url).pathname).toBe(
      `/api/v1/workspaces/${workspaceId}/delivery/entries/${entryId}`,
    );
    expect(new URL(result.request.url).search).toBe("?fields=id%2Ctitle%2Cbody");
    expect(result.request.fields).toEqual(["id", "title", "body"]);
  });
  it("encodes text once, keeps numeric-looking searches as strings and includes ID", () => {
    for (const search of ["123", "true", "O'Reilly & café / ? #", "a\nline"]) {
      const request = success(context, {
        search,
        fields: ["title"],
        limit: 1,
        offset: 10000,
        sortBy: "title",
        sortDirection: "asc",
      });
      const url = new URL(request.url);
      expect(url.searchParams.get("search")).toBe(search);
      expect(url.searchParams.get("fields")).toBe("id,title");
      expect(url.searchParams.getAll("search")).toHaveLength(1);
    }
    expect(success(context, { fields: [] }).fields).toEqual(["id"]);
  });
  it("is deterministic, immutable and independent of labels/publication UI state", () => {
    const original = structuredClone(context);
    const options = { fields: ["tags", "title"], limit: 2 };
    const request = success(context, options);
    expect(
      success({
        ...context,
        target: { ...context.target, label: "'\n$(evil) <script>", breadcrumb: "different" },
        publicationState: "draft",
      }),
    ).toEqual(success());
    expect(request).toEqual(success(context, options));
    expect(context).toEqual(original);
    expect(options).toEqual({ fields: ["tags", "title"], limit: 2 });
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.fields)).toBe(true);
    expect(Object.isFrozen(request.headers)).toBe(true);
  });
  it("never fetches or writes browser storage", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const store = vi.spyOn(Storage.prototype, "setItem");
    success();
    expect(fetch).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    fetch.mockRestore();
    store.mockRestore();
  });
  for (const options of [
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: "2" },
    { limit: NaN },
    { limit: Infinity },
    { offset: -1 },
    { offset: 10001 },
    { offset: "0" },
    { offset: 1.5 },
    { search: "" },
    { search: " " },
    { search: "x".repeat(201) },
    { search: true },
    { fields: ["body"] },
    { fields: ["id", "id"] },
    { fields: ["unknown"] },
    { fields: "id,title" },
    { sortBy: "popular" },
    { sortDirection: "up" },
    { status: "draft" },
    { preview: true },
    { workspaceId: entryId },
    { constructor: "unsafe" },
    JSON.parse('{"__proto__":"unsafe"}'),
    Object.create({ limit: 10 }),
  ])
    it(`fails closed on invalid directory options ${JSON.stringify(options)}`, () => {
      expect(buildIntegrationRequest(context, options)).toEqual({
        ok: false,
        error: { code: "INVALID_OPTIONS" },
      });
    });
  for (const options of [
    { limit: 1 },
    { offset: 0 },
    { sortBy: "title" },
    { search: "test" },
    { fields: ["body", "body"] },
  ])
    it(`rejects inappropriate entry controls ${JSON.stringify(options)}`, () => {
      expect(buildIntegrationRequest(entryContext, options).ok).toBe(false);
    });
  for (const input of [
    null,
    {},
    { ...context, workspaceId: "slug" },
    { ...context, workspaceSlug: "" },
    { ...context, target: { kind: "other" } },
    { ...context, target: { kind: "directory", directoryId: "", label: "News", breadcrumb: "" } },
    { ...context, apiKey: "must-not-echo" },
    Object.create(context),
    { ...context, target: Object.create(context.target) },
  ])
    it("rejects missing/hostile context without returning its values", () => {
      const result = buildIntegrationRequest(input);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("must-not-echo");
    });
  for (const origin of [
    "",
    "not a URL",
    "javascript:alert(1)",
    "ftp://api.example.com",
    "http://api.example.com",
    "https://user:secret@api.example.com",
    "https://api.example.com?token=secret",
    "https://api.example.com#fragment",
    "https://api.example.com?",
    "https://api.example.com#",
    "https://cms-core:4202",
    "http://host.docker.internal:4100",
    "https://gateway.internal",
    "https://service.local",
    "https://10.1.2.3",
    "https://172.16.0.1",
    "https://192.168.1.2",
    "https://169.254.169.254",
    "https://0.0.0.0",
    "https://100.64.1.2",
    "https://224.0.0.1",
    "https://[fc00::1]",
    "https://[fe80::1]",
    "https://[::]",
    "https://[::ffff:192.168.1.1]",
    "https://[::192.168.1.1]",
    "https://[fec0::1]",
    "https://[64:ff9b::a00:1]",
    "https://@api.example.com",
    "http://127.1:4100",
    "http://2130706433:4100",
    "http://0x7f000001:4100",
    "http://localhost.:4100",
    " https://api.example.com",
    "https://api.exa\nmple.com",
  ])
    it(`rejects unsafe gateway configuration ${origin}`, () => {
      expect(buildIntegrationRequest({ ...context, apiBaseUrl: origin })).toEqual({
        ok: false,
        error: { code: "INVALID_API_BASE_URL" },
      });
    });
  for (const origin of [
    "http://localhost:4100",
    "http://127.0.0.1:4100/api",
    "http://[::1]:4100",
    "https://api.erp.xynes.com",
    "https://api.erp.xynes.in",
    "https://gateway.customer.example.com",
    "https://84.247.176.134",
    "https://[2606:4700::1111]",
  ])
    it(`accepts a configured public or documented loopback gateway ${origin}`, () => {
      expect(buildIntegrationRequest({ ...context, apiBaseUrl: origin }).ok).toBe(true);
    });
});
