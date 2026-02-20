export function isValidRedirectUrl(
  url: string,
  allowedDomains: string[]
): boolean {
  if (!url || typeof url !== "string") return false;

  const lowerUrl = url.toLowerCase().trim();
  if (lowerUrl.startsWith("javascript:") || lowerUrl.startsWith("data:")) {
    return false;
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }
    const hostname = parsedUrl.hostname.toLowerCase();

    return allowedDomains.some((domain) => {
      const lowerDomain = domain.toLowerCase();
      if (lowerDomain.includes(":")) {
        const [domainHost, domainPort] = lowerDomain.split(":");
        return hostname === domainHost && parsedUrl.port === domainPort;
      }
      return hostname === lowerDomain || hostname.endsWith(`.${lowerDomain}`);
    });
  } catch {
    return false;
  }
}

export function getSafeRedirectUrl(
  url: string,
  defaultUrl: string,
  allowedDomains: string[]
): string {
  if (!url) return defaultUrl;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return isValidRedirectUrl(url, allowedDomains) ? url : defaultUrl;
}

export function buildAuthRouteUrl(
  authAppUrl: string,
  path: "login" | "logout",
  redirectUrl: string
): string {
  const url = new URL(`/${path}`, authAppUrl);
  url.searchParams.set("redirect", redirectUrl);
  return url.toString();
}
