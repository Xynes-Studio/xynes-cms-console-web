import { NextResponse, type NextRequest } from "next/server";
import { buildAuthLoginUrl, getSafeRedirectUrl } from "@xynes/auth-sdk";
import { getCmsAuthConfig } from "./src/lib/auth/config";

const PUBLIC_PATHS = new Set<string>(["/", "/logout"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon.ico", "/api"];
const AUTH_COOKIE_KEY_PATTERNS = [
  /^sb-.+-auth-token$/,
  /^sb-.+-auth-token\.\d+$/,
  /^supabase-auth-token$/,
  /^supabase-auth-token\.\d+$/,
];

type ParsedCookie = { name: string; value: string };

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function base64UrlDecode(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return atob(normalized + padding);
  } catch {
    return null;
  }
}

function decodeCookieValue(rawValue: string): string {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function extractAccessTokenFromCookieValue(cookieValue: string): string | null {
  const decoded = decodeCookieValue(cookieValue).trim();
  const maybeBase64Payload = decoded.startsWith("base64-")
    ? (() => {
        try {
          return atob(decoded.slice("base64-".length));
        } catch {
          return decoded;
        }
      })()
    : decoded;

  try {
    const parsed = JSON.parse(maybeBase64Payload) as
      | string
      | string[]
      | { access_token?: string };
    if (typeof parsed === "string") {
      return parsed;
    }
    if (Array.isArray(parsed)) {
      return typeof parsed[0] === "string" ? parsed[0] : null;
    }
    if (parsed && typeof parsed.access_token === "string") {
      return parsed.access_token;
    }
  } catch {
    // Non-JSON payloads are allowed to continue as raw JWT candidates.
  }

  return maybeBase64Payload.includes(".") ? maybeBase64Payload : null;
}

function isJwtLikeAndNotExpired(token: string): boolean {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return false;
  }

  const payloadRaw = base64UrlDecode(segments[1]);
  if (!payloadRaw) {
    return false;
  }

  try {
    const payload = JSON.parse(payloadRaw) as {
      exp?: number;
      sub?: string;
    };
    if (typeof payload.exp !== "number") {
      return false;
    }
    if (!payload.sub || typeof payload.sub !== "string") {
      return false;
    }
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookiesFromHeaders(request: NextRequest): ParsedCookie[] {
  const parsed: ParsedCookie[] = request.cookies
    .getAll()
    .map((cookie) => ({ name: cookie.name, value: cookie.value }));
  const rawCookieHeader = request.headers.get("cookie") ?? "";

  rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        return;
      }
      const name = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1);
      parsed.push({ name, value });
    });

  return parsed;
}

function getCandidateTokens(cookies: ParsedCookie[]): string[] {
  const directTokens: string[] = [];
  const chunkedByBaseName = new Map<string, Array<{ index: number; value: string }>>();

  for (const cookie of cookies) {
    if (!AUTH_COOKIE_KEY_PATTERNS.some((pattern) => pattern.test(cookie.name))) {
      continue;
    }

    const chunkMatch = cookie.name.match(/^(.*)\.(\d+)$/);
    if (chunkMatch) {
      const baseName = chunkMatch[1];
      const index = Number(chunkMatch[2]);
      const existing = chunkedByBaseName.get(baseName) ?? [];
      existing.push({ index, value: cookie.value });
      chunkedByBaseName.set(baseName, existing);
      continue;
    }

    const token = extractAccessTokenFromCookieValue(cookie.value);
    if (token) {
      directTokens.push(token);
    }
  }

  for (const [, chunks] of chunkedByBaseName) {
    const stitched = chunks
      .sort((a, b) => a.index - b.index)
      .map((chunk) => chunk.value)
      .join("");
    const token = extractAccessTokenFromCookieValue(stitched);
    if (token) {
      directTokens.push(token);
    }
  }

  return directTokens;
}

function hasLikelyAuthenticatedSession(request: NextRequest): boolean {
  const cookies = parseCookiesFromHeaders(request);
  const candidateTokens = getCandidateTokens(cookies);
  return candidateTokens.some(isJwtLikeAndNotExpired);
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || hasLikelyAuthenticatedSession(request)) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
