import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const state = {
  deliveryState: "available",
  title: "A",
  status: "published",
  directoryId: id,
  publishedAt: null,
  updatedAt: "2026-10-07T00:00:00Z",
  body: {
    root: {
      children: [],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
};
const fetchSpy = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockReset();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RUN_CMS_INTEGRATIONS_BROWSER", "1");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_E2E_FIXTURES", "1");
  vi.stubEnv(
    "CMS_INTEGRATIONS_FIXTURE_CONTEXT",
    JSON.stringify({
      gatewayOrigin: "http://127.0.0.1:34901",
      workspaceId: id,
      directoryId: id,
      emptyDirectoryId: id,
      movedDirectoryId: id,
      entryId: id,
      legacyEntryId: id,
      childEntryId: id,
      foreignWorkspaceId: id,
      foreignEntryId: id,
    }),
  );
  vi.stubEnv(
    "CMS_INTEGRATIONS_FIXTURE_CONTROL_ORIGIN",
    "http://127.0.0.1:34902",
  );
  vi.stubEnv(
    "CMS_INTEGRATIONS_FIXTURE_CONTROL_TOKEN",
    "fixture-control-secret",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function request(body: string) {
  return new Request("http://localhost/api/e2e/cms-integrations", {
    method: "POST",
    body,
  });
}
it("denies production even with all fixture switches enabled", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await POST(request('{"action":"publish"}'))).status).toBe(404);
  expect(fetchSpy).not.toHaveBeenCalled();
});
it("forwards only bounded fixture mutations and returns an allowlisted state", async () => {
  fetchSpy.mockResolvedValue(Response.json(state));
  const result = await POST(request('{"action":"save","title":"B"}'));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual(state);
  expect(fetchSpy).toHaveBeenCalledWith(
    "http://127.0.0.1:34902/control",
    expect.objectContaining({
      headers: {
        Authorization: "Bearer fixture-control-secret",
        "Content-Type": "application/json",
      },
      body: '{"action":"save","title":"B"}',
    }),
  );
});
it.each([
  "bad",
  '{"action":"execute","url":"https://remote.invalid"}',
  '{"action":"publish","workspaceId":"foreign"}',
])("rejects broad or malformed commands before network I/O", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();
});
it("rejects oversized commands before network I/O", async () => {
  expect((await POST(request("x".repeat(1048577)))).status).toBe(413);
  expect(fetchSpy).not.toHaveBeenCalled();
});
it("maps upstream rejection without exposing its body", async () => {
  fetchSpy.mockResolvedValue(new Response("fixture-private", { status: 403 }));
  const result = await POST(request('{"action":"publish"}'));
  expect(result.status).toBe(502);
  expect(await result.text()).toBe("");
});
it("rejects hostile upstream state fields", async () => {
  fetchSpy.mockResolvedValue(
    Response.json({ ...state, rawKey: "fixture-private" }),
  );
  const result = await POST(request('{"action":"publish"}'));
  expect(result.status).toBe(400);
  expect(await result.text()).toBe("");
});
it("handles network errors without exposing exception text", async () => {
  fetchSpy.mockRejectedValue(new Error("fixture-private"));
  expect((await POST(request('{"action":"publish"}'))).status).toBe(400);
});
