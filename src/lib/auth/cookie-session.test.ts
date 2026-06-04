import { describe, expect, it } from "vitest";

import {
  AUTH_COOKIE_KEY_PATTERNS,
  extractAccessTokenFromCookieValue,
  getCandidateTokens,
  hasLikelyAuthenticatedSession,
  isJwtLikeAndNotExpired,
  parseCookiesFromHeaders,
  type CookieSessionRequest,
} from "./cookie-session";

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

function makeRequest(
  cookies: ReadonlyArray<{ name: string; value: string }>,
  cookieHeader?: string,
): CookieSessionRequest {
  return {
    cookies: { getAll: () => cookies },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "cookie" ? (cookieHeader ?? null) : null,
    },
  };
}

describe("cookie-session helpers (regression baseline for middleware extraction)", () => {
  it("exposes the documented Supabase cookie-name patterns", () => {
    // These four patterns are what `middleware.ts` has always probed. Any
    // change here is a regression because the auth-app and CMS console
    // share this contract.
    expect(AUTH_COOKIE_KEY_PATTERNS).toHaveLength(4);
    expect(AUTH_COOKIE_KEY_PATTERNS[0].test("sb-localhost-auth-token")).toBe(
      true,
    );
    expect(AUTH_COOKIE_KEY_PATTERNS[1].test("sb-x-auth-token.0")).toBe(true);
    expect(AUTH_COOKIE_KEY_PATTERNS[2].test("supabase-auth-token")).toBe(true);
    expect(AUTH_COOKIE_KEY_PATTERNS[3].test("supabase-auth-token.7")).toBe(
      true,
    );
    expect(AUTH_COOKIE_KEY_PATTERNS[0].test("not-an-auth-cookie")).toBe(false);
  });
});

describe("extractAccessTokenFromCookieValue", () => {
  it("returns the access_token from a JSON array payload (Supabase shape)", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    const cookie = JSON.stringify([token, "refresh-token"]);
    expect(extractAccessTokenFromCookieValue(cookie)).toBe(token);
  });

  it("returns the access_token from a base64-prefixed payload", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    const encoded = `base64-${toBase64Url(JSON.stringify([token, "refresh"]))}`;
    expect(extractAccessTokenFromCookieValue(encoded)).toBe(token);
  });

  it("returns the access_token from an object-shaped payload", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    const cookie = JSON.stringify({ access_token: token });
    expect(extractAccessTokenFromCookieValue(cookie)).toBe(token);
  });

  it("returns the value when the payload is a raw JWT string", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    expect(extractAccessTokenFromCookieValue(token)).toBe(token);
  });

  it("returns null for a non-JWT string with no dots", () => {
    expect(extractAccessTokenFromCookieValue("not-a-jwt")).toBeNull();
  });
});

describe("isJwtLikeAndNotExpired", () => {
  it("returns true for a non-expired JWT", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    expect(isJwtLikeAndNotExpired(token)).toBe(true);
  });

  it("returns false for an expired JWT", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) - 300 });
    expect(isJwtLikeAndNotExpired(token)).toBe(false);
  });

  it("returns false for a 2-segment token", () => {
    expect(isJwtLikeAndNotExpired("a.b")).toBe(false);
  });

  it("returns false for a token whose payload omits sub", () => {
    const header = toBase64Url(JSON.stringify({ alg: "none" }));
    const payload = toBase64Url(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 }),
    );
    expect(isJwtLikeAndNotExpired(`${header}.${payload}.sig`)).toBe(false);
  });

  it("returns false for a token whose payload omits exp", () => {
    const header = toBase64Url(JSON.stringify({ alg: "none" }));
    const payload = toBase64Url(JSON.stringify({ sub: "user-1" }));
    expect(isJwtLikeAndNotExpired(`${header}.${payload}.sig`)).toBe(false);
  });
});

describe("parseCookiesFromHeaders", () => {
  it("merges cookies from both the NextRequest store and the raw header", () => {
    const cookies = parseCookiesFromHeaders(
      makeRequest([{ name: "a", value: "1" }], "b=2;c=3"),
    );
    expect(cookies).toContainEqual({ name: "a", value: "1" });
    expect(cookies).toContainEqual({ name: "b", value: "2" });
    expect(cookies).toContainEqual({ name: "c", value: "3" });
  });

  it("prefers the NextRequest store value on duplicate names", () => {
    const cookies = parseCookiesFromHeaders(
      makeRequest([{ name: "a", value: "from-store" }], "a=from-header"),
    );
    const a = cookies.find((c) => c.name === "a");
    expect(a?.value).toBe("from-store");
  });
});

describe("getCandidateTokens", () => {
  it("returns the token from a direct (non-chunked) Supabase cookie", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    const tokens = getCandidateTokens([
      { name: "sb-local-auth-token", value: JSON.stringify([token, "r"]) },
    ]);
    expect(tokens).toContain(token);
  });

  it("stitches chunked cookies back together in index order", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    const fullPayload = JSON.stringify([token, "r"]);
    const splitAt = Math.floor(fullPayload.length / 2);
    const chunk0 = fullPayload.slice(0, splitAt);
    const chunk1 = fullPayload.slice(splitAt);
    const tokens = getCandidateTokens([
      { name: "sb-local-auth-token.1", value: chunk1 },
      { name: "sb-local-auth-token.0", value: chunk0 },
    ]);
    expect(tokens).toContain(token);
  });

  it("skips cookies that do NOT match the auth-cookie name patterns", () => {
    expect(
      getCandidateTokens([{ name: "csrf-token", value: "abc.def.ghi" }]),
    ).toHaveLength(0);
  });
});

describe("hasLikelyAuthenticatedSession", () => {
  it("returns true for a request carrying a valid non-expired Supabase cookie", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) + 300 });
    const req = makeRequest([
      {
        name: "sb-local-auth-token",
        value: JSON.stringify([token, "refresh"]),
      },
    ]);
    expect(hasLikelyAuthenticatedSession(req)).toBe(true);
  });

  it("returns false for a request with no auth cookies", () => {
    const req = makeRequest([]);
    expect(hasLikelyAuthenticatedSession(req)).toBe(false);
  });

  it("returns false for a request whose JWT is expired", () => {
    const token = createJwt({ exp: Math.floor(Date.now() / 1000) - 300 });
    const req = makeRequest([
      {
        name: "sb-local-auth-token",
        value: JSON.stringify([token, "refresh"]),
      },
    ]);
    expect(hasLikelyAuthenticatedSession(req)).toBe(false);
  });

  it("returns false for a forged cookie value (random string)", () => {
    const req = makeRequest([{ name: "sb-local-auth-token", value: "abc123" }]);
    expect(hasLikelyAuthenticatedSession(req)).toBe(false);
  });
});
