import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { LandingScreen } from "../src/components/landing/LandingScreen";
import {
  CMS_LOCALE_COOKIE,
  getCmsMessages,
  resolveCmsLocale,
} from "../src/i18n/config";
import { composeAuthHandshakeUrls } from "../src/lib/auth/auth-handshake";
import { hasLikelyAuthenticatedSession } from "../src/lib/auth/cookie-session";
import { getCmsServerAuthRuntimeConfig } from "../src/lib/auth/server-config";

/**
 * Localized `<head>` metadata for the LP-CMS landing page.
 *
 * Reuses the same locale-resolution path the root layout already runs
 * (`CMS_LOCALE_COOKIE` + `accept-language` → `resolveCmsLocale` →
 * `getCmsMessages`) so the resolved metadata locale ALWAYS matches the
 * locale rendered inside `<LandingScreen>`. Hostile / unsupported locale
 * inputs collapse to `en-US` via `negotiateLocale`'s fail-closed branch — no
 * unvalidated string drives this code path.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveCmsLocale({
    cookieLocale: cookieStore.get(CMS_LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
  const messages = getCmsMessages(locale);
  return {
    title: messages.cms.landing.meta.title,
    description: messages.cms.landing.meta.description,
  };
}

type LandingSearchParams = Record<string, string | string[] | undefined>;

function pickRedirectParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find(
      (entry) => typeof entry === "string" && entry.trim() !== "",
    );
    return first?.trim() || undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return undefined;
}

/**
 * Build the cookie / header surface `hasLikelyAuthenticatedSession` expects
 * out of the Next.js server-runtime helpers. We do NOT use a NextRequest
 * here because RSCs only see `cookies()` + `headers()`.
 */
async function buildCookieSessionRequest() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return {
    cookies: {
      getAll: () =>
        cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    },
    headers: {
      get: (name: string) => headerStore.get(name),
    },
  };
}

/**
 * Public landing page (LP-CMS).
 *
 * Reachable at `https://cms.xynes.com/`. Replaces the prior Next.js starter
 * "To get started, edit the page.tsx file." placeholder with a real splash
 * screen rendered by `<LandingScreen>`.
 *
 * Server-side behavior:
 *
 *   1. If the visitor is already authenticated (Supabase cookie carries a
 *      non-expired JWT), they are immediately redirected to `/dashboard`.
 *      The in-CMS `DashboardResolverPage` then resolves the workspace slug
 *      and forwards to `/dashboard/[workspaceSlug]/content` (or `/onboarding`
 *      if no workspace exists yet, per BUG-AUTH-9). This preserves the
 *      pre-LP-CMS bookmark behavior: an authenticated user hitting `/` lands
 *      in their workspace dashboard.
 *
 *   2. Anonymous visitors see `<LandingScreen>`. The validated `?redirect=`
 *      query (if any) is forwarded into BOTH the sign-in AND sign-up CTAs
 *      as `?redirect=<encoded>` so a returning visitor's intended destination
 *      survives the auth handshake. When no explicit redirect is supplied,
 *      the CTAs go to bare `${authAppUrl}/login` / `${authAppUrl}/signup`
 *      and the auth pages apply their own default destination — appending
 *      the default explicitly would trip the auth-app's login redirect-loop
 *      guard.
 *
 *   3. Hostile or unallowlisted `?redirect=` values fail closed to
 *      `/dashboard` via `getSafeRedirectUrl`.
 *
 * Why probe cookies server-side instead of using `useAuth()` client-side:
 *   - Mirrors the middleware contract (avoids a flash of marketing copy
 *     before the client hydration finishes and the redirect runs).
 *   - The middleware already treats `/` as public, so without this check an
 *     authenticated user hitting `/` would see the landing screen before
 *     the existing `/dashboard` client redirect could fire.
 *
 * @see `xynes-front-end/infra/docs/plans/2026-06-04-landing-page-template/03-xynes-cms-console-web-landing.md`
 */
export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<LandingSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawRedirect = pickRedirectParam(resolvedSearchParams.redirect);

  const { authAppUrl, allowedRedirectDomains } =
    getCmsServerAuthRuntimeConfig();

  const handshake = composeAuthHandshakeUrls({
    authAppUrl,
    rawRedirect,
    allowedRedirectDomains,
  });

  // Server-side auth check. When a session cookie is present and not
  // expired, skip the landing splash and send the visitor straight to the
  // dashboard (or to the validated redirect target). The downstream
  // dashboard resolver handles the workspace-slug fan-out.
  const sessionRequest = await buildCookieSessionRequest();
  const isAuthenticated = hasLikelyAuthenticatedSession(sessionRequest);

  if (isAuthenticated) {
    redirect(handshake.resolvedRedirect);
  }

  return (
    <LandingScreen
      signInHref={handshake.signInHref}
      signUpHref={handshake.signUpHref}
    />
  );
}
