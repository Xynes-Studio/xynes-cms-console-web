import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const { getCmsAuthConfigMock } = vi.hoisted(() => ({
  getCmsAuthConfigMock: vi.fn(() => ({
    authAppUrl: "http://localhost:3100",
    appUrl: "http://localhost:3000",
    allowedRedirectDomains: ["localhost:3000", "localhost:3100"],
  })),
}));

vi.mock("./src/lib/auth/config", () => ({
  getCmsAuthConfig: getCmsAuthConfigMock,
}));

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createJwt({
  exp,
  sub = "user-123",
}: {
  exp: number;
  sub?: string;
}): string {
  const header = toBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({ exp, sub }));
  return `${header}.${payload}.signature`;
}

describe("CMS middleware auth protection", () => {
  it("keeps explicit public routes accessible", () => {
    const request = new NextRequest("http://localhost:3000/");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("keeps logout route public for auth-app handoff", () => {
    const request = new NextRequest("http://localhost:3000/logout");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("skips auth redirect for Next.js static internals", () => {
    const request = new NextRequest(
      "http://localhost:3000/_next/static/chunks/app.js"
    );
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("skips auth redirect for API routes", () => {
    const request = new NextRequest("http://localhost:3000/api/health");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("redirects unauthenticated protected routes to auth-app login", () => {
    const request = new NextRequest("http://localhost:3000/acme/content");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent"
    );
  });

  it("rejects protected routes when auth cookie is forged", () => {
    const request = {
      nextUrl: new URL("http://localhost:3000/acme/content"),
      cookies: {
        getAll: () => [{ name: "sb-auth-token", value: "abc123" }],
      },
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = middleware(request);

    expect(response.status).toBe(307);
  });

  it("allows protected routes when Supabase auth cookie contains a valid JWT", () => {
    const validToken = createJwt({
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const request = {
      nextUrl: new URL("http://localhost:3000/acme/content"),
      cookies: {
        getAll: () => [
          {
            name: "sb-local-auth-token",
            value: JSON.stringify([validToken, "refresh-token"]),
          },
        ],
      },
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
