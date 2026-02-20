import { NextResponse } from "next/server";
import { buildCmsLogoutHandoffUrl } from "../../src/lib/auth/logout";
import { getCmsServerAuthRuntimeConfig } from "../../src/lib/auth/server-config";

function buildLogoutRedirectResponse(request: Request): NextResponse {
  const { authAppUrl, appUrl, allowedRedirectDomains } =
    getCmsServerAuthRuntimeConfig();
  const requestUrl = new URL(request.url);
  const redirectParam = requestUrl.searchParams.get("redirect");
  const handoffUrl = buildCmsLogoutHandoffUrl({
    authAppUrl,
    appUrl,
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
