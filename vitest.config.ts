import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Keep linked packages resolved through node_modules symlinks so peer deps
    // (react/react-dom) are discovered from this app during tests.
    preserveSymlinks: true,
  },
  esbuild: {
    jsx: "automatic",
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["proxy.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "playwright.config.ts", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "e2e/**",
        "app/e2e/**",
        "src/features/cms-content/CmsContentScrollLayoutFixture.tsx",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
