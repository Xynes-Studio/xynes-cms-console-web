import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Health API Route", () => {
  it("returns a healthy response payload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual({
      status: "ok",
      service: "xynes-cms-console-web",
    });
  });
});
