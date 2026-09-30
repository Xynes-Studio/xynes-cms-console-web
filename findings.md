# Findings — CMS Workspace Admin Contextual UI

## Confirmed during initial pass

- Backend stack confirmed running: gateway (`xynes-infra-gateway-1`) healthy on
  `http://localhost:4100`. Workspace integrations routes return `401` to
  unauthenticated calls, confirming routes are seeded by the platform routes
  migration.
- Branch `feat/cms-workspace-admin-contextual-ui` was already checked out at
  start of work (no commits yet vs `origin/main`). Latest commit on `main` is
  `b783371`.
- CMS console uses `pnpm` and Vitest; ADR-001 sets the 80% coverage floor and
  is enforced via `vitest.config.ts` thresholds (lines/branches/funcs/statements
  all `>= 80`).
- Existing dashboard fetch utilities already provide `unwrapGatewayEnvelope`,
  `normalizeGatewayClientInputs`, and bearer-auth fetch patterns under
  `src/lib/dashboard/gateway-client-utils.ts`. The new
  `workspace-integrations-client.ts` reuses those helpers; no parallel
  envelope/auth helpers were introduced.
- The CMS console reads gateway base URL from `NEXT_PUBLIC_API_URL` (not
  `NEXT_PUBLIC_GATEWAY_URL`). The new panel matches this convention.
- Vitest tests that import Lumia components must mock `@lumia-ui/components` to
  avoid the React-version-mismatch error from happy-dom + linked package
  resolution; this is an established pattern used across the repo.
- `cleanup()` from `@testing-library/react` must be called in `afterEach` for
  multi-render component tests in this project — `vitest.setup.ts` only loads
  jest-dom matchers and does not auto-cleanup.
- Lint enforces `react-hooks/set-state-in-effect`: any `setState` call in an
  effect must run inside an async/promise callback, not synchronously in the
  effect body.

## Surfaced during revalidation

- **Lumia `Button` does NOT accept `asChild`.** It is `forwardRef<HTMLButtonElement>`
  with no Radix-style `asChild` slot. Passing `asChild={false}` and a child
  `<a>` produces invalid HTML (`<button><a>...</a></button>`) and an a11y
  violation. The correct pattern for a "link styled like a button" is to
  apply Lumia's exported `buttonStyles` (`base`, `variants`, `sizes`) to a
  native `<a>`.
- **Lumia `Alert` role is variant-aware.** `variant="warning"` and
  `variant="error"` map to `role="alert"` (assertive). Anything else maps
  to `role="status"` (polite). Test mocks must mirror this mapping if the
  test is going to assert role-driven behavior.
- **Single source of truth for fail-closed contracts.** A sentinel constant
  (here, `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS`) must be exported
  from the data-layer module and imported by every consumer. Duplicating
  the literal in each consumer is a tech-debt vector (drift on schema
  change). Freezing the sentinel (`Object.freeze`) is cheap insurance
  against accidental mutation by a future consumer.
- **Tautological "no leak" tests.** A test that stringifies a result we
  control ourselves does not prove the data flow is safe. The stronger
  pattern is: inject hostile fields into the upstream payload (e.g.
  `rawKey`, `keyHash`, `internalAuditNote`) and assert the result's
  `Object.keys(...)` are exactly the documented contract.
- **"Reserved-for-future-use" props are tech debt.** Better practice: drop
  the prop OR use it for genuine UX context. We surface
  `workspaceSlug` in the page header for active-workspace clarity.

## Final result

- All planned tests landed (link-builder, status client, panel, route);
  the full test suite passes and lint is clean as validated by CI on this
  PR. Coverage stays comfortably above the ADR-001 80% floor on every axis
  (lines / branches / funcs / statements), with the pure URL builder
  (`workspace-admin-links.ts`) running near total coverage as a
  representative example. Refer to the latest CI run on the PR for the
  current numeric snapshot rather than embedding totals here.
- No feature flag required for this story. Workspace Admin lifecycle forms
  remain owned by `xynes-auth-app`; CMS only consumes status counts and
  deep-links into Workspace Admin.

---

# Findings — CMS-REL-1 Production Runtime and Health

## 2026-09-21 — Initial constraints

- The repository is an independent Git repository inside a multi-repository
  workspace. Its local linked dependencies live beside it under
  `xynes-front-end/`, so the production image must build from that parent
  directory rather than from the CMS repository alone.
- The story deliberately owns runtime health, standalone build output, and the
  production image. CI workflow, middleware/proxy migration, and Playwright
  certification belong to CMS-REL-2 and must remain untouched.
- The endpoint remains `/api/health`, matching the existing Next.js route and
  the story's documented decision. It must return only the closed health
  schema and never surface upstream bodies, URLs, errors, headers, or secrets.
- No database schema or application-data changes are expected. The requested
  backup is therefore a pre-work safety artifact, not an implementation input,
  and must stay outside Git.
- Starting Docker Desktop restarted the existing development stack. Its CMS
  container bind-mounts the sibling `xynes-auth-sdk` repository and rebuilds
  that package on startup. The first coverage baseline overlapped that rebuild,
  so six suites temporarily observed a missing SDK output even though the
  generated file existed immediately afterward. Baseline verification must be
  repeated only after the dev container reports healthy.
- Local Supabase runs PostgreSQL 17.4 while the host `pg_dump` is 14.20. A
  valid backup therefore has to use the matching `pg_dump` inside
  `supabase_db_xynes-supabase-local`; using the host binary is not portable.
- Restoring the full Supabase archive requires the local `supabase_admin`
  superuser. The ordinary `postgres` role is intentionally non-superuser and
  cannot recreate Realtime functions that set privileged parameters.
- Next standalone tracing from the pre-existing host install produced one
  dangling pnpm `semver@6.3.1` link. A clean Docker install traced the package,
  but the production recipe now defensively removes and then rejects every
  dangling link before copying runtime output. The final image has none.
- A writable `.next/cache` symlink needs its `/tmp/next-cache` target created in
  the image as well as at startup. Creating/chowning it during the image build
  makes static trace inspection clean; recreating it in `CMD` keeps the image
  compatible with a fresh `--tmpfs /tmp` mount.
- The pinned Node Alpine image initially contained OpenSSL 3.5.6-r0. Trivy's
  current database reported CVE-2026-14456 and CVE-2026-45447 as four HIGH
  package findings across `libcrypto3` and `libssl3`. Alpine 3.23 publishes
  3.5.8-r0, so the runtime stage upgrades both packages to that exact revision;
  the rescan is clean and no waiver is necessary.
- The existing Playwright scroll fixture has a reproducible timing race in
  `e2e/cms-dashboard-scroll-layout.spec.ts` around the two synthetic 20 px / 24
  px scroll events. In the final read-only regression run it failed once while
  18 other cases passed; isolated repetition then passed three times and failed
  twice. No CMS-REL-1 file participates in that behavior. The REL-1 story also
  makes `e2e/*`, `playwright.config.ts`, and the scroll implementation out of
  scope, so the evidence is preserved for CMS-REL-2 rather than hidden with a
  retry or an ownership-breaking patch.

---

# Findings — CMS-REL-1 Defect Remediation

## 2026-09-22 — Starting state

- Current repository/branch is `xynes-cms-console-web` on
  `feature/cms-release-runtime-hardening` at `1eac9ad`.
- Pre-existing product changes are limited to `middleware.ts` and
  `middleware.test.ts`; the bug report and manual checklist are untracked.
  These changes must be preserved and reviewed before overlap.
- The authoritative defect set is BUG-001 through BUG-007 in
  `docs/manual-verification/CMS-REL-1-bug-report.md`.
- BUG-001 visibly occurs in the Auth application during Google login, so
  repository ownership is not yet proven. Diagnose before editing either repo.
- BUG-007 may require a live external R2 CORS policy change. Repository-owned
  safeguards/tests can be implemented locally, but external mutation remains
  outside implicit authorization.
- The Playwright CLI prerequisite is available (`npx` present).
- The requested quality floor is 85% for statements, branches, functions, and
  lines; the last recorded baseline was above that floor, but fresh evidence is
  required after remediation.
- BUG-001 is not owned by this CMS repository's visible UI. The sibling
  `xynes-auth-app` repository is clean on `develop`; its OAuth flow is split
  across `OAuthButtons`, `/callback`, and `/callback/client`. The observed
  "try again" text matches the Auth app's safe OAuth callback error copy, so
  those callback transitions are the next authoritative source to inspect.
- BUG-001's most likely race is in Auth's `/callback/client`: the effect can
  execute more than once while handling the same hash tokens, and each run
  calls `supabase.auth.setSession()` independently. A losing concurrent run
  can set the error state while the successful run later redirects, exactly
  matching the observed brief error. The implementation has no idempotency or
  single-flight guard today. This still needs a test that proves duplicate
  effect execution before any fix.
- The Auth OAuth button intentionally directs browser OAuth to
  `/callback/client`, so the server `/callback` exchange path is not the normal
  path for this reproduction. The client callback is the primary owner.
- Existing Auth callback tests do not exercise React Strict Mode or duplicate
  callback execution; all successful tests render once. This is the exact
  coverage gap BUG-001 needs to close.
- BUG-001 RED is confirmed: rendering `/callback/client` under React Strict
  Mode calls the implicit-flow `setSession()` path more than once. The second
  execution exhausts/loses the one-time session result and renders the exact
  error/retry UI. The test failed before implementation with 7 passing and 1
  failing test, and stderr showed repeated callback failures.
- BUG-001 GREEN uses two refs with distinct responsibilities: one prevents a
  second callback transaction, while the other tracks whether the callback
  page is currently active. This is necessary because a simple "started" ref
  would suppress the Strict Mode re-run but the first effect cleanup would
  also prevent the successful transaction from redirecting. Primitive effect
  dependencies (`code`, `error`, `redirect`) avoid object-identity reruns.
- BUG-001 focused verification: Auth callback suite passes 8/8, including one
  `setSession` call under Strict Mode and absence of the false error UI.
- BUG-006's product race is now identifiable: hiding the secondary toolbar
  changes the results viewport height while the user is at/near the bottom.
  The browser clamps `scrollTop`, which looks like an upward user scroll to the
  current state machine (4 px reveal threshold), so it reveals the toolbar;
  the viewport shrinks, `scrollTop` moves down, and the 24 px hide threshold can
  fire again. The scroll state stores only `lastScrollTop`, not viewport
  geometry, so it cannot distinguish layout-induced clamping from user intent.
- The current Playwright spec's `[20, 24]` synthetic scroll pair exercises the
  threshold but does not cover the bottom-of-list viewport-resize loop reported
  manually. A deterministic regression should drive to the bottom and assert
  stability after the CSS transition/layout change.
- BUG-003 is not missing from the current Lumia DS source: the shared `Button`
  already includes `cursor-pointer`, disabled `cursor-not-allowed`, variant
  hover styles, visible focus rings, and a package-wide interactive-cursor
  inventory test. The manual failure may come from an older runtime image or
  from Radix `MenuItem`, which deliberately uses `cursor-default` by design.
  Rebuild and browser revalidation must identify the exact remaining element
  before changing code.
- BUG-007 is confirmed as provider state, not CMS upload-adapter logic. The R2
  provisioning evidence records only `http://localhost:3000`; the regression
  production image runs at `http://localhost:3300`. The current rollout
  runbook explicitly requires provider-dashboard/CLI CORS configuration and
  says the future in-app push handler is not implemented. A live provider
  mutation is therefore required for complete closure.
- No raw R2 credentials were read or printed during the ownership audit.
- BUG-002 should keep URL query state as the single source of truth. The shared
  navigation helper will preserve only the closed CMS query allowlist when
  moving between content paths, while dropping path-obsolete `directoryId`,
  resetting `offset`, and refusing to copy arbitrary/hostile parameters.
- Both navigation owners need integration coverage: the content breadcrumb in
  `CmsContentListPanel` and the Lumia shell's directory `onNavigate` bridge.
  Testing only a pure serializer would not prove the real routes retain state.
- BUG-002 RED is confirmed in both owners: shell directory navigation and the
  root breadcrumb each pushed a path-only URL and dropped the expected
  `q/sortBy/view/favorites` state. The targeted run also exposed one unrelated
  environment-dependent assertion because direct `pnpm exec vitest` bypassed
  the repository's `with-env.mjs` wrapper; subsequent CMS test commands must
  use `pnpm test -- ...`.
- Query-state parsing/serialization currently lives entirely inside the hook.
  Extracting it into one pure module will let the hook and both navigation
  bridges share identical normalization instead of introducing a second
  whitelist implementation.
- BUG-002 GREEN extracted a single pure query-state module used by the hook,
  shell, and breadcrumbs. Navigation canonicalizes values, keeps only the
  documented query contract, resets offset, and removes legacy directory ID.
  Fresh full CMS verification is 66/66 files and 765/765 tests passing.
- BUG-002 already has a URL-backed query-state hook with a closed `grid | list`
  view type and tests. The likely defect boundary is directory navigation not
  preserving query parameters, or URL updates using navigation semantics that
  visibly refresh the route; inspect callers before adding storage.
- BUG-006 already has a deterministic scroll-layout fixture and Playwright
  specification. Prior evidence describes a race around small synthetic scroll
  events, so the implementation and test must be read together before deciding
  whether the product behavior or the fixture is unstable.
- CMS editor publish/status operations already expose a single `isPublishing`
  gate. BUG-003 likely belongs in the Lumia editor/action presentation rather
  than duplicating lifecycle state in `CmsEditorScreen`.
- The initial broad search produced too much output and one harmless
  `components: No such file or directory` error because this repo keeps
  components under `src/components`. Subsequent searches will be scoped to
  concrete files/directories.
- BUG-002 root cause is now concrete: list/grid choice is encoded in the
  current URL by `useCmsContentQueryState`, but directory navigation in both
  `CmsDashboardShell` and `CmsContentListPanel` calls `router.push()` with a
  path-only target. That drops `?view=grid` (and all other coherent query
  state), remounts the route, and falls back to list view. A shared safe query
  preservation helper is preferable to adding a second localStorage source of
  truth. Pagination offset and the legacy `directoryId` query should not leak
  across a path-based directory transition.
- BUG-004 is owned by `CmsContentCardGrid`: unlike
  `CmsContentCardList`, its prop contract exposes only `onOpen`, so delete,
  share, and favorite actions are impossible in grid view. The existing list
  handlers and pending-state maps can be reused; no new mutation layer is
  needed.
- BUG-005 was traced to `CmsDashboardShell`: `onLogout` initially performed a
  bare `router.push('/logout?...')` and has no local pending state or overlay.
  The shell already has localized status copy and authentication fallbacks,
  making it the correct boundary for an accessible interaction blocker.
- BUG-004 can reuse the existing list-view mutation handlers and pending-state
  maps. The grid must not place action buttons inside its current `role=button`
  card; the safe structure is a presentational card with separate sibling
  controls: one real button for opening the entry and one Lumia menu trigger
  for delete/share/favorite. The localization catalogs already contain every
  action label except a card-menu trigger label.
- BUG-004 is implemented without duplicating mutation logic: the grid mapper
  receives the same handler bundle and pending maps as list view. The card is
  presentational, with sibling open and menu controls, so no interactive
  control is nested inside another. Full CMS unit/integration is 768/768,
  lint and strict TypeScript are clean; browser validation remains.
- Final BUG-005 handling uses a hard same-origin document replacement rather
  than App Router `push()`, because `push()` exposes no completion/failure
  promise. A single-flight ref immediately makes the shell inert/aria-hidden,
  shows an accessible fixed overlay, and a 10-second watchdog restores the UI
  with localized feedback if the document handoff never unloads. Synchronous
  navigation errors recover immediately.
- BUG-006's stable discriminator is viewport geometry, not time. At the bottom
  of the results, hiding the secondary row increases `clientHeight` and the
  browser clamps `scrollTop` to the new maximum. A negative delta should be
  ignored only when the prior and current positions are both at their
  respective maximums and `clientHeight` increased; a subsequent real upward
  scroll with unchanged geometry must still reveal the row. This avoids timer
  masking and preserves deliberate user input.
- The existing Playwright scroll spec proves one down/up transition but does
  not drive to the bottom or hold after the 200 ms max-height transition. It
  needs a repeated bottom-scroll stability assertion matching REG-15's five
  desktop repetitions, while retaining the tablet/mobile and sidebar checks.
- BUG-006's new five-repetition Playwright test passed against the real fixture
  on Chrome: after each rapid bottom scroll, `aria-hidden` transitioned to
  true exactly once and stayed there through the layout transition.
- BUG-007 has usable R2 variable names in the ignored canonical infra env
  files, but both `xynes-infra` and `xynes-storage-service` contain unrelated
  dirty health-contract work on `fix/local-regression-health-contract`.
  Repository edits in those worktrees would risk overlap. A read-only
  `GetBucketCors` query can still confirm current provider state without
  printing credentials; any `PutBucketCors` remains an explicitly authorized
  external mutation.
- Fresh npm advisory checks found three HIGH production-transitive findings
  (`picomatch` via next-intl and `browserslist` via Next) plus a CRITICAL
  Vitest dev-tool finding. This is release-relevant security debt, so patched
  transitive overrides and a Vitest/coverage upgrade are being taken in scope;
  every quality gate must be rerun after lockfile regeneration.
- After patched overrides and the Vitest/Vite upgrade, the CMS audit has zero
  high/critical findings in both the production and full dependency trees.
- Next 16.3.5/React 19.3 changed the timing of the real scroll fixture enough
  to expose a second BUG-006 path. The exact 52 px mismatch was the secondary
  toolbar's height: animating `max-height` makes results viewport geometry
  intermediate/reversible while state already marks the row hidden. Removing
  the layout-changing transition eliminates that feedback surface; visual
  color/row transitions remain.
- A clipped `ResizeObserver` can report zero for the inner row even though its
  intrinsic content remains measurable. Retaining the last positive
  measurement prevents hidden state from dropping its `max-height: 0` style.
- Ten independent focused Chrome executions, each with five rapid bottom
  scroll cycles, passed after the final correction (50/50). The regression
  also asserts the shell's computed transition property excludes max-height.
- Auth's initial production audit exposed critical Next 15.5.18 advisories.
  Raising the allowed floor selected Next 15.5.26; Next explicitly supports
  patched sharp 0.35.4. The production audit is now zero high/critical.
- Auth's broad full audit includes development dependencies of linked Lumia
  packages and still reports linked-tooling advisories. Those are not part of
  the Auth production graph; the Auth production audit is clean at the
  requested severity. CMS's own full development audit is clean of
  high/critical findings.
- The requested 85% floor is enforced in both Vitest configurations and met
  across every aggregate metric in both changed applications: CMS
  91.45/85.13/97.12/92.07 and Auth 91.72/85.15/93.48/93.37
  (statements/branches/functions/lines). Auth's changed callback page is now in
  the coverage scope and reports 93.26/87.50/88.88/96.03.
- The authoritative final CMS browser suite passes 20/20 after the
  no-layout-transition correction. Its expected fixture-only feature-flag 404
  messages are handled fallback diagnostics, not uncaught browser failures.
- Canonical BUG-007 testing disproved the original port/CORS hypothesis: port
  3000 reached the gateway and first failed correctly at RBAC for a
  `workspace_member`; the same browser/session completed a real R2-backed flow
  after a temporary exact `content_editor` assignment.
- The authorized flow exposed a separate persistence defect in Lumia's
  Insert-menu file picker. It copied `result.url` and upload status but omitted
  `result.objectId`, so CMS could not recognize and remove the transient signed
  URL. Persisting the non-empty stable identifier fixes the save contract
  without retaining provider credentials or broadening upload authorization.
- The post-fix DB/browser evidence is exact: storage object
  `543d0f3e-b7d5-4744-88f0-325506f7b9de` reached `ready`; saved editor JSON had
  that `objectId`, empty `src`, and no `X-Amz` material; hard refresh resolved a
  fresh image URL; the object, four QA entries, and temporary role were then
  removed/soft-deleted.

## 2026-09-30 — Regression redesign findings

- The active CMS checkout is `feature/cms-release-runtime-hardening` and is
  intentionally dirty with prior CMS-REL-1 work. Latest-source analysis must
  use fetched refs or another existing clean checkout; switching this checkout
  would risk user work.
- GitHub metadata should be queried with `gh`; source synchronization still
  uses Git's fetch mechanism. The first CMS PR listing showed PR #49
  (`chore: refresh dependencies and validation`) as the latest merged PR
  visible before the corrected RDL2 organization search.
- After a fresh fetch on 2026-09-30, CMS `develop`, `origin/develop`, and
  `FETCH_HEAD` all resolve to `af35ecca488d145e22d09d94bb6add91d736d640`
  (PR #49, merged 2026-09-18). Organization-wide `gh` searches for `RDL2`,
  `RDL-2`, and `RDL` returned no matching merged PR, and the 50 most recently
  updated merged Xynes-Studio PRs show no newer CMS merge. The checklist will
  therefore pin this exact visible remote commit and flag the RDL2 naming
  mismatch rather than guess at an unavailable PR.
- Fresh visible `origin/develop` commits for the integrated surface are:
  Auth app `854c536b...`, Auth SDK `7003ea39...`, gateway `d9c47d98...`,
  CMS Core `35c39042...`, accounts `fbbb5d87...`, authz `9905b0e3...`, and
  storage `47c35e79...`. Backend infra could not be fetched because GitHub
  returned `Repository not found`; its local `develop` and `origin/develop`
  both resolve to `792803db...`, while the checkout has unrelated smoke-script
  edits that must be preserved.
- CMS `origin/develop` exposes the public landing page, health route, logout,
  dashboard/workspace redirect routes, content root/directory/editor flows,
  access control, integrations, plugins, settings, and two purpose-built E2E
  scroll fixtures. Existing Playwright coverage is concentrated on dashboard
  layout, accessibility, pseudo-locale, and scroll stability; whole-product
  auth/content lifecycle still needs the combined checklist.
- Auth `origin/develop` owns login/signup, OAuth callbacks, email verification,
  forgot/reset password, profile completion, onboarding, workspace selection,
  invites, Workspace Admin integrations/directory/settings surfaces, health,
  logout, CSP reporting, and security-header checks. Its own testing guide says
  package-level Playwright E2E is not implemented, so cross-app browser flows
  should be assigned to the agent lane only when the live local stack and test
  account allow automation; real Google OAuth remains human-owned.
- Both frontend apps expose deterministic lint/test/coverage/build commands.
  CMS also owns a 20-test Playwright suite on the visible `develop` ref; Auth
  relies on unit/integration coverage plus the combined live-stack regression.
- The canonical CMS dashboard route seed defines 15 private, workspace-scoped
  routes: four content-directory routes and eleven directory-first entry
  routes. Entry actions cover list, create, get, update, soft-delete, publish,
  status change, collaborators, favourite toggle/list, and internal share link.
  Public compatibility routes separately cover published generic content,
  published blog reads, and entry comments.
- The repository already contains `scripts/smoke-cms-api-key.sh`, a destructive
  local integration harness that creates/revokes its own readonly, authoring,
  and publisher keys and validates positive scope access, negative scope
  enforcement, cross-workspace denial, unknown/revoked keys, user-JWT
  compatibility, DB actor columns, cleanup, and raw-key log redaction. It is
  ideal for the Agent full lane, but it is not the right entry point for the
  user's single supplied key because it requires local DB/JWT authority and
  provisions additional keys.
- The provided-key lane should therefore be a smaller black-box run driven by
  non-secret inputs plus a mode-`0600` temporary secret file outside the
  repository. It must never echo the key or persist it in tracked artifacts.
  It can safely verify authentication, allowed reads/writes for the declared
  scope, denied out-of-scope actions, workspace isolation, envelopes,
  pagination/filters, lifecycle persistence, and cleanup of exact test IDs.
- CMS frontend client contracts agree with the route seed and supply the exact
  HTTP methods and paths. The checklist can reference these source-backed
  routes directly instead of inventing an API surface.
- The final split avoids duplicate effort: deterministic health, build,
  browser, API, scope, isolation, and resilience checks are agent-owned; real
  OAuth/email, subjective UX, physical-device, and assistive-technology checks
  remain human-owned.
