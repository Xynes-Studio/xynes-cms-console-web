import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { IntegrationHostsFixture } from "../content-integration-hosts/IntegrationHostsFixture";
import Page from "./page";
type Props = ComponentProps<typeof IntegrationHostsFixture>;
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../content-integration-hosts/IntegrationHostsFixture", () => ({
  IntegrationHostsFixture: ({ host, live, folder, legacy }: Props) => (
    <div
      data-testid="host"
      data-host={host}
      data-gateway={live?.gatewayOrigin}
      data-folder={folder}
      data-legacy={String(legacy)}
    />
  ),
}));
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
  fetchSpy.mockResolvedValue(Response.json(state));
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
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("is production-denied even when every fixture switch is enabled", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(fetchSpy).not.toHaveBeenCalled();
});
it.each([
  ["list", "news"],
  ["grid", "empty"],
  ["editor", "moved"],
  ["hostile", "hostile"],
])("uses allowlisted host %s and folder %s only", async (host, folder) => {
  render(
    await Page({
      searchParams: Promise.resolve({ host, folder, entry: "legacy" }),
    }),
  );
  expect(screen.getByTestId("host")).toHaveAttribute(
    "data-host",
    host === "hostile" ? "list" : host,
  );
  expect(screen.getByTestId("host")).toHaveAttribute(
    "data-folder",
    folder === "hostile" ? "news" : folder,
  );
  expect(screen.getByTestId("host")).toHaveAttribute("data-legacy", "true");
  expect(screen.getByTestId("host")).toHaveAttribute(
    "data-gateway",
    "http://127.0.0.1:34901",
  );
  expect(document.body.textContent).not.toContain("fixture-control-secret");
});
it("defaults to the main entry rather than trusting arbitrary entry input", async () => {
  render(await Page({ searchParams: Promise.resolve({ entry: "foreign" }) }));
  expect(screen.getByTestId("host")).toHaveAttribute("data-legacy", "false");
});
it("fails explicitly when the owned state service is unavailable", async () => {
  fetchSpy.mockResolvedValue(new Response("fixture-private", { status: 503 }));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "Isolated fixture state unavailable",
  );
});
it("rejects private fields in fixture metadata", async () => {
  fetchSpy.mockResolvedValue(
    Response.json({ ...state, keyHash: "fixture-private" }),
  );
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow();
});
