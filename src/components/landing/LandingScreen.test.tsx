import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

// Mock the Lumia marketing primitives. The CMS console tests follow the
// "always mock @lumia-ui/* in tests" convention (see
// `src/components/dashboard/CmsDashboardShell.i18n.test.tsx`) — actual
// rendering correctness of the underlying marketing components is owned by
// the LP-DS package's own test suite. Here we assert the WIRING contract:
// the right strings reach the right props, the right URLs reach the right
// hrefs, the structure is correct.
vi.mock("@lumia-ui/marketing", () => {
  const Nav = ({
    brand,
    actions,
    "aria-label": ariaLabel,
  }: {
    brand: { href: string; label?: string };
    actions: ReadonlyArray<{
      id?: string;
      label: string;
      href: string;
      variant?: string;
    }>;
    "aria-label"?: string;
  }) => (
    <nav aria-label={ariaLabel}>
      <a href={brand.href} aria-label={brand.label}>
        brand
      </a>
      {actions.map((a) => (
        <a key={a.id ?? a.label} href={a.href} data-cta-id={a.id}>
          {a.label}
        </a>
      ))}
    </nav>
  );
  const Hero = ({
    headline,
    subhead,
    primaryCta,
    secondaryCta,
    footnote,
    "aria-label": ariaLabel,
  }: {
    headline: string;
    subhead: string;
    primaryCta: { id?: string; label: string; href: string; target?: string };
    secondaryCta?: {
      id?: string;
      label: string;
      href: string;
      target?: string;
    };
    footnote?: ReactNode;
    "aria-label"?: string;
  }) => (
    <section aria-label={ariaLabel}>
      <h1>{headline}</h1>
      <p>{subhead}</p>
      <a
        href={primaryCta.href}
        target={primaryCta.target}
        rel={primaryCta.target === "_blank" ? "noopener noreferrer" : undefined}
        data-cta-id={primaryCta.id}
      >
        {primaryCta.label}
      </a>
      {secondaryCta ? (
        <a
          href={secondaryCta.href}
          target={secondaryCta.target}
          rel={
            secondaryCta.target === "_blank" ? "noopener noreferrer" : undefined
          }
          data-cta-id={secondaryCta.id}
        >
          {secondaryCta.label}
        </a>
      ) : null}
      {footnote}
    </section>
  );
  const FeatureGrid = ({
    children,
    "aria-label": ariaLabel,
    "data-testid": testId,
  }: {
    children: ReactNode;
    "aria-label"?: string;
    "data-testid"?: string;
  }) => (
    <section aria-label={ariaLabel} data-testid={testId}>
      <ul>{children}</ul>
    </section>
  );
  const FeatureCard = ({
    headline,
    children,
    "data-testid": testId,
  }: {
    icon?: ReactNode;
    headline: string;
    children?: ReactNode;
    "data-testid"?: string;
  }) => (
    <li data-testid={testId}>
      <h3>{headline}</h3>
      <p>{children}</p>
    </li>
  );
  const TrustStrip = ({
    repoUrl,
    license,
    securityUrl,
    "aria-label": ariaLabel,
  }: {
    repoUrl: string;
    license: string;
    securityUrl: string;
    "aria-label"?: string;
  }) => (
    <aside aria-label={ariaLabel}>
      <a href={repoUrl} target="_blank" rel="noopener noreferrer">
        Source code
      </a>
      <span data-testid="trust-license">{license}</span>
      <a href={securityUrl}>Security policy</a>
    </aside>
  );
  const Footer = ({
    columns,
    copyright,
    "aria-label": ariaLabel,
  }: {
    columns: ReadonlyArray<{
      heading: string;
      links: ReadonlyArray<{
        label: string;
        href: string;
        external?: boolean;
        id?: string;
      }>;
    }>;
    copyright?: ReactNode;
    "aria-label"?: string;
  }) => (
    <footer aria-label={ariaLabel}>
      {columns.map((col) => (
        <section key={col.heading}>
          <h3>{col.heading}</h3>
          <ul>
            {col.links.map((link) => (
              <li key={link.id ?? link.label}>
                <a
                  href={link.href}
                  data-link-id={link.id}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {copyright ? <small>{copyright}</small> : null}
    </footer>
  );
  const CookieDisclosure = ({
    policyUrl,
    message,
    policyLabel,
    dismissLabel,
  }: {
    policyUrl: string;
    message: string;
    policyLabel: string;
    dismissLabel: string;
  }) => (
    <div role="region" aria-label="Cookie disclosure">
      <span>{message}</span>
      <a href={policyUrl}>{policyLabel}</a>
      <button type="button">{dismissLabel}</button>
    </div>
  );
  return {
    MarketingNav: Nav,
    MarketingHero: Hero,
    MarketingFeatureGrid: FeatureGrid,
    MarketingFeatureCard: FeatureCard,
    MarketingTrustStrip: TrustStrip,
    MarketingFooter: Footer,
    CookieDisclosure,
  };
});

// Mock the icon module — the CMS console's other tests do the same.
vi.mock("@lumia-ui/icons", () => ({
  Icon: () => null,
  IconSprite: () => null,
  getIcon: () => undefined,
  registerIcon: () => undefined,
}));

// Mock @lumia-ui/components Flex — we render Flex as a plain <div>.
vi.mock("@lumia-ui/components", () => ({
  Flex: ({
    children,
    className,
    "data-testid": testId,
  }: {
    children?: ReactNode;
    direction?: string;
    className?: string;
    "data-testid"?: string;
  }) => (
    <div className={className} data-testid={testId}>
      {children}
    </div>
  ),
}));

import { LandingScreen } from "./LandingScreen";
import enUsLanding from "../../../messages/en-US/cms.landing.json";
import enXaLanding from "../../../messages/en-XA/cms.landing.json";

afterEach(() => cleanup());

function withIntl(locale: "en-US" | "en-XA", children: ReactNode) {
  const messages =
    locale === "en-US"
      ? { cms: { landing: enUsLanding } }
      : { cms: { landing: enXaLanding } };
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe("LP-CMS <LandingScreen>", () => {
  const renderScreen = (
    props?: {
      signInHref?: string;
      signUpHref?: string;
    },
    locale: "en-US" | "en-XA" = "en-US",
  ) =>
    render(
      withIntl(
        locale,
        <LandingScreen
          signInHref={props?.signInHref ?? "http://localhost:3100/login"}
          signUpHref={props?.signUpHref ?? "http://localhost:3100/signup"}
        />,
      ),
    );

  it("renders the hero headline as the single <h1>", () => {
    renderScreen();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(enUsLanding.hero.headline);
    expect(heading).toHaveTextContent("Xynes CMS Console");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders all three feature cards from the structural list", () => {
    renderScreen();
    for (const feature of [
      enUsLanding.features.directoryFirst,
      enUsLanding.features.workspaceScoped,
      enUsLanding.features.openSource,
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: feature.headline }),
      ).toBeInTheDocument();
    }
  });

  it("renders Sign in (primary) and Create an account (secondary) hero CTAs as anchors", () => {
    renderScreen();
    const heroSection = screen
      .getByRole("heading", { level: 1 })
      .closest("section");
    expect(heroSection).not.toBeNull();
    const inHero = within(heroSection as HTMLElement);

    // Primary CTA → /login (returning user funnel; matches LP-AUTH)
    const primaryCta = inHero.getByRole("link", {
      name: new RegExp(enUsLanding.hero.primaryCta, "i"),
    });
    expect(primaryCta).toHaveAttribute("href", "http://localhost:3100/login");

    // Secondary CTA → /signup (signup funnel; matches LP-AUTH)
    const secondaryCta = inHero.getByRole("link", {
      name: new RegExp(enUsLanding.hero.secondaryCta, "i"),
    });
    expect(secondaryCta).toHaveAttribute(
      "href",
      "http://localhost:3100/signup",
    );
    // Both CTAs are same-origin auth handshake — no target="_blank".
    expect(primaryCta).not.toHaveAttribute("target");
    expect(secondaryCta).not.toHaveAttribute("target");
  });

  it("preserves the resolved redirect on the nav sign-in + sign-up CTAs", () => {
    const signIn =
      "http://localhost:3100/login?redirect=" +
      encodeURIComponent("https://cms.xynes.com/dashboard");
    const signUp =
      "http://localhost:3100/signup?redirect=" +
      encodeURIComponent("https://cms.xynes.com/dashboard");
    renderScreen({ signInHref: signIn, signUpHref: signUp });

    const nav = screen.getByRole("navigation", { name: /primary/i });
    const inNav = within(nav);
    expect(
      inNav.getByRole("link", {
        name: new RegExp(enUsLanding.nav.signIn, "i"),
      }),
    ).toHaveAttribute("href", signIn);
    expect(
      inNav.getByRole("link", {
        name: new RegExp(enUsLanding.nav.signUp, "i"),
      }),
    ).toHaveAttribute("href", signUp);
  });

  it("renders the OSS source-code chip with a safe https GitHub URL", () => {
    renderScreen();
    const sourceCodeLink = screen.getByRole("link", { name: /source code/i });
    expect(sourceCodeLink).toHaveAttribute(
      "href",
      "https://github.com/Xynes-Studio/xynes-cms-console-web",
    );
    expect(sourceCodeLink).toHaveAttribute("target", "_blank");
    expect(sourceCodeLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the security policy link pointing at /SECURITY.md", () => {
    renderScreen();
    const securityLink = screen.getByRole("link", { name: /security policy/i });
    expect(securityLink).toHaveAttribute("href", "/SECURITY.md");
  });

  it("does NOT render a FAQ section (intentionally cut to match LP-AUTH cadence)", () => {
    renderScreen();
    // Anti-feature regression guard. Earlier iterations of LP-CMS included a
    // 6-row FAQ; the section was cut because every honest answer either
    // leaked implementation detail or required a documentation surface.
    // Adding it back must come with a product decision + a docs.xynes.com
    // canonical home.
    expect(screen.queryByText(/common questions/i)).toBeNull();
    expect(screen.queryByText(/how do api keys work/i)).toBeNull();
  });

  it("renders the footer landmark with the documented columns", () => {
    renderScreen();
    const footer = screen.getByRole("contentinfo");
    const inFooter = within(footer);
    expect(
      inFooter.getByRole("link", {
        name: new RegExp(enUsLanding.footer.columns.product.workspaceAdmin, "i"),
      }),
    ).toHaveAttribute("href", "http://localhost:3100/dashboard/integrations");
    for (const col of [
      enUsLanding.footer.columns.product.heading,
      enUsLanding.footer.columns.developers.heading,
      enUsLanding.footer.columns.company.heading,
      enUsLanding.footer.columns.legal.heading,
    ]) {
      expect(
        inFooter.getByRole("heading", { level: 3, name: col }),
      ).toBeInTheDocument();
    }
    expect(
      inFooter.getByText(enUsLanding.footer.copyright),
    ).toBeInTheDocument();
  });

  it("marks every external footer link with target=_blank and the safe rel attr", () => {
    renderScreen();
    const footer = screen.getByRole("contentinfo");
    const externalLinks = within(footer)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("target") === "_blank");
    expect(externalLinks.length).toBeGreaterThan(0);
    for (const a of externalLinks) {
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("never renders a <form>, password, or email input on the landing page", () => {
    const { container } = renderScreen();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input[type=password]")).toBeNull();
    expect(container.querySelector("input[type=email]")).toBeNull();
  });

  it("renders the cookie disclosure with the documented policy URL", () => {
    renderScreen();
    const policyLink = screen.getByRole("link", {
      name: new RegExp(enUsLanding.cookie.policyLabel, "i"),
    });
    expect(policyLink).toHaveAttribute(
      "href",
      "https://xynes.com/legal/cookies",
    );
  });

  it("renders pseudo-locale (en-XA) strings without breaking the layout", () => {
    renderScreen({}, "en-XA");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/^\[/);
    expect(heading.textContent).toMatch(/\]$/);
    expect(heading).toHaveTextContent(enXaLanding.hero.headline);
  });

  it("does not leak raw catalog key paths into the rendered DOM", () => {
    const { container } = renderScreen();
    const html = container.innerHTML;
    expect(html).not.toMatch(/cms\.landing\./);
    expect(html).not.toMatch(/features\.directoryFirst\.headline/);
  });
});
