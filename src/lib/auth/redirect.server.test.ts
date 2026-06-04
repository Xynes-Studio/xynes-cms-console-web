import { describe, expect, it } from "vitest";
import {
  buildAuthRouteUrl,
  getSafeRedirectUrl,
  isValidRedirectUrl,
} from "./redirect.server";

describe("redirect.server", () => {
  const allowed = ["localhost:3000", "xynes.com"];

  describe("isValidRedirectUrl", () => {
    it("accepts relative paths", () => {
      expect(isValidRedirectUrl("/acme/content", allowed)).toBe(true);
    });

    it("rejects protocol-relative, javascript, and data URLs", () => {
      expect(isValidRedirectUrl("//evil.example", allowed)).toBe(false);
      expect(isValidRedirectUrl("javascript:alert(1)", allowed)).toBe(false);
      expect(isValidRedirectUrl("data:text/html;base64,AAA", allowed)).toBe(false);
    });

    it("rejects backslash-based protocol-relative redirects (Codex PR #46 P1)", () => {
      // `new URL('/\\attacker.example/steal', 'https://cms.xynes.com')` resolves
      // to `https://attacker.example/steal` because browsers and the URL spec
      // normalise `/\` to `//`. The same-origin short-circuit MUST reject it.
      expect(isValidRedirectUrl("/\\attacker.example/steal", allowed)).toBe(false);
      expect(isValidRedirectUrl("/\\evil.example/path", allowed)).toBe(false);
      expect(isValidRedirectUrl("/\\", allowed)).toBe(false);
    });

    it("accepts allowlisted absolute URLs and subdomains", () => {
      expect(
        isValidRedirectUrl("http://localhost:3000/acme/content", allowed)
      ).toBe(true);
      expect(
        isValidRedirectUrl("https://console.xynes.com/dashboard", allowed)
      ).toBe(true);
    });

    it("rejects non-http protocols and unlisted hosts", () => {
      expect(isValidRedirectUrl("ftp://localhost:3000/file", allowed)).toBe(false);
      expect(
        isValidRedirectUrl("https://evil.example/phishing", allowed)
      ).toBe(false);
    });
  });

  describe("getSafeRedirectUrl", () => {
    const fallback = "http://localhost:3000/";

    it("returns fallback for empty input", () => {
      expect(getSafeRedirectUrl("", fallback, allowed)).toBe(fallback);
    });

    it("returns relative and validated absolute inputs", () => {
      expect(getSafeRedirectUrl("/acme", fallback, allowed)).toBe("/acme");
      expect(
        getSafeRedirectUrl("http://localhost:3000/acme", fallback, allowed)
      ).toBe("http://localhost:3000/acme");
    });

    it("returns fallback for invalid absolute input", () => {
      expect(
        getSafeRedirectUrl("https://evil.example/path", fallback, allowed)
      ).toBe(fallback);
    });

    it("returns fallback for backslash-based protocol-relative input (Codex PR #46 P1)", () => {
      // Defense in depth — both validators must reject `/\…` to prevent the
      // URL constructor from normalising it to an off-origin host.
      expect(getSafeRedirectUrl("/\\attacker.example/steal", fallback, allowed))
        .toBe(fallback);
      expect(getSafeRedirectUrl("/\\evil.example/path", fallback, allowed))
        .toBe(fallback);
      expect(getSafeRedirectUrl("/\\", fallback, allowed)).toBe(fallback);
    });
  });

  describe("buildAuthRouteUrl", () => {
    it("builds login and logout URLs with encoded redirect", () => {
      expect(
        buildAuthRouteUrl(
          "http://localhost:3100",
          "login",
          "http://localhost:3000/acme?tab=drafts"
        )
      ).toBe(
        "http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%3Ftab%3Ddrafts"
      );
      expect(
        buildAuthRouteUrl("http://localhost:3100", "logout", "http://localhost:3000/")
      ).toBe(
        "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
      );
    });
  });
});
