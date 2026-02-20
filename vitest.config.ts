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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
