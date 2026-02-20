import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { getCmsAuthConfigMock } = vi.hoisted(() => ({
  getCmsAuthConfigMock: vi.fn(() => ({
    authAppUrl: "http://localhost:3100",
    appUrl: "http://localhost:3000",
    allowedRedirectDomains: ["localhost:3000", "localhost:3100"],
  })),
}));

vi.mock("../../src/lib/auth/config", () => ({
  getCmsAuthConfig: getCmsAuthConfigMock,
}));

describe("CMS logout route", () => {
  it("delegates logout to auth-app and preserves a safe return URL", async () => {
    const request = new Request(
      "http://localhost:3000/logout?redirect=%2Facme%2Fcontent%3Ftab%3Ddrafts"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent%3Ftab%3Ddrafts"
    );
  });

  it("falls back to CMS root when return URL is unsafe", async () => {
    const request = new Request(
      "http://localhost:3000/logout?redirect=https%3A%2F%2Fevil.example%2Fsteal"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
    );
  });

  it("uses request origin as app URL when config appUrl is not set", async () => {
    getCmsAuthConfigMock.mockReturnValueOnce({
      authAppUrl: "http://localhost:3100",
      appUrl: undefined,
      allowedRedirectDomains: ["localhost:3000", "localhost:3100"],
    });

    const request = new Request(
      "http://localhost:3000/logout?redirect=%2Facme%2Fcontent"
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent"
    );
  });

  it("supports POST logout handoff with the same redirect contract", async () => {
    const request = new Request(
      "http://localhost:3000/logout?redirect=%2Facme%2Fcontent",
      {
        method: "POST",
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent"
    );
  });
});
