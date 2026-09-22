import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalFixtureFlag = process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES;

afterEach(() => {
  if (originalFixtureFlag === undefined) {
    delete process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES;
  } else {
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES = originalFixtureFlag;
  }
});

describe("E2E feature-flag fixture route", () => {
  it("fails closed when browser fixtures are disabled", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES;

    const response = await GET();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a credential-free SDK response only when explicitly enabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES = "1";

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      authenticated: false,
      flags: {},
    });
  });
});
