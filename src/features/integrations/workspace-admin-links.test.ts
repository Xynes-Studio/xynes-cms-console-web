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

    it("builds the domains link with tab=domains and the workspace slug", () => {
      const url = buildWorkspaceAdminIntegrationUrl("domains", "acme-demo");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=domains&workspace=acme-demo",
      );
    });

    it("builds the api keys link with tab=api-keys and the workspace slug", () => {
      const url = buildWorkspaceAdminIntegrationUrl("api_keys", "acme-demo");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys&workspace=acme-demo",
      );
    });

    it("builds the cms read-only key link with the cms_readonly preset and the workspace slug", () => {
      const url = buildWorkspaceAdminIntegrationUrl(
        "cms_readonly_key",
        "acme-demo",
      );

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys&preset=cms_readonly&workspace=acme-demo",
      );
    });

    it("builds the cms publisher key link with the cms_publisher preset and the workspace slug", () => {
      const url = buildWorkspaceAdminIntegrationUrl(
        "cms_publisher_key",
        "acme-demo",
      );

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys&preset=cms_publisher&workspace=acme-demo",
      );
    });

    it("strips trailing slashes from the configured auth app URL", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://auth.xynes.example///";

      expect(buildWorkspaceAdminIntegrationUrl("domains", "acme-demo")).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=domains&workspace=acme-demo",
      );
    });
  });

  describe("with an http auth app URL (local development)", () => {
    it("permits http origins for local development", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "http://localhost:3100";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys", "acme-demo")).toBe(
        "http://localhost:3100/dashboard/integrations?tab=api-keys&workspace=acme-demo",
      );
    });
  });

  describe("safe fallbacks", () => {
    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is unset", () => {
      delete process.env.NEXT_PUBLIC_AUTH_APP_URL;

      expect(buildWorkspaceAdminIntegrationUrl("domains", "acme-demo")).toBe(
        "/dashboard/integrations?tab=domains&workspace=acme-demo",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is whitespace", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "   ";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys", "acme-demo")).toBe(
        "/dashboard/integrations?tab=api-keys&workspace=acme-demo",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is malformed", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "not a url";

      expect(
        buildWorkspaceAdminIntegrationUrl("cms_readonly_key", "acme-demo"),
      ).toBe(
        "/dashboard/integrations?tab=api-keys&preset=cms_readonly&workspace=acme-demo",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL has a non-http scheme", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "javascript:alert(1)";

      expect(buildWorkspaceAdminIntegrationUrl("domains", "acme-demo")).toBe(
        "/dashboard/integrations?tab=domains&workspace=acme-demo",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is a file:// URL", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "file:///etc/passwd";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys", "acme-demo")).toBe(
        "/dashboard/integrations?tab=api-keys&workspace=acme-demo",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL embeds userinfo (defense-in-depth)", () => {
      // Even though `URL.origin` strips userinfo, we explicitly reject URLs
      // that contain embedded credentials so an operator-misconfigured env
      // value with `user:pass@host` form is never silently consumed.
      process.env.NEXT_PUBLIC_AUTH_APP_URL =
        "https://attacker:secret@auth.xynes.example";

      expect(buildWorkspaceAdminIntegrationUrl("domains", "acme-demo")).toBe(
        "/dashboard/integrations?tab=domains&workspace=acme-demo",
      );
    });

    it("falls back to a relative path when NEXT_PUBLIC_AUTH_APP_URL is a data: URL", () => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL =
        "data:text/html,<script>1</script>";

      expect(buildWorkspaceAdminIntegrationUrl("api_keys", "acme-demo")).toBe(
        "/dashboard/integrations?tab=api-keys&workspace=acme-demo",
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
          const url = buildWorkspaceAdminIntegrationUrl(target, "acme-demo");
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

  describe("workspace slug handoff (FE-XAPP-BUG-001)", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://auth.xynes.example";
    });

    it("URL-encodes slugs that contain reserved characters", () => {
      // Slugs are normally alphanumeric + hyphens, but encode defensively
      // so a future slug rule (or stray whitespace inside an otherwise
      // valid slug) never produces a broken query string.
      const url = buildWorkspaceAdminIntegrationUrl(
        "domains",
        "acme demo & co",
      );

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=domains&workspace=acme%20demo%20%26%20co",
      );
    });

    it("omits the workspace query param entirely when the slug is empty", () => {
      // Empty slug = "I don't know the originating workspace". Don't send
      // `workspace=` (which would still parse as the empty string on the
      // recipient side and be confusing); just leave it out so the Auth
      // App falls through to its existing localStorage-based selection.
      const url = buildWorkspaceAdminIntegrationUrl("domains", "");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=domains",
      );
    });

    it("omits the workspace query param when the slug is only whitespace", () => {
      const url = buildWorkspaceAdminIntegrationUrl("api_keys", "   ");

      expect(url).toBe(
        "https://auth.xynes.example/dashboard/integrations?tab=api-keys",
      );
    });
  });
});
