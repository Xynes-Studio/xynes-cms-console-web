import { NextResponse, type NextRequest } from "next/server";
import { buildAuthLoginUrl, getSafeRedirectUrl } from "@xynes/auth-sdk";
import { getCmsAuthConfig } from "./src/lib/auth/config";

const PUBLIC_PATHS = new Set<string>(["/", "/logout"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/api/security-headers"];
const AUTH_COOKIE_PREFIXES = ["sb-", "supabase-auth-token"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasAuthCookie(request: NextRequest): boolean {
  const cookieNames = new Set(
    request.cookies.getAll().map((cookie) => cookie.name)
  );
  const rawCookieHeader = request.headers.get("cookie") ?? "";

  rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [name] = entry.split("=");
      if (name) {
        cookieNames.add(name.trim());
      }
    });

  return [...cookieNames].some((name) =>
    AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || hasAuthCookie(request)) {
    return NextResponse.next();
  }

  const { authAppUrl, appUrl, allowedRedirectDomains } = getCmsAuthConfig();
  const allowedDomains = allowedRedirectDomains ?? [];
  const effectiveAppUrl = appUrl || request.nextUrl.origin;
  const fallbackRedirect = new URL("/", effectiveAppUrl).toString();
  const safeRedirect = getSafeRedirectUrl(
    request.nextUrl.toString(),
    fallbackRedirect,
    allowedDomains
  );

  const loginUrl = buildAuthLoginUrl({
    authAppUrl,
    redirectUrl: safeRedirect,
    allowedDomains,
    fallbackRedirectUrl: fallbackRedirect,
  });

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: "/:path*",
};
