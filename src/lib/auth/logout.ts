import {
  buildAuthLogoutUrl,
  getSafeRedirectUrl,
  isValidRedirectUrl,
} from "@xynes/auth-sdk";

type CmsLogoutHandoffInput = {
  authAppUrl: string;
  appUrl: string;
  allowedDomains: string[];
  redirectUrl?: string | null;
};

function ensureAbsoluteCmsUrl(value: string, appUrl: string): string {
  if (value.startsWith("/")) {
    return new URL(value, appUrl).toString();
  }
  return value;
}

export function buildCmsLogoutHandoffUrl({
  authAppUrl,
  appUrl,
  allowedDomains,
  redirectUrl,
}: CmsLogoutHandoffInput): string {
  const fallbackRedirect = new URL("/", appUrl).toString();
  const normalizedCandidate = redirectUrl?.trim() ?? "";
  const safeCandidate = getSafeRedirectUrl(
    normalizedCandidate,
    fallbackRedirect,
    allowedDomains
  );
  const safeAbsoluteRedirect = ensureAbsoluteCmsUrl(safeCandidate, appUrl);
  const finalRedirect = isValidRedirectUrl(safeAbsoluteRedirect, allowedDomains)
    ? safeAbsoluteRedirect
    : fallbackRedirect;

  return buildAuthLogoutUrl({
    authAppUrl,
    redirectUrl: finalRedirect,
    allowedDomains,
    fallbackRedirectUrl: fallbackRedirect,
  });
}
