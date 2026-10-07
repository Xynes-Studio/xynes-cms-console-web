import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readIntegrationFixture,
  fixtureControlUrl,
  parseFixtureMutation,
} from "./cms-integration-fixture";
const publicContext = {
  gatewayOrigin: "http://127.0.0.1:34901",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  directoryId: "22222222-2222-4222-8222-222222222222",
  emptyDirectoryId: "44444444-4444-4444-8444-444444444444",
  movedDirectoryId: "55555555-5555-4555-8555-555555555555",
  entryId: "33333333-3333-4333-8333-333333333333",
  legacyEntryId: "66666666-6666-4666-8666-666666666666",
  childEntryId: "77777777-7777-4777-8777-777777777777",
  foreignWorkspaceId: "88888888-8888-4888-8888-888888888888",
  foreignEntryId: "99999999-9999-4999-8999-999999999999",
};
afterEach(() => vi.unstubAllEnvs());
function enable() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_E2E_FIXTURES", "1");
  vi.stubEnv("RUN_CMS_INTEGRATIONS_BROWSER", "1");
  vi.stubEnv("CMS_INTEGRATIONS_FIXTURE_CONTEXT", JSON.stringify(publicContext));
}
describe("isolated integration fixture boundary", () => {
  it("accepts only explicit development fixture context", () => {
    enable();
    expect(readIntegrationFixture()).toEqual(publicContext);
  });
  it.each(["production", "development"])(
    "denies %s without every opt-in",
    (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      expect(readIntegrationFixture()).toBeNull();
      enable();
      vi.stubEnv("NODE_ENV", "production");
      expect(readIntegrationFixture()).toBeNull();
    },
  );
  it.each(["NEXT_PUBLIC_ENABLE_E2E_FIXTURES", "RUN_CMS_INTEGRATIONS_BROWSER"])(
    "requires %s",
    (name) => {
      enable();
      vi.stubEnv(name, "0");
      expect(readIntegrationFixture()).toBeNull();
    },
  );
  it.each([
    "",
    "{}",
    "bad",
    "x".repeat(8193),
    JSON.stringify({
      ...publicContext,
      gatewayOrigin: "https://api.xynes.com",
    }),
    JSON.stringify({
      ...publicContext,
      gatewayOrigin: "http://127.0.0.1:34901/path",
    }),
    JSON.stringify({ ...publicContext, rawKey: "fixture-private" }),
    JSON.stringify({ ...publicContext, entryId: "bad" }),
  ])("fails closed on malformed public context", (value) => {
    enable();
    vi.stubEnv("CMS_INTEGRATIONS_FIXTURE_CONTEXT", value);
    expect(() => readIntegrationFixture()).toThrow(
      "Invalid isolated integration fixture",
    );
  });
  it("accepts only a loopback control origin and never includes the token in its URL", () => {
    enable();
    vi.stubEnv(
      "CMS_INTEGRATIONS_FIXTURE_CONTROL_ORIGIN",
      "http://127.0.0.1:34902",
    );
    expect(fixtureControlUrl()).toBe("http://127.0.0.1:34902/control");
  });
  it.each([
    "",
    "https://remote.invalid",
    "http://remote.invalid:34901",
    "http://127.0.0.1",
    "http://user:secret@127.0.0.1:3000",
    "http://127.0.0.1:3000/?token=private",
    "http://127.0.0.1:3000/#private",
  ])("rejects unsafe control origins", (origin) => {
    enable();
    vi.stubEnv("CMS_INTEGRATIONS_FIXTURE_CONTROL_ORIGIN", origin);
    expect(() => fixtureControlUrl()).toThrow();
  });
  it("refuses control URL resolution without the opt-in", () => {
    expect(() => fixtureControlUrl()).toThrow();
  });
  it("accepts bounded save data and status commands", () => {
    expect(
      parseFixtureMutation({
        action: "save",
        title: "B",
        body: { root: { children: [] } },
      }),
    ).toMatchObject({ action: "save", title: "B" });
    for (const action of [
      "publish",
      "archive",
      "unpublish",
      "move",
      "legacyRepublish",
    ])
      expect(parseFixtureMutation({ action })).toEqual({ action });
  });
  it.each([
    undefined,
    { action: "deleteAll" },
    { action: "publish", workspaceId: publicContext.foreignWorkspaceId },
    { action: "save", title: "" },
    { action: "save", title: "x".repeat(201) },
    { action: "save", title: "B", body: { value: "x".repeat(1048576) } },
  ])("rejects broad or invalid control commands", (payload) => {
    expect(() => parseFixtureMutation(payload)).toThrow();
  });
});
