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

  it("redirects unauthenticated protected routes to auth-app login", () => {
    const request = new NextRequest("http://localhost:3000/acme/content");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent"
    );
  });

  it("allows protected routes when a Supabase auth cookie is present", () => {
    const request = {
      nextUrl: new URL("http://localhost:3000/acme/content"),
      cookies: {
        getAll: () => [{ name: "sb-auth-token", value: "abc123" }],
      },
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
