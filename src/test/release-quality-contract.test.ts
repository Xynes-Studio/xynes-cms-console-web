import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "../..");

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

  it("loads the Vitest config without a runtime vitest/config dependency", () => {
    const vitestConfig = readRepoFile("vitest.config.ts");

    expect(vitestConfig).toContain(
      'import type { ViteUserConfig } from "vitest/config";',
    );
    expect(vitestConfig).not.toMatch(
      /import\s+\{\s*defineConfig\s*\}\s+from\s+["']vitest\/config["']/,
    );
  });

  it("defines a least-privilege, non-deploying release workflow", () => {
    const workflowPath = resolve(repoRoot, ".github/workflows/quality.yml");
    expect(existsSync(workflowPath), "quality workflow must exist").toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
    expect(workflow).toMatch(/pull_request:[\s\S]*develop[\s\S]*main[\s\S]*release\/\*/);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/cancel-in-progress:\s*true/);
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[main, develop, "release\/\*"\]/);
    expect(workflow).not.toMatch(/packages:\s*write|id-token:\s*write|environment:/);
    expect(workflow).not.toMatch(/docker\s+(login|build|push)|\bdeploy\b|\bssh\b/i);

    for (const path of [
      "xynes-cms-console-web",
      "lumia-ds",
      "xynes-auth-sdk",
      "xynes-i18n",
    ]) {
      expect(workflow).toContain(`path: ${path}`);
    }

    for (const repository of [
      "Xynes-Studio/lumia-ds",
      "Xynes-Studio/xynes-auth-sdk",
      "Xynes-Studio/xynes-i18n",
    ]) {
      expect(workflow).toContain(`repository: ${repository}`);
    }

    expect(workflow).not.toContain("Xynes-Studio/xynes-frontend-infra");
    expect(workflow).not.toMatch(/\btoken:/);
    expect(workflow).toContain(
      "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
    );
    expect(workflow).toMatch(/version:\s*10\.33\.0/);
    expect(workflow).not.toMatch(/\bnpm install|@v[0-9]\b|ref:\s*develop\b/);
    expect(workflow.match(/persist-credentials:\s*false/g)).toHaveLength(4);
    for (const workingDirectory of ["xynes-auth-sdk", "xynes-i18n"]) {
      expect(workflow).toMatch(
        new RegExp(
          `working-directory: ${workingDirectory}[\\s\\S]*?pnpm install --frozen-lockfile[\\s\\S]*?pnpm build`,
        ),
      );
    }
    expect(workflow).toMatch(
      /working-directory: lumia-ds[\s\S]*?pnpm install --frozen-lockfile[\s\S]*?--filter @lumia-ui\/components\.\.\.[\s\S]*?--filter @lumia-ui\/editor\.\.\.[\s\S]*?--filter @lumia-ui\/marketing\.\.\.[\s\S]*?build/,
    );
    expect(workflow).toMatch(/pnpm install --frozen-lockfile/);
    expect(workflow).toMatch(/pnpm exec eslint \./);
    expect(workflow).toMatch(/pnpm exec tsc --noEmit/);
    expect(workflow).toMatch(/pnpm exec vitest run --coverage/);
    expect(workflow).toMatch(/NODE_ENV=production pnpm exec next build --webpack/);
    expect(workflow).toMatch(/pnpm exec playwright test/);
    expect(workflow).toMatch(/if:\s*failure\(\)/);
    expect(workflow).toMatch(/retention-days:\s*[1-7]\b/);
  });

  it("starts the Playwright server without private infra in CI", () => {
    const playwrightConfig = readRepoFile("playwright.config.ts");

    expect(playwrightConfig).toMatch(
      /process\.env\.CI[\s\S]*pnpm exec next dev[\s\S]*node \.\.\/infra\/scripts\/with-env\.mjs next dev/,
    );
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
});
