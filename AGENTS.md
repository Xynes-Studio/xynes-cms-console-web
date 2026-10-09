<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Feature flag rollout

Before implementing a new remotely controlled feature, agree its exact PostHog
key and ask the owner to create the flag. Confirm that setup before rollout.
Register a conservative default in the auth SDK and gateway, then consume the
existing gateway-backed provider; do not add a separate environment-only gate.
CMS content integrations use the boolean `cms_content_integrations`, default OFF,
targeted by the PostHog `workspace` group. Keep local/CI overrides empty when
verifying PostHog. Feature flags control visibility; API authorization still
applies independently.

## API access panel UX (2026-10-08)

The reusable content API helper is `src/features/content-integrations/ApiAccessSheet.tsx`.
Reuse its folder/entry context and `useIntegrationDialog` scope/focus guards.
Keep Copy within four Tabs from the initially focused title; Close follows content
(owner decision). Editor API sidebar is a publishing hub without inline code.
Keep key lifecycle in Workspace Admin, request generation offline, and live data
read-only during UX verification. Overlay layering belongs to Lumia, never app z-index.
See docs/DEVELOPER.md and docs/manual-verification/CMS-API-ACCESS-PANEL.md.
