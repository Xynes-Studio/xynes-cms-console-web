# Progress — CMS Workspace Admin Contextual UI

## 2026-04-27 — Initial implementation

- Confirmed scope from
  `xynes/xynes-infra/docs/plans/2026-04-24-workspace-admin-integrations-cms-contextual-ui.md`
  and the Workspace Admin epic.
- Confirmed backend prerequisites: gateway healthy on `http://localhost:4100`;
  workspace integration routes seeded and live.
- Branch `feat/cms-workspace-admin-contextual-ui` confirmed checked out.
- TDD task 1 — `workspace-admin-links.ts`: 11 failing tests → implemented
  builder with `URL.origin` allowlist for `http(s)` and relative-path
  fallback for everything else → 11 pass.
- TDD task 2 — `workspace-integrations-client.ts`: 11 failing tests →
  implemented client reusing `gateway-client-utils`, fails closed on every
  error path, never returns raw key material → 11 pass.
- TDD task 3 — `CmsIntegrationsPanel.tsx`: 13 failing tests → implemented
  panel with Lumia DS primitives → 13 pass.
- TDD task 4 — replaced placeholder route → 2 pass.
- Initial pass: 37/37 task tests, 402/402 full repo, lint clean,
  coverage ≥ 92% lines on every new file.

## 2026-04-27 — Revalidation pass

- Re-read every new file against the user's revalidation checklist:
  segregation, redundancy, future tech debt, ADR-001 coverage, security,
  a11y, Lumia-DS conformance, lint.
- Issues found and fixed:
  1. **Redundancy:** `UNAVAILABLE_STATUS` was duplicated in the panel and
     the client. → Exported a single canonical
     `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS` from the client and
     `Object.freeze`d it; the panel imports it.
  2. **A11y / HTML validity:** the panel was rendering deep links as
     `<Button asChild={false}><a>...</a></Button>`. Lumia `Button` is a real
     `<button>` element with no `asChild` prop, so the `<a>` was nested
     inside `<button>` (invalid interactive nesting). → Replaced with a
     native `<a>` styled with Lumia's exported `buttonStyles`. Added a
     test that asserts `tagName === "A"` and `closest("button") === null`.
  3. **A11y "opens in new tab" parity:** external links had only a visible
     `↗` glyph. → Added a sr-only "(opens in new tab)" span; assertion
     uses `toHaveAccessibleName(/opens in new tab/i)`.
  4. **A11y test fidelity:** the Alert mock returned `role="status"`, but
     real Lumia maps `variant="warning"` → `role="alert"`. → Updated mock
     to mirror the real role mapping; added a `getByRole("alert")` test.
  5. **Active-context UX / dead prop:** `_props.workspaceSlug; void _...`
     was a tech-debt smell. → Surfaced the slug in the page header
     (test id `cms-integrations-workspace-slug`).
  6. **Dead field:** `tone: "warn"` on the metric type was never read.
     → Removed.
  7. **JSX duplication:** four near-identical IntegrationCard call sites.
     → Extracted pure `buildIntegrationCards({ status })` helper.
  8. **Route doc:** the route page had no JSDoc explaining the contract.
     → Added JSDoc explaining ownership and the "thin orchestrator" rule.
  9. **Vacuous "no leak" test:** the original test stringified an object
     we built ourselves. → Added a stronger test that injects hostile
     fields (`rawKey`, `keyHash`, `internalAuditNote`) into the upstream
     gateway payload and asserts the returned object's keys are exactly
     the documented contract.
- Final results:
  - 44 task tests pass (`pnpm vitest run` on the four task files)
  - 409/409 full repo tests pass (`pnpm test`)
  - `pnpm lint`: clean
  - Coverage (`pnpm test:coverage`): overall lines **92.2%**, branches
    **85.78%**, funcs **94.9%**, statements **92.2%**; new files all
    above the ADR-001 80% floor (`workspace-admin-links.ts` at 100%
    across the board)
- Documentation refreshed:
  - `docs/DEVELOPER.md` "Workspace Admin Integrations (CMS Contextual
    Consumer)" — added canonical-sentinel rule, native-anchor rule,
    accessibility contract, and updated test ownership.
  - Workspace `AGENTS.md` — updated landing note with revalidated
    numbers and rules.
  - Implementation plan checklist — appended a 2026-04-27 verification
    section with the new test counts and the redundancy/tech-debt
    cleanup list.
- Manual browser smoke remains the only outstanding gate (route is
  auth-gated; visual confirmation must be done in a logged-in session).

---

# Progress — CMS-REL-1 Production Runtime and Health

## 2026-09-21 — Started

- Activated the release-runtime story as the current goal.
- Loaded the test-driven-development, Next.js best-practices,
  planning-with-files, and verification-before-completion instructions.
- Confirmed the starting branch is `develop`, aligned with
  `origin/develop`, with only the two newly authored CMS release-story files
  untracked.
- Created this phase-based execution log before modifying product code.
- Fetched `origin` and confirmed `develop` remains exactly at
  `af35ecca488d145e22d09d94bb6add91d736d640` with zero divergence.
- Created local branch `feature/cms-release-runtime-hardening` and restored the
  two release-story documents and working notes onto it.
- Started Docker Desktop for local safety/runtime validation.
- Created the pre-work database backup outside Git at
  `/private/tmp/xynes-cms-rel-1-prework-20260921.dump` (4.9 MiB,
  SHA-256 `fdaa77c1846931d307d1c5a3338cca0ea4836b0dd8dd3740339498c733846dbb`).
- Proved recoverability by restoring the custom-format archive into the
  isolated `cms_rel_1_restore_verify_20260921` database with
  `supabase_admin`: source and restored databases both contained 77 user
  tables and 17 Supabase migration records. The isolated database was then
  removed; the backup artifact remains available outside Git.
- Initial lint and typecheck completed successfully. The first coverage run
  overlapped the restarted dev container rebuilding the bind-mounted auth SDK:
  58 suites/700 tests passed and six suites failed collection on a transiently
  missing SDK output. The container is now healthy; a clean baseline rerun is
  required before treating coverage as evidence.
- Clean baseline rerun after the dev container became healthy: 64/64 test
  files and 736/736 tests passed; coverage was 94.15% statements, 87.69%
  branches, 95.96% functions, and 94.15% lines. The production build also
  passed outside the sandbox; its only warning is the pre-existing Next.js
  middleware deprecation owned by CMS-REL-2.
- Health TDD RED: both focused suites failed collection because the new
  `health.ts` contract module did not exist.
- Health TDD GREEN: implemented the closed gateway-aware contract; 15/15
  focused health tests pass, covering healthy/degraded responses, exact schema,
  timeout, 30-second failed-probe cache and expiry, no success caching,
  in-flight de-duplication, local-only fallback, invalid configuration, integer
  uptime, JSON content type, no-store, and redaction.
- Runtime TDD RED: all seven production-runtime contract tests failed because
  standalone output and Docker artifacts were absent.
- Runtime source GREEN: enabled standalone output with the frontend tracing
  root and added the pinned multi-stage Dockerfile plus context filter; all
  seven runtime contract tests pass (22/22 story-focused tests total).
- Built the production target from the `xynes-front-end/` parent context with
  frozen lockfiles and non-secret fixtures. The final image is 177,220,888
  bytes, runs as `nextjs` (UID/GID 1001), exposes port 3000, contains the exact
  30s/5s/15s/3 healthcheck, and has no dangling symlinks.
- Runtime validation passed with a deterministic one-hop gateway stub. Under a
  read-only root filesystem, tmpfs `/tmp`, and no-new-privileges, the final
  container reached `healthy`, returned the exact HTTP 200 JSON contract, served
  the landing page and a traced static chunk, rejected writes under `/app`, and
  allowed temporary writes only under `/tmp`.
- Degraded validation passed after stopping only the isolated gateway stub:
  `/api/health` returned the exact HTTP 503 contract in 88 ms, a repeated cached
  response returned in 19 ms, and Docker reached `unhealthy` after three probe
  failures using an accelerated local interval override. The baked image timing
  remains the binding 30s/5s/15s/3 configuration.
- Trivy 0.66.0 initial scan found four fixable HIGH Alpine findings (two OpenSSL
  CVEs duplicated across `libcrypto3`/`libssl3`) and zero CRITICAL or
  language-package findings. Added a RED source-contract guard, pinned both
  runtime libraries to fixed 3.5.8-r0 revisions, rebuilt, and rescanned. Final
  result: zero HIGH, zero CRITICAL, and no secret findings; no `CVE-WAIVERS.md`
  is required.
- Expanded the health tests and extracted the default dependency factory.
  Focused health coverage is now 100% statements, branches, functions, and
  lines (20/20 tests).
- Final repository gates passed after the implementation and documentation
  changes: lint clean, strict TypeScript clean, 66/66 test files and 762/762
  tests green. Overall coverage is 94.23% statements, 88.00% branches, 96.08%
  functions, and 94.23% lines; both health modules are 100% on every axis.
- The final clean production rebuild emitted image
  `sha256:3357484c3db8df110c1339ab6ab5a619cc426362f823868b15b5260447f3665c`
  at 183,080,546 bytes. It runs as `nextjs`, retains the exact 30s/5s/15s/3
  image healthcheck, and contains no dangling runtime symlinks.
- Final runtime revalidation against that exact image passed: health returned
  HTTP 200 with the closed schema; `/`, `/SECURITY.md`, and a generated static
  chunk returned 200; the process ran as UID/GID 1001; `/app` writes were
  rejected while `/tmp` writes succeeded. With the gateway stopped, health
  returned 503 in 50 ms and the cached response in 18 ms; an accelerated local
  check schedule proved the container transitions to `unhealthy`.
- Final Trivy 0.66.0 vulnerability and secret scan returned zero HIGH, zero
  CRITICAL, and zero secret findings. No waiver file is needed.
- Final host production build passed and emitted
  `.next/standalone/xynes-cms-console-web/server.js`. The only warning remains
  the pre-existing middleware-to-proxy deprecation assigned to CMS-REL-2.
- The optional read-only Playwright regression check surfaced an unchanged
  scroll-layout timing flake: 18/19 passed in the full run, and the isolated
  case passed 3/5 repetitions. CMS-REL-1 owns neither `e2e/*` nor the scroll
  implementation and its story explicitly assigns Playwright certification to
  CMS-REL-2, so no cross-story files were modified. This exact failure is a
  required CMS-REL-2 follow-up before combined release certification.
- Code-simplifier and local security review found no P0/P1/P2 issue in the
  CMS-REL-1 diff and no behavior-preserving refactor worth taking after the
  complete test evidence. `git diff --check` is clean.
- The final-image protected-route smoke returned HTTP 307 to the configured
  auth application, preserving the existing unauthenticated dashboard policy.
- Created the human handoff at
  `docs/manual-verification/CMS-REL-1-production-runtime.md`, including the
  exact validated implementation SHA, image identity, all acceptance evidence,
  reproducible commands, cleanup/rollback, and the CMS-REL-2 browser follow-up.
- Trivy 0.66.0 source-context secret scan completed read-only with generated
  output and dependency directories excluded: no issues detected, exit code 0.

---

# Progress — CMS-REL-1 Defect Remediation

## 2026-09-22 — Started

- Loaded the planning, TDD, Next.js/React, Playwright, and verification
  instructions before changing product code.
- Confirmed branch `feature/cms-release-runtime-hardening` at `1eac9ad`.
- Preserved the pre-existing dirty `middleware.ts` and `middleware.test.ts`
  changes and the two manual-verification documents.
- Read all seven defect records and created the sequential remediation plan.
- Began phase 1 ownership/source/test mapping; no product code has been changed
  in this remediation phase yet.
- Located the existing URL query-state implementation for list/grid preference,
  the content toolbar, the CMS editor lifecycle state, and the dedicated
  scroll-layout fixture/spec. Narrow source inspection is next.
- Confirmed source ownership for BUG-002, BUG-004, and BUG-005. No code change
  has been made; each will receive a failing regression test first.
- Began BUG-001 diagnosis in the clean sibling Auth repository. No sibling
  repository mutation has been made.
- Narrowed BUG-001 to a probable duplicate client-callback execution race; the
  next step is to confirm it with the existing callback-page test harness.
- BUG-001 TDD RED: added an Auth callback Strict Mode regression on sibling
  branch `feature/cms-rel-1-auth-callback-hardening`; targeted run failed as
  expected because the same implicit callback was processed repeatedly and
  the error UI appeared instead of redirecting.
- BUG-001 TDD GREEN: added single-flight callback lifecycle handling in
  `xynes-auth-app/src/app/callback/client/page.tsx`; the focused suite is 8/8
  green. Full Auth quality gates and manual Google OAuth revalidation remain.
- BUG-002 design selected: preserve a validated query allowlist on content-to-
  content path navigation, with no localStorage duplication. Failing shell and
  breadcrumb integration tests are being added next.
- BUG-002 TDD RED: the two new integration assertions failed on path-only
  navigation as expected. A shared pure query-state module will be introduced
  and used by the hook, shell, and breadcrumb paths.
- BUG-002 TDD GREEN: both navigation owners now preserve canonical CMS query
  state through directory path changes. Full CMS unit/integration suite passes
  765/765 tests across 66 files.
- Identified BUG-006's layout-feedback loop and the missing bottom-of-list test
  coverage. No fix has been written yet.
- Completed initial ownership mapping for all seven bugs. BUG-001 is the first
  implementation target and will be isolated on a sibling Auth feature branch.
- BUG-004 design confirmed: extend grid mapper/card props with the existing
  action handlers and pending flags, render separate non-nested open/menu
  controls, and add the missing localized menu-trigger label. Focused failing
  component and mapper regressions are next.
- Verified the repository already uses Lumia `MenuTrigger asChild`,
  `MenuContent`, and `MenuItem` in the editor, so BUG-004 will follow that
  established component contract rather than introduce a custom popover.
- BUG-004 TDD RED is captured: the existing grid card has no action trigger or
  action menu, and its mapper drops favorite/pending state plus all non-open
  handlers. The full repository run failed only the four new grid assertions
  (764 other tests passed).
- BUG-004 implementation now exposes a localized three-dot Lumia menu with
  delete/share/favorite actions, uses a separate real open button (no nested
  controls), and forwards mutation handlers plus pending state through the
  mapper/panel. Unit regression is 768/768 green and strict TypeScript is
  clean; panel integration coverage and lint remain before phase closure.
- BUG-005 TDD RED is captured: logout still renders no accessible busy state,
  no inert interaction boundary, and a synchronous App Router failure escapes
  to the caller. The other 768 tests remain green.
- BUG-005 TDD GREEN: logout is guarded by a ref-backed single-flight latch,
  renders a full-screen accessible busy overlay, makes the protected shell
  inert/aria-hidden, and restores interaction with localized feedback when
  navigation throws. Full CMS unit/integration is 770/770; lint and strict
  TypeScript are clean.
- BUG-006 TDD GREEN: scroll state now records viewport geometry and ignores
  only a bottom clamp caused by an increased `clientHeight`; a genuine upward
  scroll with unchanged geometry still reveals the row. Full unit/integration
  is 772/772. The dedicated Playwright regression passed five rapid desktop
  bottom-scroll repetitions in one run (1/1 spec, 4.6 s test body).
- BUG-003 TDD RED confirmed the remaining gap was not Lumia `Button`, whose
  39 cursor/button contract tests pass, but CMS lifecycle `MenuItem` call sites
  inheriting Radix's `cursor-default`. CMS now opts those lifecycle actions
  into pointer/not-allowed affordances without changing the global DS rule.

## 2026-09-23 — Final hardening and handoff

- Upgraded CMS Vitest/coverage to 4.1.11 and synchronized the package tree to
  Next 16.3.5 / React 19.3.0. Added narrowly scoped patched transitive
  resolutions. CMS full and production audits now contain zero high/critical
  findings (full: two moderate and one low; production: one low).
- Fixed the two constructable `Intl.DateTimeFormat` test spies required by
  Vitest 4; the focused card suites pass 39/39.
- Dependency-refreshed browser testing reproduced BUG-006 intermittently with
  a 52 px result-viewport mismatch. Added a failing real-browser assertion
  proving the secondary shell must not animate `max-height`.
- Final BUG-006 correction keeps the last positive row measurement and removes
  layout-changing max-height animation while retaining border/inner-row visual
  transitions. Ten independent Chrome runs with five rapid bottom-scroll
  repetitions each passed (50/50).
- Hardened the BUG-001 owning Auth app to Next 15.5.26, Vitest 4.1.11, Vite
  7.3.6, sharp 0.35.4, and patched transitive resolutions. Its production
  dependency audit now has zero high/critical findings and one low.
- Added focused Auth edge-case tests for the OAuth callback, safe origins,
  member API failure handling, and profile API normalization/errors. Auth now
  passes 90 files and 998 tests with all aggregate coverage metrics at or above
  85%; the changed callback page is included in the measured scope.
- Closed every independent review finding: both Vitest configs enforce 85%,
  Auth measures the callback page, logout uses a hard document replacement
  with bounded recovery, the grid exposes an actionable localized Unfavourite
  label, and the native open button contains only valid phrasing content. The
  Share manual step now verifies the clipboard URL and success toast.
- Updated the bug report and historical regression checklist without erasing
  the original manual findings. Created
  `CMS-REL-1-defect-fixes-manual-verification.md` with independent steps for
  every defect, evidence fields, responsive matrix, security checks, cleanup,
  and release sign-off.
- BUG-007 is closed locally on the canonical port-3000 stack. A
  `workspace_member` denial renders safe role-aware feedback, while a temporary
  `content_editor` role completed the upload/save/hard-refresh/delete path.
  The investigation also found and fixed Lumia's file-picker omission of the
  stable `objectId`; persisted CMS JSON now contains the UUID with an empty
  `src`, and no provider signature material remains in content or logs.
- All BUG-007 test entries, the exact uploaded storage object, and the temporary
  role assignment were removed after verification. The original user role and
  the three pre-existing content entries remain intact.
- Final CMS validation is green: lint, strict TypeScript, 66 files / 777 tests,
  91.45/85.13/97.12/92.07 aggregate coverage, production build, and 20/20
  Playwright tests. Final CMS audits contain only two moderate and one low in
  the full tree and one low in production.
- Final Auth validation is green: lint, sequential strict TypeScript, 90 files /
  998 tests, 91.72/85.15/93.48/93.37 aggregate coverage, Next 15.5.26 build,
  and a production audit with one low finding only.
- Final diff checks pass in all three changed repositories, and a redacted added-line scan
  found zero private-key, AWS-key, Xynes raw API-key, or JWT-shaped values.
- Lumia's two changed files pass ESLint and the focused 10-test file-picker
  suite. The editor's containerized full suite passes 1,190 tests with two
  skips, and its production ESM/DTS build passes. Host-wide lint still exposes
  formatting-only findings in unrelated files that are unchanged from the
  current Lumia `develop` baseline; they were not folded into this defect fix.

## 2026-09-24 — Completion audit

- Completion-audit rerun on the final working tree: CMS lint, strict
  TypeScript, 777-test coverage, production build, and 20/20 Playwright all
  pass; Auth lint, strict TypeScript, 998-test coverage, and production build
  pass; the containerized Lumia editor lint and ESM/DTS build pass. Frontend
  health reports Auth/CMS/Supabase/API healthy, and all 14 backend
  health/readiness probes return HTTP 200.
- A fresh external npm advisory request was attempted but policy rejected
  transmitting the private dependency manifest without explicit user consent.
  No dependency file changed after the previously recorded zero-high/critical
  production audits, and the final added-line secret scan is 0 in CMS, Auth,
  and Lumia.

## 2026-09-30 — Combined CMS/Auth regression planning

- Started a source-derived whole-CMS/Auth and CMS API regression redesign.
- Preserved the dirty CMS-REL-1 feature checkout and fetched CMS `develop`
  without switching or resetting it.
- Initial `gh pr list` showed PR #49 as the newest merged PR visible in the CMS
  repository; an organization-wide RDL2 search is being corrected after a
  one-time CLI flag mismatch.
- Corrected `gh` searches completed: no merged PR is indexed as RDL2/RDL-2/RDL.
  A fresh fetch confirms the latest visible CMS `develop` is commit
  `af35ecca488d145e22d09d94bb6add91d736d640` from PR #49. Planning proceeds
  against that pinned ref without modifying the dirty feature checkout.
- Fetched and pinned the latest visible `develop` refs for Auth app/SDK,
  gateway, CMS Core, accounts, authz, and storage. `xynes-infra` remote fetch
  returned `Repository not found`; its existing local `origin/develop`
  (`792803db...`) is retained as the explicitly unverified infra pin.
- Inventoried the visible CMS and Auth route surfaces and their repository test
  commands. The combined suite must fill the current cross-app E2E gap while
  preserving human ownership of real OAuth and subjective visual checks.
- Inventoried CMS dashboard/public API routes and found an existing full
  multi-preset API-key smoke harness. The new API checklist will reuse that
  harness for agent-owned local coverage and add a non-secret, provided-key
  black-box lane for the single key the user plans to supply.
- Created and validated `docs/manual-verification/CMS-COMBINED-RELEASE-REGRESSION.md`.
  It pins the visible source refs, separates smoke/full/human lanes, covers the
  CMS/Auth/service topology and lifecycle, and defines cleanup and release
  gates.
- Created and validated `docs/manual-verification/CMS-API-KEY-REGRESSION.md`.
  It separates a supplied-key black-box run from the existing destructive
  local full-matrix harness, documents preset/action-key boundaries, and
  includes secret-safety, isolation, cleanup, and evidence rules.
- `git diff --check` passes for both new checklists and the planning records.
  No release suite, deployment, key handling, or persistent test-data mutation
  was performed during checklist creation.
