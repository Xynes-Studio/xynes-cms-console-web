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
