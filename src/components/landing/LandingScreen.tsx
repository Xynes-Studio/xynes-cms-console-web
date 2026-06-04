"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@lumia-ui/icons";
import {
  CookieDisclosure,
  MarketingFeatureCard,
  MarketingFeatureGrid,
  MarketingFooter,
  MarketingHero,
  MarketingNav,
  MarketingTrustStrip,
} from "@lumia-ui/marketing";
import { Flex } from "@lumia-ui/components";

import {
  LANDING_BRAND_HREF,
  LANDING_COOKIE_POLICY_URL,
  LANDING_FEATURES,
  LANDING_TRUST,
  buildFooterColumns,
} from "../../lib/landing-copy";

/**
 * LP-CMS landing screen.
 *
 * Rendered by `app/page.tsx` (RSC) when the visitor is not already
 * authenticated. One-screen vertical scroll using the Lumia DS marketing
 * primitives: nav, hero, 3-card feature grid, trust strip, footer, and a
 * non-blocking cookie disclosure.
 *
 * The shape mirrors LP-AUTH (`auth.xynes.com/`) verbatim so the two public
 * surfaces feel like one product. Primary CTA is "Sign in" (returning user
 * funnel — the dominant case for `cms.xynes.com/`), secondary CTA is
 * "Create an account" (signup funnel). Both delegate to the canonical auth
 * app via the cross-app handshake.
 *
 * Routing contract:
 *
 *   - Sign-in + sign-up CTAs land on the auth-app's `/login` and `/signup`
 *     with `?redirect=<encoded>` only when the visitor brought an explicit
 *     allowlisted deep link to `/`. Default destination is `/dashboard`
 *     (the in-CMS workspace resolver page); appending `?redirect=/dashboard`
 *     to the auth URL would trip the auth-app's login redirect-loop guard.
 *
 * @param signInHref — Fully-composed `${authAppUrl}/login[?redirect=...]`.
 *   Always already validated by `composeAuthHandshakeUrls`.
 * @param signUpHref — Fully-composed `${authAppUrl}/signup[?redirect=...]`.
 *   Always already validated by `composeAuthHandshakeUrls`.
 */
export type LandingScreenProps = Readonly<{
  signInHref: string;
  signUpHref: string;
}>;

const FEATURE_ICON_SIZE_PX = 28;

export function LandingScreen({ signInHref, signUpHref }: LandingScreenProps) {
  const t = useTranslations("cms.landing");

  return (
    <Flex
      direction="col"
      className="min-h-dvh w-full bg-background"
      data-testid="cms-landing-screen"
    >
      <MarketingNav
        brand={{
          variant: "icon",
          size: "sm",
          href: LANDING_BRAND_HREF,
          label: t("nav.brandLabel"),
        }}
        actions={[
          {
            id: "nav-signin",
            label: t("nav.signIn"),
            href: signInHref,
            variant: "ghost",
          },
          {
            id: "nav-signup",
            label: t("nav.signUp"),
            href: signUpHref,
            variant: "primary",
          },
        ]}
        aria-label={t("nav.ariaLabel")}
      />

      <main className="flex-1">
        <MarketingHero
          headline={t("hero.headline")}
          subhead={t("hero.subhead")}
          primaryCta={{
            id: "hero-signin",
            label: t("hero.primaryCta"),
            href: signInHref,
            variant: "primary",
          }}
          secondaryCta={{
            id: "hero-signup",
            label: t("hero.secondaryCta"),
            href: signUpHref,
            variant: "ghost",
          }}
          footnote={
            <span data-testid="cms-landing-hero-footnote">
              {t("hero.footnote")}
            </span>
          }
          aria-label={t("hero.ariaLabel")}
        />

        <MarketingFeatureGrid
          columns={3}
          aria-label={t("features.ariaLabel")}
          data-testid="cms-landing-feature-grid"
        >
          {LANDING_FEATURES.map((feature) => (
            <MarketingFeatureCard
              key={feature.key}
              icon={
                <Icon
                  name={feature.icon}
                  size={FEATURE_ICON_SIZE_PX}
                  aria-hidden
                />
              }
              headline={t(feature.headlineKey)}
              data-testid={`cms-landing-feature-${feature.key}`}
            >
              {t(feature.bodyKey)}
            </MarketingFeatureCard>
          ))}
        </MarketingFeatureGrid>

        <MarketingTrustStrip
          repoUrl={LANDING_TRUST.repoUrl}
          license={LANDING_TRUST.license}
          securityUrl={LANDING_TRUST.securityUrl}
          aria-label={t("trust.ariaLabel")}
        />
      </main>

      <MarketingFooter
        columns={buildFooterColumns(t, { signInHref, signUpHref })}
        copyright={t("footer.copyright")}
        aria-label={t("footer.ariaLabel")}
      />

      <CookieDisclosure
        policyUrl={LANDING_COOKIE_POLICY_URL}
        message={t("cookie.message")}
        policyLabel={t("cookie.policyLabel")}
        dismissLabel={t("cookie.dismissLabel")}
      />
    </Flex>
  );
}
