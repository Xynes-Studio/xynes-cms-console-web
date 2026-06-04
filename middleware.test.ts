import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const originalEnv = { ...process.env };

function setMiddlewareEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env.NEXT_PUBLIC_AUTH_APP_URL =
    overrides.NEXT_PUBLIC_AUTH_APP_URL ?? "http://localhost:3100";
  process.env.NEXT_PUBLIC_APP_URL =
    overrides.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS =
    overrides.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS ??
    "localhost:3000,localhost:3100";
  process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES =
    overrides.NEXT_PUBLIC_ENABLE_E2E_FIXTURES ?? "0";
}

function toBase64Url(value: string): string {
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("keeps explicit public routes accessible", () => {
    setMiddlewareEnv();
    const request = new NextRequest("http://localhost:3000/");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("keeps logout route public for auth-app handoff", () => {
    setMiddlewareEnv();
    const request = new NextRequest("http://localhost:3000/logout");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("keeps /SECURITY.md public for anonymous landing-page visitors (LP-CMS)", () => {
    // The LP-CMS landing page links to /SECURITY.md from the trust strip
    // and footer. Anonymous visitors MUST be able to read it without being
    // bounced to login. The `public/SECURITY.md` file is served by Next.js
    // static-file middleware AFTER this custom middleware, so we have to
    // mark the path public here.
    setMiddlewareEnv();
    const request = new NextRequest("http://localhost:3000/SECURITY.md");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("skips auth redirect for Next.js static internals", () => {
    setMiddlewareEnv();
    const request = new NextRequest(
      "http://localhost:3000/_next/static/chunks/app.js",
    );
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("skips auth redirect for API routes", () => {
    setMiddlewareEnv();
    const request = new NextRequest("http://localhost:3000/api/health");
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("protects local e2e fixture routes by default", () => {
    setMiddlewareEnv();
    const request = new NextRequest(
      "http://localhost:3000/e2e/cms-dashboard-scroll",
    );
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Fe2e%2Fcms-dashboard-scroll",
    );
  });

  it("keeps local e2e fixture routes public only when the test fixture flag is enabled", () => {
    setMiddlewareEnv({ NEXT_PUBLIC_ENABLE_E2E_FIXTURES: "1" });
    const request = new NextRequest(
      "http://localhost:3000/e2e/cms-dashboard-scroll",
    );
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("does not treat sibling e2e-like paths as public fixtures", () => {
    setMiddlewareEnv({ NEXT_PUBLIC_ENABLE_E2E_FIXTURES: "1" });
    const request = new NextRequest("http://localhost:3000/e2e-foo");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Fe2e-foo",
    );
  });

  it("protects dashboard routes behind auth redirect", () => {
    setMiddlewareEnv();
    const request = new NextRequest("http://localhost:3000/dashboard");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Fdashboard",
    );
  });

  it("redirects unauthenticated protected routes to auth-app login", () => {
    setMiddlewareEnv();
    const request = new NextRequest("http://localhost:3000/acme/content");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent",
    );
  });

  it("rejects protected routes when auth cookie is forged", () => {
    setMiddlewareEnv();
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
    setMiddlewareEnv();
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

  it("allows protected routes when Supabase SSR cookie payload is base64url encoded", () => {
    setMiddlewareEnv();
    const validToken = createJwt({
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const encodedPayload = `base64-${toBase64Url(
      JSON.stringify([validToken, "refresh-token"]),
    )}`;
    const request = {
      nextUrl: new URL("http://localhost:3000/acme/content"),
      cookies: {
        getAll: () => [
          {
            name: "sb-localhost-auth-token",
            value: encodedPayload,
          },
        ],
      },
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("allows protected routes when chunked auth cookies appear in both request stores", () => {
    setMiddlewareEnv();
    const validToken = createJwt({
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const encodedPayload = `base64-${toBase64Url(
      JSON.stringify([validToken, "refresh-token"]),
    )}`;
    const splitIndex = Math.floor(encodedPayload.length / 2);
    const chunk0 = encodedPayload.slice(0, splitIndex);
    const chunk1 = encodedPayload.slice(splitIndex);
    const headers = new Headers();
    headers.set(
      "cookie",
      `sb-localhost-auth-token.0=${chunk0}; sb-localhost-auth-token.1=${chunk1}`,
    );
    const request = {
      nextUrl: new URL("http://localhost:3000/acme/content"),
      cookies: {
        getAll: () => [
          { name: "sb-localhost-auth-token.0", value: chunk0 },
          { name: "sb-localhost-auth-token.1", value: chunk1 },
        ],
      },
      headers,
    } as unknown as NextRequest;

    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
