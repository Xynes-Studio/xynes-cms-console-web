import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const originalEnv = { ...process.env };

function setLogoutEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env.NEXT_PUBLIC_AUTH_APP_URL =
    overrides.NEXT_PUBLIC_AUTH_APP_URL ?? "http://localhost:3100";
  process.env.NEXT_PUBLIC_APP_URL =
    overrides.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS =
    overrides.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS ??
    "localhost:3000,localhost:3100";
}

describe("CMS logout route", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("delegates logout to auth-app and preserves a safe return URL", async () => {
    setLogoutEnv();
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
    setLogoutEnv();
    const request = new Request(
      "http://localhost:3000/logout?redirect=https%3A%2F%2Fevil.example%2Fsteal"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
    );
  });

  it("uses configured app URL for redirect normalization", async () => {
    setLogoutEnv();
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
    setLogoutEnv();
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

  it("fails closed when auth-app URL env is missing", async () => {
    setLogoutEnv({ NEXT_PUBLIC_AUTH_APP_URL: "" });

    const request = new Request("http://localhost:3000/logout");

    await expect(GET(request)).rejects.toThrow(
      "Missing required env: NEXT_PUBLIC_AUTH_APP_URL"
    );
  });

  it("fails closed when app URL env is missing", async () => {
    setLogoutEnv({ NEXT_PUBLIC_APP_URL: "" });

    const request = new Request("http://localhost:3000/logout");

    await expect(GET(request)).rejects.toThrow(
      "Missing required env: NEXT_PUBLIC_APP_URL"
    );
  });
});
