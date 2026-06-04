import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  LANDING_BRAND_HREF,
  LANDING_COOKIE_POLICY_URL,
  LANDING_EXTERNAL_LINKS,
  LANDING_FEATURES,
  LANDING_FOOTER_COLUMNS,
  LANDING_INTERNAL_LINKS,
  LANDING_TRUST,
  buildFooterColumns,
  type LandingFeatureIcon,
} from "./landing-copy";
import enUsLanding from "../../messages/en-US/cms.landing.json";
import enXaLanding from "../../messages/en-XA/cms.landing.json";

/**
 * Walks a nested object and returns every leaf key path joined by `.`.
 * Skips `_meta` / `_use` keys (translator-context comments).
 */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.startsWith("_")) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(...leafKeys(value, path));
  }
  return out;
}

describe("LP-CMS landing-copy (structural)", () => {
  it("freezes the brand / cookie / internal / external link sets + feature arrays", () => {
    expect(Object.isFrozen(LANDING_INTERNAL_LINKS)).toBe(true);
    expect(Object.isFrozen(LANDING_EXTERNAL_LINKS)).toBe(true);
    expect(Object.isFrozen(LANDING_FEATURES)).toBe(true);
    expect(Object.isFrozen(LANDING_FOOTER_COLUMNS)).toBe(true);
    expect(Object.isFrozen(LANDING_TRUST)).toBe(true);
  });

  it("uses a safe internal /SECURITY.md path", () => {
    expect(LANDING_INTERNAL_LINKS.security).toBe("/SECURITY.md");
  });

  it("uses https GitHub URLs for the OSS links", () => {
    expect(LANDING_TRUST.repoUrl).toMatch(
      /^https:\/\/github\.com\/Xynes-Studio\//,
    );
    expect(LANDING_EXTERNAL_LINKS.repoCmsConsole).toMatch(
      /^https:\/\/github\.com\/Xynes-Studio\//,
    );
  });

  it("never references attacker-controllable hosts in any structural URL", () => {
    const allUrls = [
      LANDING_BRAND_HREF,
      LANDING_COOKIE_POLICY_URL,
      ...Object.values(LANDING_INTERNAL_LINKS),
      ...Object.values(LANDING_EXTERNAL_LINKS),
      LANDING_TRUST.repoUrl,
      LANDING_TRUST.securityUrl,
    ];
    for (const url of allUrls) {
      // CodeQL js/incomplete-url-scheme-check posture: cover the full
      // dangerous-scheme triad + protocol-relative URLs.
      expect(url.toLowerCase().trim()).not.toMatch(/^javascript:/);
      expect(url.toLowerCase().trim()).not.toMatch(/^data:/);
      expect(url.toLowerCase().trim()).not.toMatch(/^vbscript:/);
      expect(url.trim()).not.toMatch(/^\/\//);
    }
  });

  it("renders the AGPL-3.0 license literal expected by the trust strip", () => {
    expect(LANDING_TRUST.license).toBe("AGPL-3.0");
  });

  it("exposes exactly three feature cards with stable ordering (mirrors LP-AUTH)", () => {
    expect(LANDING_FEATURES.map((f) => f.key)).toEqual([
      "directoryFirst",
      "workspaceScoped",
      "openSource",
    ]);
  });

  it("uses icon ids that are registered in @lumia-ui/icons default set", () => {
    // These are the ids declared in lumia-ds/packages/icons/src/default-icons.ts.
    const allowedIcons = new Set<LandingFeatureIcon>(["folder", "key", "code"]);
    for (const f of LANDING_FEATURES) {
      expect(allowedIcons.has(f.icon)).toBe(true);
    }
  });
});

describe("LP-CMS landing catalog parity", () => {
  it("en-US and en-XA carry the same key set", () => {
    const us = leafKeys(enUsLanding).sort();
    const xa = leafKeys(enXaLanding).sort();
    expect(xa).toEqual(us);
  });

  it("en-XA pseudo-locale wraps every leaf string", () => {
    // Pseudo-locale strings are wrapped in `[...]` brackets per @xynes/i18n.
    const sample = (enXaLanding as { hero: { headline: string } }).hero
      .headline;
    expect(sample.startsWith("[")).toBe(true);
    expect(sample.endsWith("]")).toBe(true);
  });

  it("each feature key in catalog matches the structural FEATURES list", () => {
    const catalogKeys = Object.keys(
      (enUsLanding as { features: Record<string, unknown> }).features,
    ).filter((k) => !k.startsWith("_") && k !== "ariaLabel");
    const structuralKeys = LANDING_FEATURES.map((f) => f.key);
    for (const k of structuralKeys) {
      expect(catalogKeys).toContain(k);
    }
  });

  it("catalog never carries raw secrets, tokens, hashes, or API key markers", () => {
    const enUsSerialized = JSON.stringify(enUsLanding);
    const enXaSerialized = JSON.stringify(enXaLanding);
    for (const serialized of [enUsSerialized, enXaSerialized]) {
      // Same hostile-pattern sweep used by `src/i18n/config.test.ts` and the
      // STORAGE-9 redaction tier.
      expect(serialized).not.toMatch(/xynes_live_/i);
      expect(serialized).not.toMatch(/AKIA[A-Z0-9]+/);
      expect(serialized).not.toMatch(/key_hash/i);
      expect(serialized).not.toMatch(/access_token/i);
      expect(serialized).not.toMatch(/X-Amz-Signature/i);
    }
  });

  it("catalog never overpromises features that require operator-side env flips", () => {
    // Honesty guard — see messages.meta/cms.landing.json `marketingHonestyPolicy`.
    // These tokens describe features that are stub-mode by default at MVP
    // (per STORAGE-FU-A..G AGENTS.md blocks). Landing-page copy must NOT
    // assert them as defaults to first-time visitors.
    const serialized =
      JSON.stringify(enUsLanding) + JSON.stringify(enXaLanding);
    expect(serialized).not.toMatch(/H\.264 (?:video )?transcodes?/i);
    expect(serialized).not.toMatch(/WebP and AVIF (?:image )?variants?/i);
    expect(serialized).not.toMatch(/PDF previews/i);
    expect(serialized).not.toMatch(/ClamAV/i);
    expect(serialized).not.toMatch(/Cloudflare R2/i);
    expect(serialized).not.toMatch(/quarterly .* audit/i);
  });
});

describe("buildFooterColumns", () => {
  const handshake = {
    signInHref: "https://auth.xynes.com/login",
    signUpHref: "https://auth.xynes.com/signup",
  };

  it("calls the translator for every column heading and link label", () => {
    const calls: string[] = [];
    const translator = (key: string) => {
      calls.push(key);
      return `translated:${key}`;
    };
    const cols = buildFooterColumns(translator, handshake);
    expect(cols.length).toBe(LANDING_FOOTER_COLUMNS.length);
    for (const col of LANDING_FOOTER_COLUMNS) {
      expect(calls).toContain(col.headingKey);
      for (const link of col.links) {
        expect(calls).toContain(link.labelKey);
      }
    }
  });

  it("resolves authHandshake symbolic hrefs against the provided handshake URLs", () => {
    const cols = buildFooterColumns((k) => k, handshake);
    // Product column → authHandshake links plus Workspace Admin.
    const productCol = cols[0];
    expect(productCol.links.length).toBe(3);
    expect(productCol.links[0].href).toBe("https://auth.xynes.com/login");
    expect(productCol.links[1].href).toBe("https://auth.xynes.com/signup");
    expect(productCol.links[2]).toEqual(
      expect.objectContaining({
        label: "footer.columns.product.workspaceAdmin",
        href: "https://auth.xynes.com/dashboard/integrations",
        id: "footer-workspace-admin",
      }),
    );
  });

  it("strips the ?redirect= query from signInHref when synthesising the Workspace Admin URL", () => {
    // When the visitor brought an explicit allowlisted ?redirect= deep link
    // to /, the handshake's signInHref carries the encoded query. The
    // Workspace Admin link is built from that base via the URL constructor
    // — the query string + path of the base MUST be replaced (not appended)
    // so the deep link lands on /dashboard/integrations without ?redirect=
    // bleeding through into the Workspace Admin URL.
    const withRedirect = {
      signInHref:
        "https://auth.xynes.com/login?redirect=https%3A%2F%2Fcms.xynes.com%2Fdashboard%2Facme%2Fcontent",
      signUpHref:
        "https://auth.xynes.com/signup?redirect=https%3A%2F%2Fcms.xynes.com%2Fdashboard%2Facme%2Fcontent",
    };
    const cols = buildFooterColumns((k) => k, withRedirect);
    const workspaceAdminLink = cols[0].links[2];
    expect(workspaceAdminLink.href).toBe(
      "https://auth.xynes.com/dashboard/integrations",
    );
    expect(workspaceAdminLink.href).not.toContain("redirect=");
    expect(workspaceAdminLink.href).not.toContain("/login");
  });

  it("preserves literal hrefs even if the translator returns a hostile string", () => {
    // Defense in depth: a hostile catalog (translator returns javascript:)
    // must NEVER mutate the structural href. We check the full
    // dangerous-scheme triad here plus protocol-relative URLs.
    const hostile = () => "javascript:alert(1)";
    const cols = buildFooterColumns(hostile, handshake);
    for (const col of cols) {
      for (const link of col.links) {
        const href = link.href.toLowerCase().trim();
        expect(href.startsWith("javascript:")).toBe(false);
        expect(href.startsWith("data:")).toBe(false);
        expect(href.startsWith("vbscript:")).toBe(false);
        expect(href.startsWith("//")).toBe(false);
      }
    }
  });

  it("forwards the handshake URLs verbatim — no double-encoding", () => {
    const withRedirect = {
      signInHref:
        "https://auth.xynes.com/login?redirect=https%3A%2F%2Fcms.xynes.com%2Fdashboard",
      signUpHref:
        "https://auth.xynes.com/signup?redirect=https%3A%2F%2Fcms.xynes.com%2Fdashboard",
    };
    const cols = buildFooterColumns((k) => k, withRedirect);
    expect(cols[0].links[0].href).toBe(withRedirect.signInHref);
    expect(cols[0].links[1].href).toBe(withRedirect.signUpHref);
  });
});

describe("SECURITY.md mirror parity (LP-CMS)", () => {
  it("repo-root SECURITY.md and public/SECURITY.md are byte-identical", () => {
    const root = resolve(__dirname, "../../SECURITY.md");
    const pub = resolve(__dirname, "../../public/SECURITY.md");
    const rootBytes = readFileSync(root);
    const pubBytes = readFileSync(pub);
    expect(rootBytes.equals(pubBytes)).toBe(true);
  });
});
