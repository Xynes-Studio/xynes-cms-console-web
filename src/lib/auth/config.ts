import type { AuthConfig } from "@xynes/auth-sdk";
import { createAuthConfig, validateAuthConfig } from "@xynes/auth-sdk";

const DEFAULT_FALLBACK_PATH = "/";

function readRequiredEnv(name: string, rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    throw new Error("Missing required env: NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS");
  }

  const parsed =
    raw
      ?.split(",")
      .map((domain) => domain.trim())
      .filter(Boolean) ?? [];

  if (parsed.length === 0) {
    throw new Error("Missing required env: NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS");
  }

  return parsed;
}

export function getCmsAuthConfig(): AuthConfig {
  const supabaseUrl = readRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const supabaseAnonKey = readRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const apiBaseUrl = readRequiredEnv(
    "NEXT_PUBLIC_API_URL",
    process.env.NEXT_PUBLIC_API_URL
  );
  const authAppUrl = readRequiredEnv(
    "NEXT_PUBLIC_AUTH_APP_URL",
    process.env.NEXT_PUBLIC_AUTH_APP_URL
  );
  const appUrl = readRequiredEnv("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);

  const allowedDomains = parseAllowedDomains(
    process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS
  );

  const sdkConfig = createAuthConfig({
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    },
    api: {
      baseUrl: apiBaseUrl,
    },
    auth: {
      appUrl: authAppUrl,
    },
    crossApp: {
      redirects: {
        appUrl,
        allowedDomains,
        fallbackPath: DEFAULT_FALLBACK_PATH,
      },
    },
  });

  const validation = validateAuthConfig(sdkConfig);
  if (!validation.valid) {
    throw new Error(
      `Invalid CMS auth config: ${validation.errors.join("; ")}`
    );
  }

  return {
    supabaseUrl: sdkConfig.supabase.url,
    supabaseKey: sdkConfig.supabase.anonKey,
    apiBaseUrl: sdkConfig.api.baseUrl,
    authAppUrl: sdkConfig.auth.appUrl,
    appUrl,
    allowedRedirectDomains: allowedDomains,
    crossApp: sdkConfig.crossApp,
  };
}
