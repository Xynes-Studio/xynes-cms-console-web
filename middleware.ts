import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthRouteUrl,
  getSafeRedirectUrl,
} from "./src/lib/auth/redirect.server";
import { getCmsServerAuthRuntimeConfig } from "./src/lib/auth/server-config";
import { hasLikelyAuthenticatedSession } from "./src/lib/auth/cookie-session";

const PUBLIC_PATHS = new Set<string>(["/", "/logout", "/SECURITY.md"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/api"];
const E2E_FIXTURE_PREFIX = "/e2e";

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  if (
    (pathname === E2E_FIXTURE_PREFIX ||
      pathname.startsWith(`${E2E_FIXTURE_PREFIX}/`)) &&
    process.env.NEXT_PUBLIC_ENABLE_E2E_FIXTURES === "1"
  ) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || hasLikelyAuthenticatedSession(request)) {
    return NextResponse.next();
  }

  const { authAppUrl, appUrl, allowedRedirectDomains } =
    getCmsServerAuthRuntimeConfig();
  const allowedDomains = allowedRedirectDomains ?? [];
  const effectiveAppUrl = appUrl;
  const fallbackRedirect = new URL("/", effectiveAppUrl).toString();
  const safeRedirect = getSafeRedirectUrl(
    request.nextUrl.toString(),
    fallbackRedirect,
    allowedDomains,
  );

  const loginUrl = buildAuthRouteUrl(authAppUrl, "login", safeRedirect);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
