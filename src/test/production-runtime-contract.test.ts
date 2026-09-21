import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");

async function readRepoFile(path: string) {
  return readFile(resolve(repoRoot, path), "utf8");
}

describe("CMS-REL-1 standalone production runtime contract", () => {
  it("enables standalone output and traces linked packages from the frontend root", async () => {
    const config = await readRepoFile("next.config.ts");

    expect(config).toMatch(/output:\s*["']standalone["']/);
    expect(config).toMatch(/outputFileTracingRoot:/);
    expect(config).toMatch(/path\.resolve\(__dirname,\s*["']\.\.["']\)/);
  });

  it("uses pinned Alpine stages with frozen pnpm installs", async () => {
    const dockerfile = await readRepoFile("Dockerfile");

    expect(dockerfile).toMatch(
      /FROM node:20-alpine@sha256:[a-f0-9]{64} AS base/,
    );
    expect(dockerfile).toMatch(/FROM base AS dev/);
    expect(dockerfile).toMatch(/FROM base AS build/);
    expect(dockerfile).toMatch(
      /FROM node:20-alpine@sha256:[a-f0-9]{64} AS prod/,
    );
    expect(dockerfile).toContain(
      "apk add --no-cache --upgrade libcrypto3=3.5.8-r0 libssl3=3.5.8-r0",
    );
    expect(dockerfile).toContain("corepack prepare pnpm@10.33.0 --activate");
    expect(dockerfile).toContain("--frozen-lockfile");
  });

  it("requires explicit public build configuration and builds every linked package", async () => {
    const dockerfile = await readRepoFile("Dockerfile");

    for (const buildArgument of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_API_URL",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_AUTH_APP_URL",
      "NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS",
      "XYNES_BUILD_VERSION",
    ]) {
      expect(dockerfile).toContain(`ARG ${buildArgument}`);
      expect(dockerfile).toContain(`test -n "$${buildArgument}"`);
    }

    for (const buildCommand of [
      "pnpm --dir xynes-i18n build",
      "pnpm --dir xynes-auth-sdk build",
      "pnpm --dir lumia-ds/packages/icons build",
      "pnpm --dir lumia-ds/packages/components build",
      "pnpm --dir lumia-ds/packages/editor build",
      "pnpm --dir lumia-ds/packages/layout build",
      "pnpm --dir lumia-ds/packages/marketing build",
      "pnpm --dir xynes-cms-console-web exec next build",
    ]) {
      expect(dockerfile).toContain(buildCommand);
    }
  });

  it("copies only traced runtime assets into the non-root production stage", async () => {
    const dockerfile = await readRepoFile("Dockerfile");
    const prodStage = dockerfile.slice(dockerfile.lastIndexOf(" AS prod"));

    expect(dockerfile).toContain(
      "find -L /app/xynes-cms-console-web/.next/standalone -type l -delete",
    );
    expect(prodStage).toContain(
      "/app/xynes-cms-console-web/.next/standalone/",
    );
    expect(prodStage).toContain(
      "/app/xynes-cms-console-web/.next/static/",
    );
    expect(prodStage).toContain("/app/xynes-cms-console-web/public/");
    expect(prodStage).toMatch(/adduser[^\n]*nextjs/);
    expect(prodStage).toMatch(/USER nextjs/);
    expect(prodStage).not.toMatch(/COPY\s+\.\s+\./);
    expect(prodStage).not.toMatch(/COPY --from=build[^\n]*node_modules/);
    expect(prodStage).toContain("find -L node_modules -type l");
  });

  it("binds port 3000 and runs the traced server with writable cache in tmp", async () => {
    const dockerfile = await readRepoFile("Dockerfile");

    expect(dockerfile).toContain("ENV HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain("ENV PORT=3000");
    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain("chown nextjs:nodejs /tmp/next-cache");
    expect(dockerfile).toContain("ln -s /tmp/next-cache .next/cache");
    expect(dockerfile).toContain("mkdir -p /tmp/next-cache");
    expect(dockerfile).toContain("exec node server.js");
  });

  it("uses the binding Docker healthcheck path and timing", async () => {
    const dockerfile = await readRepoFile("Dockerfile");

    expect(dockerfile).toContain(
      "HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3",
    );
    expect(dockerfile).toContain(
      "wget -qO- http://127.0.0.1:3000/api/health",
    );
  });

  it("documents the parent build context and filters secrets and build debris", async () => {
    const dockerfile = await readRepoFile("Dockerfile");
    const dockerignore = await readRepoFile("Dockerfile.dockerignore");

    expect(dockerfile).toContain(
      "docker buildx build -f xynes-cms-console-web/Dockerfile",
    );
    for (const pattern of [
      "**/.git",
      "**/.env*",
      "**/.pnpm-store",
      "**/node_modules",
      "**/.next",
      "**/coverage",
      "**/test",
      "**/tests",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/test-results",
      "**/playwright-report",
      "**/docs",
    ]) {
      expect(dockerignore).toContain(pattern);
    }
  });
});
