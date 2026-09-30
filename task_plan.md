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
7. **Local handoff — complete**
   - Commit coherent local changes with traceable messages.
   - Report results and any explicit follow-ups. Do not push or deploy.

---

# Task Plan — CMS-REL-1 Defect Remediation

Goal: resolve every actionable defect in
`docs/manual-verification/CMS-REL-1-bug-report.md` one by one on
`feature/cms-release-runtime-hardening`, preserve all existing work, leave no
known in-scope tech debt, maintain at least 85% coverage on every reported
metric, and deliver reproducible manual verification steps. No deployment,
push, PR, or merge is in scope.

Branch:
- `feature/cms-release-runtime-hardening`

Execution rules:
- TDD red → green → refactor for every product-code change.
- Preserve the existing `middleware.ts` and `middleware.test.ts` changes unless
  a defect directly requires extending them.
- Do not change an external provider, another repository, or persistent data
  without confirming ownership and authorization.
- Close a bug only with a regression test plus direct behavioral evidence.

Phases:

1. **State preservation and ownership audit — complete**
   - Snapshot branch, dirty files, baseline tests, coverage, and running local
     services.
   - Map BUG-001 through BUG-007 to source files, owning repository, existing
     tests, and any external-state dependency.
2. **BUG-001 Google-login false error — fixed locally; manual OAuth retest pending**
   - Reproduce and identify whether CMS redirect handling or the Auth app owns
     the transient error.
   - Add a failing regression test before any implementation change.
3. **BUG-002 view persistence/navigation refresh — fixed locally; manual browser retest pending**
   - Reproduce list/grid reset and visible folder-navigation refresh.
   - Persist a versioned, validated view preference without weakening URL or
     workspace isolation.
4. **BUG-003 lifecycle hover/focus feedback — fixed locally; manual browser retest pending**
   - Identify affected enabled controls and add accessible hover/focus/pending
     behavior using existing Lumia conventions.
5. **BUG-004 grid entry actions — fixed locally; manual browser retest pending**
   - Add a visible keyboard-accessible overflow trigger with action parity and
     preserved delete confirmation/authorization behavior.
6. **BUG-005 logout blocking state — fixed locally; manual browser retest pending**
   - Add an accessible full-screen busy state that blocks pointer and keyboard
     interaction, clears on failure, and preserves session-protection behavior.
7. **BUG-006 sticky toolbar flicker — code/browser complete**
   - Reproduce the scroll race, add deterministic regression coverage, and
     stabilize scroll state without timers/retry masking.
8. **BUG-007 media-upload denial and persistence — code/browser complete**
   - Confirm the canonical port-3000 failure boundary without exposing
     credentials and render safe role-aware denial feedback.
   - Verify an authorized upload/save/hard-refresh/delete flow against the
     existing local R2-backed stack without changing provider policy.
   - Persist only the stable Lumia image `objectId`; strip transient signed
     delivery URLs before CMS save and verify disposable data cleanup.
9. **Full release validation — automated gates complete; human-only gates pending**
   - Lint, strict TypeScript, full unit/integration tests, coverage with every
     metric >=85%, production build, targeted Playwright/manual regression,
     and security review/scans.
10. **Documentation and handoff — complete**
   - Update bug statuses and checklist with fresh evidence.
   - Create editable manual verification steps for every fix and final
     regression.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Broad `rg` included nonexistent top-level `components/` and produced truncated output | 1 | Scope subsequent searches to `src/components`, `src/features`, and concrete files |
| Auth-app search included nonexistent top-level `app/` and truncated output | 1 | Use the repository's actual `src/app` root and inspect the callback files directly |
| Initial cross-workspace editor search used paths relative to the wrong repository | 1 | Re-ran from the CMS and infra repository roots with explicit sibling paths |
| Direct CMS Vitest run bypassed `with-env.mjs`, causing an unrelated `NEXT_PUBLIC_APP_URL` assertion failure | 1 | Use the package's `pnpm test -- <files>` wrapper for CMS verification |
| New `useSearchParams` dependency broke an i18n test's complete navigation mock | 1 | Added the missing empty search-params mock and reran the full CMS suite green |
| Vitest 4 no longer delegates bare constructor spies | 1 | Made the two `Intl.DateTimeFormat` spies explicit constructable pass-throughs; focused and full tests pass |
| First dependency-refreshed Playwright run exposed a 52 px toolbar race | 1 | Preserved the failure, added geometry evidence, retained positive height measurements, and removed layout-changing max-height animation; 50/50 focused browser repetitions pass |
| Auth typecheck raced with a parallel Next build rewriting `.next/types` | 1 | Build passed; rerun typecheck sequentially after build for authoritative evidence |
| Review found the 85% result was measured but configs still enforced 80%, while Auth excluded all app pages | 1 | Raised both global gates to 85%, explicitly re-included the changed OAuth callback page, added meaningful callback-path tests, and reran coverage green |
| Review found App Router logout failure was not asynchronously observable | 1 | Switched logout to a hard same-origin document replacement with a tested 10-second recovery watchdog |
| Lumia's file-picker upload path discarded the returned storage `objectId`, so CMS could not strip the transient signed URL before save | 1 | Added the stable `objectId` to the uploaded image node, covered present/missing/empty values, rebuilt the linked editor, and verified save/refresh/delete in Chrome |
| Host-wide Lumia editor lint reports formatting-only failures in unrelated unmodified files from the current `develop` baseline | 1 | Kept the CMS-REL-1 diff scoped; the two changed Lumia files pass ESLint, the focused 10-test suite passes, and the editor's full containerized test/build evidence remains authoritative |

---

# Task Plan — Combined CMS/Auth Release Regression and CMS API Validation

Goal: inspect the latest merged CMS `develop` state and create two concise,
editable release artifacts: a whole-product CMS/Auth regression checklist and
an API-key-driven CMS API checklist. Separate agent-executable checks from
human-only verification, minimize duplicate work, and do not deploy or store
credentials in the repository.

Execution rules:

- Preserve the dirty CMS-REL-1 checkout; inspect fetched refs without switching
  or resetting user work.
- Use `gh` for PR metadata and GitHub inspection.
- Derive coverage from current code, route registries, docs, and merged PR
  scope rather than copying stale checklists.
- Treat API keys as ephemeral secrets: environment/in-memory use only, redact
  logs, never write raw keys to Markdown or shell history.
- Prefer one agent smoke pass plus a risk-based full suite; keep visual,
  subjective, and real identity-provider checks human-owned.

Phases:

1. **Latest source and merged-PR identification — complete with documented RDL2 ambiguity**
   - Fetch CMS `develop` and identify the referenced RDL2 merge through `gh`.
   - Record exact commits for CMS, Auth, gateway, CMS Core, and route seeds.
2. **Scope and contract inventory — complete**
   - Inventory current CMS/Auth user flows, services, health checks, and CMS API
     routes/action keys from authoritative source files.
   - Reuse still-valid regression coverage and remove historical duplication.
3. **Combined product regression checklist — complete**
   - Create prioritized smoke/full sections with separate Agent and Human lanes,
     test data, cleanup, evidence fields, and release gates.
4. **CMS API-key checklist — complete**
   - Cover key shape/authentication, allowed scopes, denied scopes, workspace
     isolation, CRUD/lifecycle/read contracts, pagination/filtering, error
     envelopes, rate limits/redaction, cleanup, and a results table.
5. **Documentation validation and handoff — complete**
   - Verify relative links, commands, endpoint ownership, Markdown formatting,
     and secret-safety language; report what is ready now and what awaits the
     user-provided API key.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `gh search prs --state merged` is invalid because search accepts `open` or `closed` | 1 | Use the dedicated `--merged` filter and keep the corrected query scoped to the Xynes-Studio organization |
| Fetching `xynes-infra` `develop` returned GitHub `Repository not found` | 1 | Do not retry blindly; pin the existing local `develop`/`origin/develop` commit `792803db...` and mark remote freshness as unverified in the checklist |
