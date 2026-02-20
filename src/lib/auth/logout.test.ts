import { describe, expect, it } from "vitest";
import { buildCmsLogoutHandoffUrl } from "./logout";

describe("buildCmsLogoutHandoffUrl", () => {
  const authAppUrl = "http://localhost:3100";
  const appUrl = "http://localhost:3000";
  const allowedDomains = ["localhost:3000", "localhost:3100"];

  it("builds auth-app logout URL with validated absolute return target", () => {
    const url = buildCmsLogoutHandoffUrl({
      authAppUrl,
      appUrl,
      allowedDomains,
      redirectUrl: "http://localhost:3000/acme/content?tab=drafts",
    });

    expect(url).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent%3Ftab%3Ddrafts"
    );
  });

  it("normalizes safe relative redirect targets to the CMS origin", () => {
    const url = buildCmsLogoutHandoffUrl({
      authAppUrl,
      appUrl,
      allowedDomains,
      redirectUrl: "/acme/content?tab=published",
    });

    expect(url).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2Facme%2Fcontent%3Ftab%3Dpublished"
    );
  });

  it("falls back to CMS root when redirect target is unsafe", () => {
    const url = buildCmsLogoutHandoffUrl({
      authAppUrl,
      appUrl,
      allowedDomains,
      redirectUrl: "https://evil.example/phishing",
    });

    expect(url).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
    );
  });

  it("fails closed to CMS root when allowlist is empty", () => {
    const url = buildCmsLogoutHandoffUrl({
      authAppUrl,
      appUrl,
      allowedDomains: [],
      redirectUrl: "http://localhost:3000/acme/content",
    });

    expect(url).toBe(
      "http://localhost:3100/logout?redirect=http%3A%2F%2Flocalhost%3A3000%2F"
    );
  });
});
