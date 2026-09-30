# CMS-REL-1 Production Runtime and Health Implementation Plan

> **For Codex:** Execute this story task-by-task on its own local feature branch. If Codex Goals are enabled, create one goal for this entire story and do not mark it complete until every acceptance criterion, verification gate, story revalidation item, and manual-verification deliverable is complete. Use test-driven development and verification-before-completion. Do not deploy, push, open a pull request, or merge.

**Goal:** Produce a secure, minimal, locally verified production container for `xynes-cms-console-web` with Next.js standalone output and a binding gateway-aware health endpoint.

**Architecture:** Build from the `xynes-front-end/` parent context because this application consumes sibling `link:` packages. Generate Next.js standalone output, copy only the traced runtime plus `public` and `.next/static`, run as a non-root user, and expose the existing Next-specific `/api/health` endpoint. The health handler probes only the direct gateway dependency through server-only configuration and fails closed without leaking infrastructure details.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, pnpm/Corepack, Vitest, Docker BuildKit, Alpine/Node runtime, Trivy.

---

## 1. Story metadata

| Field | Value |
|---|---|
| Story ID | `CMS-REL-1` |
| Priority | P0 — release blocker |
| Estimate | 13 story points |
| Primary repo | `xynes-front-end/xynes-cms-console-web` |
| Agent | Agent A |
| Local branch | `feature/cms-release-runtime-hardening` from current `develop` |
| Deployment | Explicitly out of scope |
| PR/push/merge | Explicitly out of scope |
| Parallel story | `CMS-REL-2`; the file ownership below is disjoint |

## 2. Why this is pending

At the 2026-09-21 audit baseline (`develop` at `af35ecc`):

- Group H story `H-8` is still marked Open.
- `next.config.ts` does not set `output: "standalone"`.
- No service-owned `Dockerfile` or Dockerfile-specific ignore file exists.
- `app/api/health/route.ts` returns only `{ status, service }` and never probes the gateway.
- The current health response does not implement the release contract's version, uptime, checks, degraded status, timeout, failure cache, or redaction behavior.
- The frontend dev Compose image is not the production artifact and must remain unchanged by this story.

## 3. Required references

Read these before editing:

1. `xynes/xynes-infra/docs/plans/2026-05-13-mvp-release-stories/group-H-dockerfile-prod-targets.md`
   - `H-8 — xynes-cms-console-web`.
   - Shared Next.js Dockerfile skeleton.
2. `xynes/xynes-infra/infra/release/HEALTHCHECK-CONTRACT.md`
   - Response schema, direct-dependency rule, one-second probe timeout, 30-second failed-probe cache, latency and redaction rules.
3. `xynes/xynes-infra/infra/release/RELEASE-STRATEGY.md`
   - Container hardening and release acceptance principles.
4. `xynes-front-end/infra/README.md`
   - `NEXT_API_URL` versus `NEXT_PUBLIC_API_URL` contract.
5. `xynes-front-end/infra/docker-compose.yml`
   - Existing CMS port and server-only gateway environment wiring.
6. `xynes-front-end/xynes-cms-console-web/.github/pull_request_template.md`
   - Security and CMS-specific regression checklist.
7. `xynes-front-end/xynes-cms-console-web/SECURITY.md`
   - Sensitive-data boundaries.
8. Official Next.js references:
   - <https://nextjs.org/docs/app/api-reference/config/next-config-js/output>
   - <https://nextjs.org/docs/app/getting-started/deploying>

### Path discrepancy to resolve deliberately

The generic health contract says root-relative `/health`, while its Next.js section, the existing frontend Compose files, and current application route all use `/api/health`. This story preserves the established Next-specific `/api/health` path. Do not add a redirecting `/health` route: Docker health checks must receive a direct `200`/`503` JSON response without redirects.

## 4. Parallelization and file ownership

This story exclusively owns:

- `next.config.ts`
- `app/api/health/route.ts`
- `app/api/health/route.test.ts`
- `app/api/health/health.ts` — new pure/injectable health implementation
- `app/api/health/health.test.ts` — new
- `Dockerfile` — new
- `Dockerfile.dockerignore` — new
- `src/test/production-runtime-contract.test.ts` — new static container/config contract test
- `README.md` — production image and health runbook only
- `CVE-WAIVERS.md` — create only if a justified runtime finding remains
- `docs/manual-verification/CMS-REL-1-production-runtime.md` — create only after final automated validation

Do not modify the files owned by `CMS-REL-2`:

- `package.json`, `pnpm-lock.yaml`
- `.github/workflows/*`
- `middleware.ts` / `proxy.ts` and their tests
- `playwright.config.ts`, `e2e/*`, `app/e2e/*`
- `docs/DEVELOPER.md`
- `xynes-front-end/infra/docker-compose.dev.yml`

If an unexpected need crosses this boundary, record it in the manual-verification document as a blocker or follow-up. Do not edit the other story's files.

## 5. Non-negotiable security invariants

- The browser bundle must never receive `NEXT_API_URL`, gateway internal hostnames, service tokens, Supabase service-role keys, raw API keys, hashes, or stack traces.
- The health endpoint is unauthenticated and therefore returns only the closed documented schema.
- The gateway URL and thrown probe errors must never appear in response bodies or logs.
- Only the direct gateway dependency is probed. Do not create transitive health fan-out.
- The probe uses a hard one-second timeout.
- Failed probe results are cached for 30 seconds to prevent retry storms; a successful result is not kept stale unnecessarily.
- Concurrent requests during one active probe share one in-flight promise rather than creating a probe stampede.
- The image runs as a dedicated non-root user and does not ship source, tests, local environment files, Git metadata, package-manager stores, or build caches.
- Runtime filesystem writes go to `/tmp` or another explicitly writable runtime path so the image works with a read-only root filesystem.
- Public build inputs must be explicit. Missing required production public configuration fails the build instead of silently baking empty or localhost values.
- No real credentials may appear in Docker build arguments, image layers, test fixtures, documentation, or command output committed to Git.

## 6. Acceptance criteria

### Health contract

- [ ] `GET /api/health` requires no auth or cookies.
- [ ] Healthy response is HTTP 200 and `application/json; charset=utf-8`.
- [ ] Degraded response is HTTP 503 with the same JSON schema.
- [ ] Body keys are exactly `ok`, `service`, `version`, `uptime_seconds`, and `checks`.
- [ ] `service` is exactly `xynes-cms-console-web`.
- [ ] `version` comes from `XYNES_BUILD_VERSION`, with a documented non-production fallback only.
- [ ] `uptime_seconds` is a non-negative integer.
- [ ] `checks` has exactly one key, `gateway`, whose value is `ok` or `fail`.
- [ ] The probe targets `${NEXT_API_URL}/health`; any fallback is explicit, local-only, and unit tested.
- [ ] A failed or timed-out probe returns within the hard contract ceiling and is cached for 30 seconds.
- [ ] Health responses use `Cache-Control: no-store`.
- [ ] No URL, token, environment name/value, stack trace, file path, request identifier, or upstream body leaks.
- [ ] At least eight focused assertions cover happy, degraded, timeout, cache, concurrency, schema, content type, and redaction paths.

### Standalone output and image

- [ ] `next.config.ts` sets `output: "standalone"`.
- [ ] Output tracing includes all required sibling `link:` packages without copying unrelated workspace data.
- [ ] A production build emits a runnable `.next/standalone/**/server.js`.
- [ ] `public` and `.next/static` are copied into the runtime tree because standalone output does not copy them automatically.
- [ ] Docker build uses the `xynes-front-end/` parent context and a service-local Dockerfile.
- [ ] `Dockerfile.dockerignore` excludes nested `.git`, `.next`, `node_modules`, coverage, test results, local env files, pnpm stores, and unrelated application build output.
- [ ] Dependency installation uses the pinned package manager and frozen lockfiles.
- [ ] Runtime container listens on port 3000 at `0.0.0.0`.
- [ ] Runtime container executes the standalone `server.js` as non-root.
- [ ] Docker `HEALTHCHECK` calls `http://127.0.0.1:3000/api/health` with the binding 30s/5s/15s/3 timing.
- [ ] Container becomes healthy with a reachable gateway and unhealthy with an unreachable gateway.
- [ ] Image operates with `--read-only` plus writable `/tmp` and no-new-privileges.
- [ ] Runtime trace contains no dangling symlinks.
- [ ] Trivy shows zero unwaived CRITICAL findings and zero unwaived HIGH findings. Any unavoidable finding has a time-bounded `CVE-WAIVERS.md` entry with package, CVE, reachability analysis, owner, expiry, and removal condition.

### Regression and documentation

- [ ] Existing public landing, auth redirect, dashboard, integrations, editor, storage, and i18n unit tests remain green.
- [ ] Strict TypeScript typecheck (`corepack pnpm exec tsc --noEmit`) passes with zero errors.
- [ ] Overall statements, branches, functions, and lines remain at or above 80%.
- [ ] Every new or materially changed module is at or above 80% statements, branches, functions, and lines; pure health helpers target 100%.
- [ ] `README.md` documents build context, build args, local image run, health behavior, read-only smoke, and Trivy commands.
- [ ] No deployment, Compose rollout, push, PR, or merge is performed.

## 7. Execution plan

### Task 0: Establish the local branch and baseline

**Files:** none.

1. Confirm the repository is clean and current:

   ```bash
   cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
   git status --short --branch
   git rev-list --left-right --count develop...origin/develop
   ```

   Expected: clean `develop`, `0 0` divergence.

2. Create the local branch:

   ```bash
   git switch -c feature/cms-release-runtime-hardening develop
   ```

3. Record the baseline in working notes:

   ```bash
   corepack pnpm lint
   corepack pnpm exec tsc --noEmit
   corepack pnpm test:coverage
   corepack pnpm build
   ```

   Audit baseline from 2026-09-21: 64 test files / 736 tests; 94.15% statements+lines, 87.69% branches, 95.96% functions. Treat those figures as a no-regression reference, while the binding floor is 80%.

### Task 1: Write RED health-contract tests

**Files:**

- Create: `app/api/health/health.test.ts`
- Modify: `app/api/health/route.test.ts`

1. Write tests first for:
   - healthy gateway response;
   - gateway non-2xx response;
   - thrown network failure;
   - hard timeout;
   - 30-second failure cache and expiry;
   - in-flight probe deduplication;
   - exact documented response keys;
   - no secret/URL/error leakage;
   - integer uptime and configured version;
   - `no-store` and JSON content type.
2. Use injected `fetch`, clock, uptime, and environment seams rather than real network or fake global state.
3. Run the focused tests and prove they fail against the legacy route:

   ```bash
   corepack pnpm exec vitest run app/api/health/health.test.ts app/api/health/route.test.ts
   ```

4. Save the RED failure summary for the final evidence document.

### Task 2: Implement the health contract minimally

**Files:**

- Create: `app/api/health/health.ts`
- Modify: `app/api/health/route.ts`

1. Implement the injectable health function and closed response type.
2. Resolve and normalize the gateway base URL once; reject invalid or absent production configuration without leaking it.
3. Add one-hop gateway `GET /health` probing with timeout, failure cache, and shared in-flight work.
4. Keep response construction explicit; never spread upstream objects.
5. Return 200/503 from the route with exact headers.
6. Re-run focused tests until GREEN.
7. Run the existing middleware/public-route and security-header tests to confirm health remains public without weakening the protect-all policy.

### Task 3: Write RED standalone and Docker source-contract tests

**Files:**

- Create: `src/test/production-runtime-contract.test.ts`

The static contract test must fail before implementation and assert:

- `output: "standalone"` exists;
- the Dockerfile has explicit stages and a non-root runtime user;
- port 3000 and `HOSTNAME=0.0.0.0` are set;
- the standalone server, public files, and static assets are copied;
- the exact healthcheck path and timing are present;
- no broad `COPY . .` reaches the runtime stage;
- the final command runs `node server.js`;
- the ignore file excludes Git, env, tests, coverage, caches, and nested pnpm stores.

Run:

```bash
corepack pnpm exec vitest run src/test/production-runtime-contract.test.ts
```

Expected before implementation: FAIL for missing standalone config/Docker artifacts.

### Task 4: Enable standalone output safely

**Files:**

- Modify: `next.config.ts`

1. Add standalone output.
2. Set a precise output tracing root suitable for the `xynes-front-end/` parent context and sibling linked packages.
3. Preserve current Turbopack and webpack React aliases, headers, and transpiled packages.
4. Run production build with explicit non-secret fixture public inputs.
5. Verify the emitted standalone server and inspect the trace for every linked package used at runtime.
6. Check for dangling symlinks; a count above zero is a blocker.

### Task 5: Add the production Dockerfile and context filter

**Files:**

- Create: `Dockerfile`
- Create: `Dockerfile.dockerignore`

1. Use the parent frontend folder as build context.
2. Install CMS Console dependencies and only the sibling linked packages needed by the build.
3. Account for Lumia root Tailwind/PostCSS build dependencies; use its frozen lockfile and do not copy local pnpm stores.
4. Validate required public build inputs before `next build`.
5. Copy only the standalone runtime, `public`, `.next/static`, and necessary runtime metadata into the final stage.
6. Create and use a dedicated non-root user/group.
7. Redirect writable Next/runtime cache paths to `/tmp`.
8. Set the binding Docker healthcheck.
9. Make the static contract test GREEN.

Canonical build command from `xynes-front-end/`:

```bash
docker buildx build \
  -f xynes-cms-console-web/Dockerfile \
  --target prod \
  --build-arg XYNES_BUILD_VERSION=sha-local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://fixtures.supabase.local \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
  --build-arg NEXT_PUBLIC_API_URL=http://127.0.0.1:4100 \
  --build-arg NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  --build-arg NEXT_PUBLIC_AUTH_APP_URL=http://127.0.0.1:3100 \
  --build-arg NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS=127.0.0.1:3000,127.0.0.1:3100 \
  -t xynesplatform/xynes-cms-console-web:local-test \
  .
```

Fixture values above are intentionally non-secret. Do not replace them with real credentials in committed commands or evidence.

### Task 6: Container runtime and security verification

**Files:** none unless a justified `CVE-WAIVERS.md` is required.

1. Inspect image user, command, port, environment, healthcheck, and layers.
2. Run against a deterministic local gateway health stub or the existing local gateway. Do not call a hosted environment.
3. Verify healthy response and Docker health state.
4. Remove/stop the local gateway dependency and verify the CMS endpoint returns 503 and the container becomes unhealthy without hanging.
5. Run the container with:
   - read-only root filesystem;
   - writable `/tmp` tmpfs;
   - `no-new-privileges`;
   - no mounted source or secrets.
6. Exercise `/`, `/SECURITY.md`, `/api/health`, and one protected dashboard path.
7. Run Trivy vulnerability and secret scans against the final image/context.
8. If a finding remains, determine reachability before writing a waiver. Never waive by severity alone.

### Task 7: Full repository gates

Run from the CMS Console repo:

```bash
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm test
corepack pnpm test:coverage
corepack pnpm build
```

Required result:

- zero lint errors/warnings introduced;
- zero TypeScript errors;
- all tests pass;
- overall and touched-module coverage meet the 80% floor;
- production build emits standalone output;
- no regression to the 2026-09-21 baseline without a documented reason.

Playwright is owned by `CMS-REL-2`; do not edit or run around failures by changing its files. Running the existing suite as a read-only regression check is allowed.

### Task 8: Documentation and story revalidation

**Files:**

- Modify: `README.md`
- Create conditionally: `CVE-WAIVERS.md`

1. Document reproducible build, run, health, read-only, inspect, and scan commands.
2. Re-read this story from top to bottom.
3. Create an acceptance matrix with one evidence row per checkbox.
4. Review `git diff --check`, `git status`, and the complete branch diff.
5. Confirm no file owned by `CMS-REL-2` was modified.
6. Perform a local code/security review and resolve every P0/P1/P2 finding before proceeding.

### Task 9: Create the human manual-verification handoff

**File:**

- Create: `docs/manual-verification/CMS-REL-1-production-runtime.md`

Create this file only after automated validation is green. It must contain:

- branch name and exact commit SHA;
- image ID and size;
- prerequisites and non-secret test environment;
- exact build command;
- exact healthy and degraded runtime commands;
- expected HTTP status/body examples with all sensitive values redacted;
- Docker health-status check;
- non-root and read-only-root checks;
- public/static asset checks;
- Trivy commands, version, result counts, and waiver links if any;
- step-by-step human pass/fail checklist;
- rollback instructions for local verification;
- known limitations and explicitly deferred deployment work;
- final recommendation: `READY FOR COMBINED LOCAL RELEASE VALIDATION` or `BLOCKED`, with reasons.

Do not create a PR. Stop with a clean summary of local commits and the manual-verification file path.

## 8. Definition of done

This story is complete only when:

- every acceptance criterion is mapped to fresh evidence;
- focused tests were observed RED before GREEN;
- all repository gates pass;
- the production container passes healthy, degraded, non-root, read-only, trace-integrity, and vulnerability checks;
- the manual-verification Markdown exists and is actionable by a human unfamiliar with the implementation;
- no deployment, push, PR, or merge occurred;
- the branch remains local and ready for later integration with `CMS-REL-2`.

## 9. Explicitly deferred work

- Frontend QA/Prod Compose and any VPS changes (`I-4`).
- Image push, reusable build/deploy workflows, and production tags (`M-12` deployment slice, Groups L/O).
- CMS Data Store epic (`DS-*`), whose backend prerequisites remain Open.
- Product locale switcher (`TFU-7`) and TMS/machine-translation phases.
- Hosted smoke tests or real customer data.
