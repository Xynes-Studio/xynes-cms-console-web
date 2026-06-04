import { describe, expect, it } from "vitest";
import {
  composeAuthHandshakeUrls,
  CMS_DEFAULT_POST_AUTH_DESTINATION,
} from "./auth-handshake";

const ALLOWED = ["xynes.com", "localhost:3000", "localhost:3100"] as const;
const AUTH_APP_URL = "http://localhost:3100";

describe("composeAuthHandshakeUrls", () => {
  it("returns bare /login and /signup when no redirect is supplied", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: undefined,
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.signInHref).toBe(`${AUTH_APP_URL}/login`);
    expect(out.signUpHref).toBe(`${AUTH_APP_URL}/signup`);
    expect(out.resolvedRedirect).toBe(CMS_DEFAULT_POST_AUTH_DESTINATION);
    expect(out.redirectIsExplicit).toBe(false);
  });

  it("returns bare /login and /signup when redirect is empty / whitespace", () => {
    for (const value of ["", "   ", null]) {
      const out = composeAuthHandshakeUrls({
        authAppUrl: AUTH_APP_URL,
        rawRedirect: value as string | null | undefined,
        allowedRedirectDomains: ALLOWED,
      });
      expect(out.signInHref).toBe(`${AUTH_APP_URL}/login`);
      expect(out.signUpHref).toBe(`${AUTH_APP_URL}/signup`);
      expect(out.redirectIsExplicit).toBe(false);
    }
  });

  it("attaches ?redirect= for an allowlisted absolute deep link", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "https://cms.xynes.com/dashboard",
      allowedRedirectDomains: ALLOWED,
    });
    const encoded = encodeURIComponent("https://cms.xynes.com/dashboard");
    expect(out.signInHref).toBe(`${AUTH_APP_URL}/login?redirect=${encoded}`);
    expect(out.signUpHref).toBe(`${AUTH_APP_URL}/signup?redirect=${encoded}`);
    expect(out.resolvedRedirect).toBe("https://cms.xynes.com/dashboard");
    expect(out.redirectIsExplicit).toBe(true);
  });

  it("attaches ?redirect= for a non-default relative deep link", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "/dashboard/acme/content",
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.signInHref).toBe(
      `${AUTH_APP_URL}/login?redirect=${encodeURIComponent("/dashboard/acme/content")}`,
    );
    expect(out.redirectIsExplicit).toBe(true);
  });

  it("does NOT attach ?redirect= when the resolved value is the default destination", () => {
    // Even when the visitor brought `?redirect=/dashboard`, the resolved
    // value matches the default, so appending it would trip the auth-app
    // login redirect-loop guard.
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: CMS_DEFAULT_POST_AUTH_DESTINATION,
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.signInHref).toBe(`${AUTH_APP_URL}/login`);
    expect(out.signUpHref).toBe(`${AUTH_APP_URL}/signup`);
    expect(out.redirectIsExplicit).toBe(false);
  });

  it("fails closed for a javascript: scheme redirect", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "javascript:alert(1)",
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.resolvedRedirect).toBe(CMS_DEFAULT_POST_AUTH_DESTINATION);
    expect(out.redirectIsExplicit).toBe(false);
    expect(out.signInHref).toBe(`${AUTH_APP_URL}/login`);
    expect(out.signUpHref).toBe(`${AUTH_APP_URL}/signup`);
  });

  it("fails closed for a data: scheme redirect", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "data:text/html,<script>alert(1)</script>",
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.resolvedRedirect).toBe(CMS_DEFAULT_POST_AUTH_DESTINATION);
    expect(out.redirectIsExplicit).toBe(false);
  });

  it("fails closed for a protocol-relative redirect", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "//attacker.com/steal",
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.resolvedRedirect).toBe(CMS_DEFAULT_POST_AUTH_DESTINATION);
    expect(out.redirectIsExplicit).toBe(false);
  });

  it("fails closed for a backslash-based protocol-relative redirect (Codex PR #46 P1)", () => {
    // `new URL('/\\attacker.com/steal', 'https://cms.xynes.com')` resolves to
    // `https://attacker.com/steal` — the URL spec treats `/\` like `//`.
    // The handshake MUST fall back to the default destination so neither the
    // authenticated `redirect(handshake.resolvedRedirect)` path nor the
    // anonymous handshake URL leaks the hostile value.
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "/\\attacker.com/steal",
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.resolvedRedirect).toBe(CMS_DEFAULT_POST_AUTH_DESTINATION);
    expect(out.redirectIsExplicit).toBe(false);
    // Defense in depth: the rendered signInHref MUST NOT contain the hostile
    // host either (the synthesised URL stays on the auth-app origin only).
    expect(out.signInHref).not.toContain("attacker.com");
    expect(out.signUpHref).not.toContain("attacker.com");
  });

  it("fails closed for an absolute URL whose host is NOT allowlisted", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "https://attacker.example.com/steal",
      allowedRedirectDomains: ALLOWED,
    });
    expect(out.resolvedRedirect).toBe(CMS_DEFAULT_POST_AUTH_DESTINATION);
    expect(out.redirectIsExplicit).toBe(false);
  });

  it("produces well-formed URL objects that round-trip through new URL()", () => {
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect: "https://cms.xynes.com/dashboard?x=1#y",
      allowedRedirectDomains: ALLOWED,
    });
    expect(() => new URL(out.signInHref)).not.toThrow();
    expect(() => new URL(out.signUpHref)).not.toThrow();
    // The `?redirect=` query value MUST be the encoded original.
    const parsed = new URL(out.signInHref);
    expect(parsed.searchParams.get("redirect")).toBe(
      "https://cms.xynes.com/dashboard?x=1#y",
    );
  });

  it("never leaks raw provider secrets in the composed URLs (defense in depth)", () => {
    // Hostile redirect carrying secret-shaped substrings — even though the
    // input is allowlisted (cms.xynes.com), the URL encoding must not break
    // and the secrets are part of the *path* not the query — they survive.
    // What we are asserting here: the helper does not concatenate strings
    // unsafely.
    const out = composeAuthHandshakeUrls({
      authAppUrl: AUTH_APP_URL,
      rawRedirect:
        "https://cms.xynes.com/dashboard?api_key=xynes_live_decafbad",
      allowedRedirectDomains: ALLOWED,
    });
    // We expect the redirect query to be encoded (so it cannot inject
    // additional `&` params into the auth-app URL).
    const parsed = new URL(out.signInHref);
    const redirectParam = parsed.searchParams.get("redirect");
    expect(redirectParam).toBe(
      "https://cms.xynes.com/dashboard?api_key=xynes_live_decafbad",
    );
    // Crucially, the auth-app URL must NOT carry api_key as a top-level
    // query param.
    expect(parsed.searchParams.get("api_key")).toBeNull();
  });
});
