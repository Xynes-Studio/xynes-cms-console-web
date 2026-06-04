/**
 * LP-CMS landing-page structural copy + URL contracts.
 *
 * The Lumia DS marketing primitives accept localized strings as runtime
 * props. The localized strings come from `cms.landing.*` via `next-intl`.
 * This module owns the OTHER half of the copy contract:
 *
 *   - The icon ids picked from `@lumia-ui/icons`.
 *   - The internal + external URLs each CTA / footer link points at.
 *   - The OSS repo + license + security policy targets used by the trust strip.
 *
 * Keeping this data out of JSX (and out of catalogs — translators MUST NOT
 * accidentally rewrite URLs) means a non-engineer can update copy in
 * `messages/en-US/cms.landing.json` + `docs/marketing-copy.md` without
 * touching the structural wiring, and an engineer can update structural
 * wiring without forcing a catalog refresh.
 *
 * Companion docs:
 *   - `docs/marketing-copy.md` — the human-editable source of truth.
 *   - `messages/en-US/cms.landing.json` — the runtime catalog.
 *   - `messages.meta/cms.landing.json` — translator metadata sidecar.
 */

import type {
  MarketingFooterColumn,
  MarketingLicense,
} from "@lumia-ui/marketing";

/**
 * Icon ids consumed by `@lumia-ui/icons`'s registered set. Each id below MUST
 * exist in `lumia-ds/packages/icons/src/default-icons.ts` so a typo is
 * caught at build time by the icon registry and at test time by
 * `src/lib/landing-copy.test.ts`.
 */
export type LandingFeatureIcon = "folder" | "key" | "code";

/**
 * Structural data for the three feature cards. The visible label / body
 * strings come from `cms.landing.features.<key>.*` at runtime. The set
 * intentionally mirrors the LP-AUTH cadence (3 cards, tight copy) to keep
 * the CMS public surface visually parallel with `auth.xynes.com/`.
 */
export type LandingFeatureKey =
  | "directoryFirst"
  | "workspaceScoped"
  | "openSource";

export type LandingFeatureSpec = Readonly<{
  key: LandingFeatureKey;
  /** i18n key path under `cms.landing.features.<key>`. */
  headlineKey: `features.${LandingFeatureKey}.headline`;
  bodyKey: `features.${LandingFeatureKey}.body`;
  icon: LandingFeatureIcon;
}>;

/**
 * Trust-strip targets. The OSS host allowlist lives inside `@lumia-ui/marketing`'s
 * `isAllowedOssRepoUrl` — passing a non-allowed URL here silently omits the
 * "Source code" chip rather than rendering an unsafe link.
 */
export type LandingTrustSpec = Readonly<{
  repoUrl: string;
  license: MarketingLicense;
  /** Relative URL served by `public/SECURITY.md`. */
  securityUrl: string;
}>;

/** Cookie disclosure target. Points at the legal cookie policy on the apex. */
export const LANDING_COOKIE_POLICY_URL =
  "https://xynes.com/legal/cookies" as const;

/** Apex marketing site. The brand mark in the nav links here. */
export const LANDING_BRAND_HREF = "https://xynes.com" as const;

/**
 * Internal CMS-console destinations served as static assets / public routes.
 * The sign-in / sign-up hrefs are NOT here — they are composed at render
 * time by `src/lib/auth/auth-handshake.ts` against the runtime
 * `NEXT_PUBLIC_AUTH_APP_URL` env value so they always cross over to the
 * canonical auth app.
 */
export const LANDING_INTERNAL_LINKS = Object.freeze({
  security: "/SECURITY.md",
} as const);

/** External destinations referenced by the footer + trust strip. */
export const LANDING_EXTERNAL_LINKS = Object.freeze({
  repoCmsConsole: "https://github.com/Xynes-Studio/xynes-cms-console-web",
  docs: "https://docs.xynes.com",
  apex: "https://xynes.com",
  status: "https://status.xynes.com",
  legalPrivacy: "https://xynes.com/legal/privacy",
  legalTerms: "https://xynes.com/legal/terms",
  legalCookies: LANDING_COOKIE_POLICY_URL,
} as const);

/**
 * Per-feature structural spec. The order here is the rendered order.
 * Each card's visible strings come from
 *   `cms.landing.features.<key>.headline`
 *   `cms.landing.features.<key>.body`
 */
export const LANDING_FEATURES: ReadonlyArray<LandingFeatureSpec> =
  Object.freeze([
    Object.freeze({
      key: "directoryFirst",
      headlineKey: "features.directoryFirst.headline",
      bodyKey: "features.directoryFirst.body",
      icon: "folder",
    } as const),
    Object.freeze({
      key: "workspaceScoped",
      headlineKey: "features.workspaceScoped.headline",
      bodyKey: "features.workspaceScoped.body",
      icon: "key",
    } as const),
    Object.freeze({
      key: "openSource",
      headlineKey: "features.openSource.headline",
      bodyKey: "features.openSource.body",
      icon: "code",
    } as const),
  ] as const);

/**
 * Trust-strip target. License is the cms-console repo's published license.
 * `residencyNote` is intentionally NOT included — until product confirms the
 * apex hosting region (00-overview §14 Q4 open question), the landing page
 * does not assert it.
 */
export const LANDING_TRUST: LandingTrustSpec = Object.freeze({
  repoUrl: LANDING_EXTERNAL_LINKS.repoCmsConsole,
  license: "AGPL-3.0",
  securityUrl: LANDING_INTERNAL_LINKS.security,
} as const);

/**
 * Footer column contract. Visible labels come from
 * `cms.landing.footer.columns.<col>.<key>` so the component below picks them
 * up via `t(...)`. The component composes this static structural list with
 * the runtime labels — order here is the rendered order.
 *
 * The shape mirrors the LP-AUTH footer (Product / Developers / Company /
 * Legal) so the two public surfaces feel like one product.
 *
 * `signIn` / `signUp` hrefs are computed at render time from the runtime
 * auth-app URL (see `src/lib/auth/auth-handshake.ts`). They are kept out of
 * the static list because they vary per environment.
 */
export type LandingFooterColumnSpec = Readonly<{
  /** i18n key under `cms.landing.footer.columns.<col>`. */
  headingKey: string;
  links: ReadonlyArray<
    Readonly<{
      /** i18n key under `cms.landing.footer.columns.<col>`. */
      labelKey: string;
      /**
       * Either a literal URL (for external + same-origin internal links) or
       * a symbolic key resolved at render time against the auth handshake
       * (`signIn` / `signUp`).
       */
      href:
        | string
        | {
            kind: "authHandshake";
            route: "login" | "signup" | "workspaceAdmin";
          };
      external?: boolean;
      /** Optional analytics-friendly id. */
      id?: string;
    }>
  >;
}>;

export const LANDING_FOOTER_COLUMNS: ReadonlyArray<LandingFooterColumnSpec> =
  Object.freeze([
    Object.freeze({
      headingKey: "footer.columns.product.heading",
      links: Object.freeze([
        Object.freeze({
          labelKey: "footer.columns.product.signIn",
          href: { kind: "authHandshake", route: "login" } as const,
          id: "footer-signin",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.product.signUp",
          href: { kind: "authHandshake", route: "signup" } as const,
          id: "footer-signup",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.product.workspaceAdmin",
          href: { kind: "authHandshake", route: "workspaceAdmin" } as const,
          id: "footer-workspace-admin",
        } as const),
      ] as const),
    } as const),
    Object.freeze({
      headingKey: "footer.columns.developers.heading",
      links: Object.freeze([
        Object.freeze({
          labelKey: "footer.columns.developers.cmsConsoleRepo",
          href: LANDING_EXTERNAL_LINKS.repoCmsConsole,
          external: true,
          id: "footer-cms-console",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.developers.docs",
          href: LANDING_EXTERNAL_LINKS.docs,
          external: true,
          id: "footer-docs",
        } as const),
      ] as const),
    } as const),
    Object.freeze({
      headingKey: "footer.columns.company.heading",
      links: Object.freeze([
        Object.freeze({
          labelKey: "footer.columns.company.website",
          href: LANDING_EXTERNAL_LINKS.apex,
          external: true,
          id: "footer-apex",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.company.status",
          href: LANDING_EXTERNAL_LINKS.status,
          external: true,
          id: "footer-status",
        } as const),
      ] as const),
    } as const),
    Object.freeze({
      headingKey: "footer.columns.legal.heading",
      links: Object.freeze([
        Object.freeze({
          labelKey: "footer.columns.legal.privacy",
          href: LANDING_EXTERNAL_LINKS.legalPrivacy,
          external: true,
          id: "footer-privacy",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.legal.terms",
          href: LANDING_EXTERNAL_LINKS.legalTerms,
          external: true,
          id: "footer-terms",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.legal.cookies",
          href: LANDING_EXTERNAL_LINKS.legalCookies,
          external: true,
          id: "footer-cookies",
        } as const),
        Object.freeze({
          labelKey: "footer.columns.legal.security",
          href: LANDING_INTERNAL_LINKS.security,
          id: "footer-security",
        } as const),
      ] as const),
    } as const),
  ] as const);

/**
 * Resolves the auth-handshake symbolic href against the runtime context.
 * Caller supplies `signInHref` + `signUpHref` (composed by
 * `src/lib/auth/auth-handshake.ts`) and this function picks the right one.
 */
function resolveFooterHref(
  href: LandingFooterColumnSpec["links"][number]["href"],
  ctx: { signInHref: string; signUpHref: string },
): string {
  if (typeof href === "string") return href;
  if (href.route === "login") return ctx.signInHref;
  if (href.route === "signup") return ctx.signUpHref;
  return new URL("/dashboard/integrations", ctx.signInHref).toString();
}

/**
 * Materializes the runtime `MarketingFooterColumn[]` for `<MarketingFooter>`
 * given a translator function + the resolved auth handshake URLs. Kept here
 * (rather than inline in `LandingScreen.tsx`) so the same wiring can be
 * exercised by a unit test.
 */
export function buildFooterColumns(
  translate: (key: string) => string,
  authHandshake: { signInHref: string; signUpHref: string },
): ReadonlyArray<MarketingFooterColumn> {
  return LANDING_FOOTER_COLUMNS.map((col) => ({
    heading: translate(col.headingKey),
    links: col.links.map((link) => ({
      label: translate(link.labelKey),
      href: resolveFooterHref(link.href, authHandshake),
      external: link.external,
      id: link.id,
    })),
  }));
}
