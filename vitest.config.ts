import path from "node:path";
import type { ViteUserConfig } from "vitest/config";

const config = {
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: path.resolve("node_modules/react/index.js"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: path.resolve("node_modules/react/jsx-runtime.js"),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: path.resolve("node_modules/react/jsx-dev-runtime.js"),
      },
      {
        find: /^react-dom$/,
        replacement: path.resolve("node_modules/react-dom/index.js"),
      },
    ],
    // Resolve pnpm transitive dependencies through their real package paths.
    preserveSymlinks: false,
    // Real Lumia primitives must share the app React runtime (as in Next aliases).
    dedupe: ["react", "react-dom"],
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
    // Bundle linked primitives and their CommonJS peers with the app React aliases.
    deps: {
      optimizer: {
        client: { enabled: true, include: ["@lumia-ui/components"] },
      },
    },
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "proxy.test.ts",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    exclude: ["e2e/**", "playwright.config.ts", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
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
} satisfies ViteUserConfig;

export default config;
