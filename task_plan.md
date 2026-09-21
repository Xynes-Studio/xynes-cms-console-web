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

---

# Task Plan — CMS-REL-1 Production Runtime and Health

Goal: complete every ticket in
`docs/plans/2026-09-21-cms-rel-1-production-runtime-and-health.md` on an
isolated local feature branch, with TDD, security hardening, reproducible
container validation, and traceable evidence. No deployment, push, PR, or
merge is in scope.

Branch:
- `feature/cms-release-runtime-hardening`

Phases:

1. **Setup and preservation — complete**
   - Fetch and fast-forward local `develop` from `origin/develop`.
   - Create the feature branch and preserve both release-story documents.
   - Record the starting commit, worktree state, and environment versions.
2. **Safety baseline — complete**
   - Produce a pre-work local database backup when the local database is
     available and prove the archive is readable/restorable without touching
     production data.
   - Run lint, typecheck, tests, coverage, and production build.
3. **Health endpoint (TDD) — complete**
   - Add failing unit/route tests for the exact public contract, timeout,
     failure cache, in-flight de-duplication, and redaction.
   - Implement the smallest gateway-aware, fail-closed health module and thin
     route handler needed to make those tests pass.
4. **Standalone runtime contract (TDD) — complete**
   - Add failing static/runtime contract tests.
   - Enable Next.js standalone output with explicit workspace tracing.
   - Add a multi-stage production Dockerfile and Dockerfile-specific ignore.
5. **Container and security validation — complete**
   - Build and run the image locally from the parent frontend context.
   - Verify healthy/unhealthy behavior, non-root execution, read-only root
     filesystem, tmpfs, no-new-privileges, and no dangling runtime links.
   - Scan the final image for high/critical vulnerabilities; document only
     strictly necessary, time-bounded waivers.
6. **Regression and release evidence — complete**
   - Re-run lint, typecheck, full tests, coverage (all dimensions >=80%), build,
     and story-specific checks.
   - Self-review the diff for security, duplication, regressions, and tech debt.
   - Update runtime documentation, revalidate every acceptance criterion, and
     create the human manual-verification runbook.
7. **Local handoff — in progress**
   - Commit coherent local changes with traceable messages.
   - Report results and any explicit follow-ups. Do not push or deploy.
