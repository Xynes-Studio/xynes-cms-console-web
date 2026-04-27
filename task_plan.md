# Task Plan — CMS Workspace Admin Contextual UI

Goal: ship the CMS contextual integrations page that consumes Workspace Admin
primitives (verified domains, workspace API keys, future webhooks) without
duplicating any global lifecycle forms in CMS.

Plan source of truth:
- `xynes/xynes-infra/docs/plans/2026-04-24-workspace-admin-integrations-cms-contextual-ui.md`

Branch:
- `feat/cms-workspace-admin-contextual-ui`

Tasks (TDD red → green for every task):

1. Workspace Admin link builder — `src/features/integrations/workspace-admin-links.ts`
   - Tests: tab=domains, tab=api-keys, preset=cms_readonly, preset=cms_publisher,
     malformed/missing/`javascript:`/`file:` fallbacks to relative path.
2. Read-only workspace integration status client —
   `src/lib/dashboard/workspace-integrations-client.ts`
   - Tests: GET domains + api-keys, envelope unwrap, count derivation by status
     and preset/scope, never leak `rawKey`/`keyHash`, fail closed on every
     error/malformed path, AbortSignal forwarded.
3. CMS Integrations Panel — `src/features/integrations/CmsIntegrationsPanel.tsx`
   - Tests: heading, no placeholder, four cards with correct deep links, no
     add-domain or create-api-key forms, future-webhooks card is informational
     only, count rendering, unavailable state, gated effect, malformed env
     fallback.
4. Replace placeholder route — `app/dashboard/[workspaceSlug]/integrations/page.tsx`
   - Tests: renders the new panel and forwards `workspaceSlug`; no
     coming-soon placeholder.
5. Verification:
   - targeted task tests
   - full `pnpm test`
   - `pnpm test:coverage` (>= 80% per ADR-001)
   - `pnpm lint`
6. Documentation:
   - `docs/DEVELOPER.md` adds Workspace Admin Integrations consumer contract.
   - Workspace `AGENTS.md` updated with the actual landed scope.
   - Implementation plan checklist marked complete with verification evidence.
