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
