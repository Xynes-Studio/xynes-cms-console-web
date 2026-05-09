import path from "node:path";
import type { NextConfig } from "next";

const configuredTurbopackRoot = process.env.TURBOPACK_ROOT?.trim();
const turbopackRoot = configuredTurbopackRoot
  ? path.resolve(__dirname, configuredTurbopackRoot)
  : path.resolve(__dirname, "..");

const appReactAliases = {
  react: path.resolve(__dirname, "node_modules/react"),
  "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
  "react/jsx-runtime": path.resolve(
    __dirname,
    "node_modules/react/jsx-runtime.js",
  ),
  "react/jsx-dev-runtime": path.resolve(
    __dirname,
    "node_modules/react/jsx-dev-runtime.js",
  ),
  "react-dom/client": path.resolve(
    __dirname,
    "node_modules/react-dom/client.js",
  ),
  "react-dom/server": path.resolve(
    __dirname,
    "node_modules/react-dom/server.node.js",
  ),
};

const turbopackReactAliases = {
  react: "./node_modules/react",
  "react-dom": "./node_modules/react-dom",
  "react/jsx-runtime": "./node_modules/react/jsx-runtime.js",
  "react/jsx-dev-runtime": "./node_modules/react/jsx-dev-runtime.js",
  "react-dom/client": "./node_modules/react-dom/client.js",
  "react-dom/server": "./node_modules/react-dom/server.node.js",
};

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: turbopackRoot,
    resolveAlias: turbopackReactAliases,
  },
  transpilePackages: [
    "@xynes/auth-sdk",
    "@xynes/i18n",
    "@lumia-ui/components",
    "@lumia-ui/editor",
    "@lumia-ui/layout",
    "@lumia-ui/icons",
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          }
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      react$: appReactAliases.react,
      "react-dom$": appReactAliases["react-dom"],
      "react/jsx-runtime$": appReactAliases["react/jsx-runtime"],
      "react/jsx-dev-runtime$": appReactAliases["react/jsx-dev-runtime"],
      "react-dom/client$": appReactAliases["react-dom/client"],
      "react-dom/server$": appReactAliases["react-dom/server"],
    };

    return config;
  },
};

export default nextConfig;
