export function isValidRedirectUrl(
  url: string,
  allowedDomains: string[]
): boolean {
  if (!url || typeof url !== "string") return false;

  const lowerUrl = url.toLowerCase().trim();
  if (lowerUrl.startsWith("javascript:") || lowerUrl.startsWith("data:")) {
    return false;
  }

  // Same-origin short-circuit. Only accept paths that BOTH:
  //   - start with `/`
  //   - do NOT start with `//` (protocol-relative URL)
  //   - do NOT start with `/\` (browser-normalised protocol-relative — the
  //     URL constructor + every modern browser treat `/\foo` as `//foo`,
  //     which resolves to an off-origin host. See Codex review on PR #46
  //     for the demonstration: `new URL("/\\attacker/x", "https://cms.xynes.com")`
  //     → `https://attacker/x`).
  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.startsWith("/\\")
  ) {
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
  // Same-origin short-circuit — mirror the `isValidRedirectUrl` guard so a
  // `/\attacker/x` payload cannot bypass validation here either.
  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.startsWith("/\\")
  ) {
    return url;
  }
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
