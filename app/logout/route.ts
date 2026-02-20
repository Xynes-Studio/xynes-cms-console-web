import { NextResponse } from "next/server";
import { getCmsAuthConfig } from "../../src/lib/auth/config";
import { buildCmsLogoutHandoffUrl } from "../../src/lib/auth/logout";

function getAppUrlFromRequest(requestUrl: string): string {
  const url = new URL(requestUrl);
  return url.origin;
}

function buildLogoutRedirectResponse(request: Request): NextResponse {
  const { authAppUrl, appUrl, allowedRedirectDomains } = getCmsAuthConfig();
  const requestUrl = new URL(request.url);
  const redirectParam = requestUrl.searchParams.get("redirect");
  const effectiveAppUrl = appUrl || getAppUrlFromRequest(request.url);
  const handoffUrl = buildCmsLogoutHandoffUrl({
    authAppUrl,
    appUrl: effectiveAppUrl,
    allowedDomains: allowedRedirectDomains ?? [],
    redirectUrl: redirectParam,
  });

  return NextResponse.redirect(handoffUrl);
}

export async function GET(request: Request): Promise<NextResponse> {
  return buildLogoutRedirectResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return buildLogoutRedirectResponse(request);
}
