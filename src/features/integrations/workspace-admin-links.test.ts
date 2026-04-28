import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWorkspaceAdminIntegrationUrl } from "./workspace-admin-links";

const ORIGINAL_AUTH_APP_URL = process.env.NEXT_PUBLIC_AUTH_APP_URL;

describe("buildWorkspaceAdminIntegrationUrl", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
  });

  afterEach(() => {
    if (ORIGINAL_AUTH_APP_URL === undefined) {
      delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = ORIGINAL_AUTH_APP_URL;
    }
  });

  describe("with a configured https auth app URL", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://auth.xynes.example";
    });

    it("builds the domains link with tab=domains", () => {
      const url = buildWorkspaceAdminIntegrationUrl("domains");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=domains",
      );
    });

    it("builds the api keys link with tab=api-keys", () => {
      const url = buildWorkspaceAdminIntegrationUrl("api_keys");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys",
      );
    });

    it("builds the cms read-only key link with the cms_readonly preset", () => {
      const url = buildWorkspaceAdminIntegrationUrl("cms_readonly_key");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys&preset=cms_readonly",
      );
    });

    it("builds the cms publisher key link with the cms_publisher preset", () => {
      const url = buildWorkspaceAdminIntegrationUrl("cms_publisher_key");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys&preset=cms_publisher",
      );
    });

    it("strips trailing slashes from the configured auth app URL", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://auth.xynes.example///";

      expect(buildWorkspaceAdminIntegrationUrl("domains")).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=domains",
      );
    });
  });

  describe("with an http auth app URL (local development)", () => {
    it("permits http origins for local development", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys")).toBe(
        "http://localhost:3100/dashboard/integrations?tab=api-keys",
      );
    });
  });

  describe("safe fallbacks", () => {
    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is unset", () => {
      delete process.env.NEXT_PUBLIC_AUTH_APP_URL;

      expect(buildWorkspaceAdminIntegrationUrl("domains")).toBe(
        "/dashboard/integrations?tab=domains",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is whitespace", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "   ";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys")).toBe(
        "/dashboard/integrations?tab=api-keys",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is malformed", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "not a url";

      expect(buildWorkspaceAdminIntegrationUrl("cms_readonly_key")).toBe(
        "/dashboard/integrations?tab=api-keys&preset=cms_readonly",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL has a non-http scheme", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "javascript:alert(1)";

      expect(buildWorkspaceAdminIntegrationUrl("domains")).toBe(
        "/dashboard/integrations?tab=domains",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is a file:// URL", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "file:///etc/passwd";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys")).toBe(
        "/dashboard/integrations?tab=api-keys",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL embeds userinfo (defense-in-depth)", () => {
      // Even though `URL.origin` strips userinfo, we explicitly reject URLs
      // that contain embedded credentials so an operator-misconfigured env
      // value with `user:pass@host` form is never silently consumed.
      process.env.NEXT_PUBLIC_AUTH_APP_URL =
        "https://attacker:secret@auth.xynes.example";

      expect(buildWorkspaceAdminIntegrationUrl("domains")).toBe(
        "/dashboard/integrations?tab=domains",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is a data: URL", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL =
        "data:text/html,<script>1</script>";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys")).toBe(
        "/dashboard/integrations?tab=api-keys",
      );
    });

    it("never produces an href whose origin starts with anything other than http(s) or /", () => {
      const targets = [
        "domains",
        "api_keys",
        "cms_readonly_key",
        "cms_publisher_key",
      ] as const;

      const hostileEnvs = [
        undefined,
        "",
        "   ",
        "javascript:alert(1)",
        "JAVASCRIPT:alert(1)",
        "data:text/html,x",
        "file:///etc/passwd",
        "vbscript:msgbox(1)",
        "ftp://files.example.com",
        "ws://socket.example.com",
        "https://user:pass@evil.example",
        "not a url",
        "//protocol-relative.example",
      ];

      for (const env of hostileEnvs) {
        if (env === undefined) {
          delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
        } else {
          process.env.NEXT_PUBLIC_AUTH_APP_URL = env;
        }

        for (const target of targets) {
          const url = buildWorkspaceAdminIntegrationUrl(target);
          const isSafe =
            url.startsWith("/") ||
            url.startsWith("http://") ||
            url.startsWith("https://");
          expect(
            isSafe,
            `unsafe href produced for env=${String(env)}, target=${target}: ${url}`,
          ).toBe(true);
          expect(url.toLowerCase()).not.toMatch(/^javascript:/);
          expect(url.toLowerCase()).not.toMatch(/^data:/);
          expect(url.toLowerCase()).not.toMatch(/^file:/);
          expect(url.toLowerCase()).not.toMatch(/^vbscript:/);
        }
      }
    });
  });
});
