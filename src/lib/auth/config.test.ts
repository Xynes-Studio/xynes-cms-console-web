import { afterEach, describe, expect, it } from "vitest";
import { getCmsAuthConfig } from "./config";

describe("getCmsAuthConfig", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS;
  });

  it("builds auth-sdk config from public env contract", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4100";
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS =
      "localhost:3000,localhost:3100";

    const config = getCmsAuthConfig();

    expect(config.supabaseUrl).toBe("http://127.0.0.1:54321");
    expect(config.supabaseKey).toBe("anon-key");
    expect(config.apiBaseUrl).toBe("http://127.0.0.1:4100");
    expect(config.authAppUrl).toBe("http://localhost:3100");
    expect(config.appUrl).toBe("http://localhost:3000");
    expect(config.crossApp?.redirects?.appUrl).toBe("http://localhost:3000");
    expect(config.crossApp?.redirects?.allowedDomains).toEqual([
      "localhost:3000",
      "localhost:3100",
    ]);
    expect(config.crossApp?.redirects?.fallbackPath).toBe("/");
  });

  it("throws when redirect-domain env is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4100";
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS;

    expect(() => getCmsAuthConfig()).toThrow(
      "Missing required env: NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS"
    );
  });

  it("throws when required env is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    expect(() => getCmsAuthConfig()).toThrow(
      "Missing required env: NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  });

  it("throws when redirect domains env is blank after parsing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4100";
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS = "  ,   ";

    expect(() => getCmsAuthConfig()).toThrow(
      "Missing required env: NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS"
    );
  });

  it("throws when sdk validation fails", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "invalid-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4100";
    process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS =
      "localhost:3000,localhost:3100";

    expect(() => getCmsAuthConfig()).toThrow("Invalid CMS auth config:");
  });
});
