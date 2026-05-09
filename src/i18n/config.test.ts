import { describe, expect, it } from "vitest";
import {
  CMS_LOCALE_COOKIE,
  getCmsMessages,
  resolveCmsLocale,
} from "./config";

describe("CMS i18n config", () => {
  it("uses the canonical Xynes locale cookie name", () => {
    expect(CMS_LOCALE_COOKIE).toBe("xynes_locale");
  });

  it("fails closed to en-US for unsupported or hostile locale values", () => {
    expect(resolveCmsLocale({ cookieLocale: "../../secret" })).toBe("en-US");
    expect(resolveCmsLocale({ cookieLocale: "javascript:alert(1)" })).toBe("en-US");
    expect(resolveCmsLocale({ cookieLocale: "fr-FR" })).toBe("en-US");
  });

  it("honors the supported pseudo-locale from cookie before Accept-Language", () => {
    expect(
      resolveCmsLocale({
        cookieLocale: "en-XA",
        acceptLanguage: "en-US,en;q=0.9",
      }),
    ).toBe("en-XA");
  });

  it("falls back to supported Accept-Language when cookie locale is invalid", () => {
    expect(
      resolveCmsLocale({
        cookieLocale: "../bad",
        acceptLanguage: "en-XA,en-US;q=0.8",
      }),
    ).toBe("en-XA");
  });

  it("loads English CMS messages for the default locale", () => {
    const messages = getCmsMessages("en-US");

    expect(messages.cms.shell.nav.contents).toBe("Contents");
    expect(messages.cms.content.toolbar.create).toBe("Create");
    expect(messages.cms.integrations.heading).toBe("CMS integrations");
  });

  it("loads pseudo-locale CMS messages for layout stress testing", () => {
    const messages = getCmsMessages("en-XA");

    expect(messages.cms.shell.nav.contents).toMatch(/^\[/);
    expect(messages.cms.content.toolbar.create).toMatch(/^\[/);
    expect(messages.cms.integrations.heading).toMatch(/^\[/);
  });
});
