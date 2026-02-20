export type CmsServerAuthRuntimeConfig = {
  authAppUrl: string;
  appUrl: string;
  allowedRedirectDomains: string[];
};

function readRequiredEnv(name: string, value?: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required env: ${name}`);
  }
  return normalized;
}

function parseAllowedDomains(raw?: string): string[] {
  return (
    raw
      ?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? []
  );
}

export function getCmsServerAuthRuntimeConfig(): CmsServerAuthRuntimeConfig {
  const authAppUrl = readRequiredEnv(
    "NEXT_PUBLIC_AUTH_APP_URL",
    process.env.NEXT_PUBLIC_AUTH_APP_URL
  );
  const appUrl = readRequiredEnv(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL
  );

  return {
    authAppUrl,
    appUrl,
    allowedRedirectDomains: parseAllowedDomains(
      process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS
    ),
  };
}
