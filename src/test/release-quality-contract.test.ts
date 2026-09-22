import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "../..");
const frontendRoot = resolve(repoRoot, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("CMS-REL-2 release quality contract", () => {
  it("exposes deterministic code and release verification scripts", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      build:
        "NODE_ENV=production node ../infra/scripts/with-env.mjs next build --webpack",
      typecheck: "node ../infra/scripts/with-env.mjs tsc --noEmit",
      "verify:code":
        "pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build",
      "test:e2e:release": "pnpm test:e2e -- --grep @release",
      "verify:release": "pnpm verify:code && pnpm test:e2e",
    });
  });

  it("keeps every configured coverage threshold at or above 80 percent", () => {
    const vitestConfig = readRepoFile("vitest.config.ts");

    for (const dimension of ["lines", "functions", "branches", "statements"]) {
      const match = vitestConfig.match(
        new RegExp(`\\b${dimension}\\s*:\\s*(\\d+)`),
      );
      expect(match, `missing ${dimension} coverage threshold`).not.toBeNull();
      expect(Number(match?.[1]), `${dimension} coverage threshold`).toBeGreaterThanOrEqual(
        80,
      );
    }
  });

  it("defines a least-privilege, non-deploying sibling-checkout workflow", () => {
    const workflowPath = resolve(repoRoot, ".github/workflows/quality.yml");
    expect(existsSync(workflowPath), "quality workflow must exist").toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
    expect(workflow).toMatch(/pull_request:[\s\S]*develop[\s\S]*main[\s\S]*release\/\*/);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*true/);
    expect(workflow).not.toMatch(/^\s*push:\s*$/m);
    expect(workflow).not.toMatch(/packages:\s*write|id-token:\s*write|environment:/);
    expect(workflow).not.toMatch(/docker\s+(login|build|push)|\bdeploy\b|\bssh\b/i);

    for (const path of [
      "xynes-cms-console-web",
      "infra",
      "lumia-ds",
      "xynes-auth-sdk",
      "xynes-i18n",
    ]) {
      expect(workflow).toContain(`path: ${path}`);
    }

    for (const repository of [
      "Xynes-Studio/xynes-frontend-infra",
      "Xynes-Studio/lumia-ds",
      "Xynes-Studio/xynes-auth-sdk",
      "Xynes-Studio/xynes-i18n",
    ]) {
      expect(workflow).toContain(`repository: ${repository}`);
    }

    expect(workflow).toContain("secrets.XYNES_REPO_READ_TOKEN");
    expect(workflow).toMatch(/corepack enable/);
    expect(workflow).toMatch(/pnpm install --frozen-lockfile/);
    expect(workflow).toMatch(/pnpm verify:release/);
    expect(workflow).toMatch(/if:\s*failure\(\)/);
    expect(workflow).toMatch(/retention-days:\s*[1-7]\b/);
  });

  it("uses the Next.js 16 Proxy convention without retaining middleware", () => {
    expect(existsSync(resolve(repoRoot, "proxy.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "proxy.test.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "middleware.ts"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "middleware.test.ts"))).toBe(false);

    const proxySource = readRepoFile("proxy.ts");
    const vitestConfig = readRepoFile("vitest.config.ts");
    expect(proxySource).toMatch(/export function proxy\s*\(/);
    expect(proxySource).not.toMatch(/export function middleware\s*\(/);
    expect(vitestConfig).toContain('"proxy.test.ts"');
    expect(vitestConfig).not.toContain('"middleware.test.ts"');
  });

  it("mounts proxy.ts into the CMS development container", () => {
    const compose = readFileSync(
      resolve(frontendRoot, "infra/docker-compose.dev.yml"),
      "utf8",
    );

    expect(compose).toContain(
      "../xynes-cms-console-web/proxy.ts:/app/proxy.ts:cached",
    );
    expect(compose).not.toContain(
      "../xynes-cms-console-web/middleware.ts:/app/middleware.ts:cached",
    );
  });
});
