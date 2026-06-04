import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the next/navigation `redirect()` so we can assert it without an
// actual server response.
const redirectMock = vi.fn((url: string): never => {
  throw new Error(`__REDIRECT__:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// Mock the cookie-session probe so the test controls the auth state.
const hasSessionMock = vi.fn<() => boolean>(() => false);
vi.mock("../src/lib/auth/cookie-session", () => ({
  hasLikelyAuthenticatedSession: () => hasSessionMock(),
}));

// Mock the runtime config getter so we don't have to set env vars at import
// time. The auth-app URL + allowlist are deterministic test values.
vi.mock("../src/lib/auth/server-config", () => ({
  getCmsServerAuthRuntimeConfig: () => ({
    authAppUrl: "http://localhost:3100",
    appUrl: "http://localhost:3000",
    allowedRedirectDomains: ["xynes.com", "localhost:3000", "localhost:3100"],
  }),
}));

// Mock the Next.js server-runtime cookies/headers helpers used by
// `generateMetadata` AND by the cookie-session request builder so the
// locale-resolution path runs deterministically.
const cookieGetMock = vi.fn<(name: string) => { value: string } | undefined>(
  () => undefined,
);
const cookieGetAllMock = vi.fn<
  () => ReadonlyArray<{ name: string; value: string }>
>(() => []);
const headerGetMock = vi.fn<(name: string) => string | null>(() => null);
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => cookieGetMock(name),
      getAll: () => cookieGetAllMock(),
    }),
  headers: () =>
    Promise.resolve({
      get: (name: string) => headerGetMock(name),
    }),
}));

import Home, { generateMetadata } from "./page";
import enUsLanding from "../messages/en-US/cms.landing.json";
import enXaLanding from "../messages/en-XA/cms.landing.json";

async function callPage(searchParams?: Record<string, string | string[]>) {
  const params: Record<string, string | string[]> = searchParams ?? {};
  return Home({ searchParams: Promise.resolve(params) });
}

beforeEach(() => {
  redirectMock.mockClear();
  hasSessionMock.mockReset();
  hasSessionMock.mockReturnValue(false);
  cookieGetMock.mockReset();
  cookieGetAllMock.mockReset();
  cookieGetMock.mockReturnValue(undefined);
  cookieGetAllMock.mockReturnValue([]);
  headerGetMock.mockReset();
  headerGetMock.mockReturnValue(null);
});

describe("LP-CMS `/` page (RSC)", () => {
  describe("when the visitor is anonymous", () => {
    beforeEach(() => {
      hasSessionMock.mockReturnValue(false);
    });

    it("renders the landing screen without redirecting", async () => {
      const element = await callPage();
      expect(redirectMock).not.toHaveBeenCalled();
      expect(element).toBeDefined();
      // The element type is the LandingScreen function — assert by name.
      expect(
        (
          element as unknown as {
            type: { name?: string; displayName?: string };
          }
        ).type.name ?? "",
      ).toBe("LandingScreen");
    });

    it("forwards bare /login + /signup when no redirect is supplied", async () => {
      const element = (await callPage()) as unknown as {
        props: { signInHref: string; signUpHref: string };
      };
      expect(element.props.signInHref).toBe("http://localhost:3100/login");
      expect(element.props.signUpHref).toBe("http://localhost:3100/signup");
    });

    it("forwards an allowlisted ?redirect= on BOTH CTAs", async () => {
      const element = (await callPage({
        redirect: "https://cms.xynes.com/dashboard/acme/content",
      })) as unknown as {
        props: { signInHref: string; signUpHref: string };
      };
      const encoded = encodeURIComponent(
        "https://cms.xynes.com/dashboard/acme/content",
      );
      expect(element.props.signInHref).toBe(
        `http://localhost:3100/login?redirect=${encoded}`,
      );
      expect(element.props.signUpHref).toBe(
        `http://localhost:3100/signup?redirect=${encoded}`,
      );
    });

    it("falls closed to bare /login + /signup for a hostile ?redirect=", async () => {
      const element = (await callPage({
        redirect: "javascript:alert(1)",
      })) as unknown as {
        props: { signInHref: string; signUpHref: string };
      };
      expect(element.props.signInHref).toBe("http://localhost:3100/login");
      expect(element.props.signUpHref).toBe("http://localhost:3100/signup");
    });

    it("falls closed for a protocol-relative ?redirect=", async () => {
      const element = (await callPage({
        redirect: "//attacker.com/steal",
      })) as unknown as {
        props: { signInHref: string; signUpHref: string };
      };
      expect(element.props.signInHref).toBe("http://localhost:3100/login");
    });

    it("falls closed for an unallowed external host", async () => {
      const element = (await callPage({
        redirect: "https://attacker.example.com/steal",
      })) as unknown as {
        props: { signInHref: string; signUpHref: string };
      };
      expect(element.props.signInHref).toBe("http://localhost:3100/login");
    });

    it("ignores an array-valued ?redirect= with all-empty entries", async () => {
      const element = (await callPage({
        redirect: ["", "  "],
      })) as unknown as {
        props: { signInHref: string; signUpHref: string };
      };
      expect(element.props.signInHref).toBe("http://localhost:3100/login");
    });
  });

  describe("when the visitor is already authenticated", () => {
    beforeEach(() => {
      hasSessionMock.mockReturnValue(true);
    });

    it("redirects to /dashboard by default", async () => {
      await expect(callPage()).rejects.toThrow("__REDIRECT__:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to an allowlisted ?redirect= target", async () => {
      await expect(
        callPage({ redirect: "https://cms.xynes.com/dashboard/acme/content" }),
      ).rejects.toThrow(
        "__REDIRECT__:https://cms.xynes.com/dashboard/acme/content",
      );
    });

    it("redirects to /dashboard for a hostile ?redirect=", async () => {
      await expect(
        callPage({ redirect: "javascript:alert(1)" }),
      ).rejects.toThrow("__REDIRECT__:/dashboard");
    });

    it("redirects to /dashboard for a protocol-relative ?redirect=", async () => {
      await expect(
        callPage({ redirect: "//attacker.com/steal" }),
      ).rejects.toThrow("__REDIRECT__:/dashboard");
    });
  });

  describe("generateMetadata", () => {
    it("returns en-US localized title + description by default", async () => {
      const metadata = await generateMetadata();
      expect(metadata.title).toBe(enUsLanding.meta.title);
      expect(metadata.description).toBe(enUsLanding.meta.description);
    });

    it("uses the en-XA pseudo-locale catalog when the cookie selects it", async () => {
      cookieGetMock.mockImplementation((name: string) =>
        name === "xynes_locale" ? { value: "en-XA" } : undefined,
      );
      const metadata = await generateMetadata();
      expect(metadata.title).toBe(enXaLanding.meta.title);
      expect(metadata.description).toBe(enXaLanding.meta.description);
    });

    it("falls closed to en-US for a hostile / unsupported cookie value", async () => {
      cookieGetMock.mockImplementation((name: string) =>
        name === "xynes_locale" ? { value: "../../etc/passwd" } : undefined,
      );
      const metadata = await generateMetadata();
      expect(metadata.title).toBe(enUsLanding.meta.title);
    });

    it("honours `accept-language` when the cookie is absent", async () => {
      headerGetMock.mockImplementation((name: string) =>
        name === "accept-language" ? "en-XA,en;q=0.9" : null,
      );
      const metadata = await generateMetadata();
      expect(metadata.title).toBe(enXaLanding.meta.title);
    });

    it("never leaks raw catalog key paths or secrets into metadata", async () => {
      const metadata = await generateMetadata();
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toMatch(/cms\.landing\.meta/);
      expect(serialized).not.toMatch(/xynes_live_/i);
      expect(serialized).not.toMatch(/AKIA[A-Z0-9]+/);
      expect(serialized).not.toMatch(/key_hash/i);
    });
  });
});
