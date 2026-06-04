/**
 * Cookie-only Supabase session probe.
 *
 * Used by:
 *
 *   1. `middleware.ts` — to decide whether to forward a request to a
 *      protected route or redirect to the auth-app's login form. The
 *      middleware MUST run on the Edge, so it cannot use the
 *      `@supabase/ssr` server client (Node-only).
 *
 *   2. `app/page.tsx` (LP-CMS landing) — to decide, server-side, whether a
 *      visitor hitting `/` should see the marketing splash or be redirected
 *      to their dashboard.
 *
 * The probe inspects only the cookie surface — it does NOT call Supabase
 * `auth.getUser()`. False positives (an attacker forging a cookie that
 * happens to contain a valid-looking JWT) are caught downstream by the
 * actual auth check that runs after the redirect.
 *
 * Originally lived inline in `middleware.ts`; factored out for reuse by the
 * LP-CMS landing-page RSC. Behaviour is preserved byte-for-byte — the
 * middleware test suite is the regression guard.
 */

type CookieLike = { name: string; value: string };

/**
 * Minimal subset of NextRequest we need. Keeping the surface narrow lets the
 * LP-CMS RSC pass a plain `{ cookies, headers }` object built from
 * `next/headers` without having to construct a real NextRequest.
 */
export type CookieSessionRequest = {
  cookies: { getAll(): ReadonlyArray<CookieLike> };
  headers: { get(name: string): string | null };
};

export const AUTH_COOKIE_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /^sb-.+-auth-token$/,
  /^sb-.+-auth-token\.\d+$/,
  /^supabase-auth-token$/,
  /^supabase-auth-token\.\d+$/,
];

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

export function extractAccessTokenFromCookieValue(
  cookieValue: string,
): string | null {
  const decoded = decodeCookieValue(cookieValue).trim();
  const maybeBase64Payload = decoded.startsWith("base64-")
    ? (() => {
        const encodedPayload = decoded.slice("base64-".length);
        const decodedPayload = base64UrlDecode(encodedPayload);
        return decodedPayload ?? decoded;
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

export function isJwtLikeAndNotExpired(token: string): boolean {
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

export function parseCookiesFromHeaders(
  request: CookieSessionRequest,
): CookieLike[] {
  const uniqueCookies = new Map<string, string>();

  request.cookies.getAll().forEach((cookie) => {
    if (!uniqueCookies.has(cookie.name)) {
      uniqueCookies.set(cookie.name, cookie.value);
    }
  });
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
      if (!uniqueCookies.has(name)) {
        uniqueCookies.set(name, value);
      }
    });

  return Array.from(uniqueCookies.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}

export function getCandidateTokens(
  cookies: ReadonlyArray<CookieLike>,
): string[] {
  const directTokens: string[] = [];
  const chunkedByBaseName = new Map<
    string,
    Array<{ index: number; value: string }>
  >();

  for (const cookie of cookies) {
    if (
      !AUTH_COOKIE_KEY_PATTERNS.some((pattern) => pattern.test(cookie.name))
    ) {
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

/**
 * Returns `true` when the request carries a Supabase-shaped auth cookie with
 * a still-valid (non-expired) JWT in its payload. Does NOT verify the JWT
 * signature — false positives are accepted as the downstream auth call's
 * problem.
 */
export function hasLikelyAuthenticatedSession(
  request: CookieSessionRequest,
): boolean {
  const cookies = parseCookiesFromHeaders(request);
  const candidateTokens = getCandidateTokens(cookies);
  return candidateTokens.some(isJwtLikeAndNotExpired);
}
