import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCmsHealthStatus } from "./health";
import { GET } from "./route";

vi.mock("./health", () => ({
  getCmsHealthStatus: vi.fn(),
}));

describe("Health API Route", () => {
  beforeEach(() => {
    vi.mocked(getCmsHealthStatus).mockReset();
  });

  it("returns the healthy JSON contract with no-store caching", async () => {
    vi.mocked(getCmsHealthStatus).mockResolvedValue({
      status: 200,
      body: {
        ok: true,
        service: "xynes-cms-console-web",
        version: "sha-1234567",
        uptime_seconds: 9,
        checks: { gateway: "ok" },
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      service: "xynes-cms-console-web",
      version: "sha-1234567",
      uptime_seconds: 9,
      checks: { gateway: "ok" },
    });
  });

  it("returns 503 with the same closed schema when degraded", async () => {
    vi.mocked(getCmsHealthStatus).mockResolvedValue({
      status: 503,
      body: {
        ok: false,
        service: "xynes-cms-console-web",
        version: "sha-1234567",
        uptime_seconds: 10,
        checks: { gateway: "fail" },
      },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      service: "xynes-cms-console-web",
      version: "sha-1234567",
      uptime_seconds: 10,
      checks: { gateway: "fail" },
    });
  });
});
