import { getSafeRedirectUrl } from "./redirect.server";

/**
 * Auth-handshake URL composer for LP-CMS landing page.
 *
 * The landing screen at `/` shows two CTAs (Sign in + Sign up) that delegate
 * to the canonical auth-app on `NEXT_PUBLIC_AUTH_APP_URL`. We need to:
 *
 *   1. Compose `${authAppUrl}/login?redirect=<encoded>` and
 *      `${authAppUrl}/signup?redirect=<encoded>` urls.
 *   2. Validate the optional `?redirect=<url>` query the visitor brought to
 *      `/` against the allowlist before forwarding it on (defense in depth;
 *      a hostile redirect must NOT survive the handshake).
 *   3. Default to `/dashboard` so a brand-new signup lands in the workspace
 *      resolver which then routes to the correct workspace slug.
 *   4. Mirror LP-AUTH's "skip ?redirect= when the resolved value is the
 *      default" posture so the auth pages can apply their own destination
 *      logic without an extra query roundtrip + the auth-app's login
 *      redirect-loop guard cannot trip on `?redirect=/dashboard`.
 */

export type AuthHandshakeUrls = Readonly<{
  signInHref: string;
  signUpHref: string;
  /**
   * The safe (validated) redirect target. Always set — either the visitor's
   * own deep link OR the documented default.
   */
  resolvedRedirect: string;
  /**
   * `true` when the visitor supplied an allowlisted redirect that is NOT the
   * default destination. Used by callers to decide whether to attach the
   * `?redirect=` query — see the comment above.
   */
  redirectIsExplicit: boolean;
}>;

/** Default post-auth destination. Matches `app/dashboard/page.tsx` resolver. */
export const CMS_DEFAULT_POST_AUTH_DESTINATION = "/dashboard";

/**
 * Build the `?redirect=` URL query when (and only when) the visitor supplied
 * an allowlisted deep link that differs from the documented default. When the
 * resolved value IS the default, the bare auth URL is returned — appending
 * `?redirect=/dashboard` would (a) be a no-op for the auth pages and (b)
 * trip the auth-app's login redirect-loop guard on bare `/dashboard` targets.
 */
function withRedirectQuery(
  authPath: string,
  redirect: string,
  isExplicit: boolean,
): string {
  if (!isExplicit) return authPath;
  // `buildAuthRouteUrl` only knows the "login" / "logout" routes; we need
  // both "login" + "signup" so we compose manually here.
  const url = new URL(authPath);
  url.searchParams.set("redirect", redirect);
  return url.toString();
}

/**
 * Compose the sign-in + sign-up handshake URLs for the LP-CMS landing page.
 *
 * @param input.authAppUrl — `NEXT_PUBLIC_AUTH_APP_URL` (validated upstream).
 * @param input.rawRedirect — Optional `?redirect=` query from the request.
 * @param input.allowedRedirectDomains — Allowlist (already parsed from the
 *   env var). Hostile / unallowed values fail closed to the default.
 */
export function composeAuthHandshakeUrls(input: {
  authAppUrl: string;
  rawRedirect?: string | null;
  allowedRedirectDomains: ReadonlyArray<string>;
}): AuthHandshakeUrls {
  const { authAppUrl, rawRedirect, allowedRedirectDomains } = input;

  // Build login + signup base URLs against the auth-app origin. We do NOT
  // use `buildAuthRouteUrl` here because its `path` argument is typed
  // `"login" | "logout"` — signup is not in the union. Composing via the
  // URL constructor with the literal segment names keeps the path closed.
  const loginBase = new URL("/login", authAppUrl).toString();
  const signupBase = new URL("/signup", authAppUrl).toString();

  // Validate the incoming redirect. `getSafeRedirectUrl` already handles
  // missing / empty / unallowed / hostile inputs by falling back to the
  // default. We only attach the query string when the resolved value is
  // explicitly NOT the default (see `withRedirectQuery`).
  const safeRedirect = rawRedirect
    ? getSafeRedirectUrl(
        rawRedirect,
        CMS_DEFAULT_POST_AUTH_DESTINATION,
        Array.from(allowedRedirectDomains),
      )
    : CMS_DEFAULT_POST_AUTH_DESTINATION;
  const redirectIsExplicit =
    typeof rawRedirect === "string" &&
    rawRedirect.trim() !== "" &&
    safeRedirect !== CMS_DEFAULT_POST_AUTH_DESTINATION;

  return {
    signInHref: withRedirectQuery(loginBase, safeRedirect, redirectIsExplicit),
    signUpHref: withRedirectQuery(signupBase, safeRedirect, redirectIsExplicit),
    resolvedRedirect: safeRedirect,
    redirectIsExplicit,
  };
}
