import { describe, expect, it, vi } from "vitest";
import { getWorkspaceContentEntryById } from "./content-entries-client";
const base = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  directoryId: null,
  title: "First story",
  description: "",
  body: null,
  tags: [],
  status: "published",
  publishedAt: "2026-10-01T00:00:00Z",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  collaborators: [],
  isFavorite: false,
};
async function read(extra: object) {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { entry: { ...base, ...extra } } }),
        { status: 200 },
      ),
    );
  return getWorkspaceContentEntryById({
    apiBaseUrl: "https://api.xynes.com",
    workspaceId: base.workspaceId,
    entryId: base.id,
    accessToken: "fixture-token",
    fetchImpl,
  });
}
describe("optional entry delivery metadata", () => {
  it.each(["available", "unpublished", "republish_required"])(
    "preserves %s",
    async (deliveryState) => {
      expect((await read({ deliveryState })).deliveryState).toBe(deliveryState);
    },
  );
  it.each([null, 42, {}, "future_state"])(
    "maps malformed or future states to unknown",
    async (deliveryState) => {
      expect((await read({ deliveryState })).deliveryState).toBe("unknown");
    },
  );
  it("preserves old response compatibility when metadata is absent", async () => {
    expect(await read({})).not.toHaveProperty("deliveryState");
  });
});
