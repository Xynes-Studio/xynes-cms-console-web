# CMS-REL-2 Release Quality and Browser Certification Implementation Plan

> **For Codex:** Execute this story task-by-task on its own local feature branch. If Codex Goals are enabled, create one goal for this entire story and do not mark it complete until every acceptance criterion, verification gate, story revalidation item, and manual-verification deliverable is complete. Use test-driven development and verification-before-completion. Do not deploy, push, open a pull request, or merge.

**Goal:** Turn the CMS Console's currently green but partly manual quality posture into one reproducible local/CI release gate, remove the Next.js 16 proxy deprecation, and certify the critical browser surfaces in desktop/mobile and en-US/en-XA modes.

**Architecture:** Keep application behavior unchanged while formalizing quality commands in `package.json`, migrating the protect-all boundary from the deprecated `middleware.ts` convention to `proxy.ts`, extending deterministic Playwright fixtures, and adding a non-deploying GitHub Actions quality workflow. The workflow checks out linked sibling repositories side-by-side so the existing `link:` dependency model remains reproducible.

**Tech Stack:** Next.js 16 Proxy, TypeScript, ESLint, Vitest/RTL, V8 coverage, Playwright/Chromium, pnpm/Corepack, GitHub Actions.

---

## 1. Story metadata

| Field | Value |
|---|---|
| Story ID | `CMS-REL-2` |
| Priority | P0 — release blocker |
| Estimate | 13 story points |
| Primary repo | `xynes-front-end/xynes-cms-console-web` |
| Companion repo | `xynes-front-end/infra` only for the dev bind-mount rename and its contract test |
| Agent | Agent B |
| Local CMS branch | `feature/cms-release-quality-certification` from current `develop` |
| Local infra branch | `feature/cms-release-quality-proxy-mount` from current `develop` |
| Deployment | Explicitly out of scope |
| PR/push/merge | Explicitly out of scope |
| Parallel story | `CMS-REL-1`; the file ownership below is disjoint |

## 2. Why this is pending

At the 2026-09-21 audit baseline (`develop` at `af35ecc`):

- Group M story `M-12` is still Open, and the CMS repository has no workflow under `.github/workflows/`.
- `package.json` has no `typecheck` or single release-verification command even though the PR template requires `pnpm typecheck`.
- Fresh lint and `tsc --noEmit` pass, but the command contract is inconsistent.
- Vitest is healthy at 64 files / 736 tests and above 80% coverage, but agents must manually remember the complete gate order.
- Playwright passes 19/19 tests and covers strong dashboard-fixture accessibility behavior, but release-critical public landing and protect-all redirect surfaces are not in the browser matrix.
- Both `pnpm build` and Playwright emit the Next.js 16 warning that `middleware.ts` is deprecated in favor of `proxy.ts`.
- Translation follow-up `TFU-5` still asks for repeatable en-US/en-XA browser verification; current coverage is mostly a dashboard fixture rather than a release certification matrix.
- The frontend `Bugs.md` still lists `FE-XAPP-BUG-001/002` as Open even though the implementations landed. This story verifies their regression contracts but does not re-implement them.

## 3. Required references

Read these before editing:

1. `xynes/xynes-infra/docs/plans/2026-05-13-mvp-release-stories/group-M-per-repo-ci-wiring.md`
   - Shared quality-gate contract and `M-12`.
2. `xynes/xynes-infra/docs/plans/2026-05-09-translation-support-pending-followups.md`
   - `TFU-5` cross-repo Playwright intent and security notes.
3. `xynes/xynes-infra/docs/research/ux-review/01-user-stories.md`
   - `UXR-6` landed scope and `UXR-7` browser matrix/follow-ups.
4. `xynes-front-end/infra/docs/testing/2026-05-10-uxr-7-browser-ux-smoke-matrix.md`
   - Existing browser evidence model.
5. `xynes-front-end/infra/docs/backlog/Bugs.md`
   - Stale `FE-XAPP-BUG-001/002` entries; use only as regression intent.
6. `xynes-front-end/xynes-cms-console-web/.github/pull_request_template.md`
   - Binding quality/security checklist.
7. `xynes-front-end/xynes-cms-console-web/README.md`
   - Current test tiers and ≥80% floor.
8. `xynes-front-end/xynes-cms-console-web/docs/DEVELOPER.md`
   - Directory-first, integrations, auth handoff, storage, i18n, and shell invariants.
9. Official Next.js 16 migration references:
   - <https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy>
   - <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>

## 4. Parallelization and file ownership

This story exclusively owns in the CMS repo:

- `package.json`
- `pnpm-lock.yaml` only if script/tool metadata legitimately changes it
- `.github/workflows/quality.yml` — new, quality only, no build/push/deploy
- `middleware.ts` deletion/rename
- `middleware.test.ts` deletion/rename
- `proxy.ts` — new name for preserved behavior
- `proxy.test.ts` — preserved and extended behavior tests
- `vitest.config.ts` — replace the explicit `middleware.test.ts` include with `proxy.test.ts`
- `playwright.config.ts`
- `e2e/cms-release-certification.spec.ts` — new
- `app/e2e/cms-release-certification/page.tsx` and supporting fixture code only if necessary
- `src/test/release-quality-contract.test.ts` — new static workflow/script contract
- `docs/DEVELOPER.md` — release-quality/proxy/browser sections only
- `docs/manual-verification/CMS-REL-2-release-quality-and-browser-certification.md` — create only after final validation

This story owns in frontend infra:

- `docker-compose.dev.yml` — rename the CMS source bind mount from `middleware.ts` to `proxy.ts`
- `scripts/docker-compose-dev.test.mjs` — add/preserve a contract assertion for the proxy mount

Do not modify files owned by `CMS-REL-1`:

- `next.config.ts`
- `app/api/health/*`
- `Dockerfile`, `Dockerfile.dockerignore`, `CVE-WAIVERS.md`
- `README.md`
- `src/test/production-runtime-contract.test.ts`

The quality workflow must not build or inspect the Docker image. Container work belongs exclusively to `CMS-REL-1`, which keeps both stories independently green.

## 5. Non-negotiable security and product invariants

- Preserve protect-all behavior: only the explicit public allowlist and test-only fixture gate bypass authentication.
- Preserve safe redirect validation and encoded return URLs. Never reflect arbitrary protocols, hosts, backslashes, credentials, or unvalidated query input.
- The `proxy.ts` migration is a convention/runtime migration, not an auth redesign.
- `?workspace=<slug>` remains only a selection hint. Membership is revalidated against server-authoritative workspaces before selection.
- CMS remains a contextual consumer of Workspace Admin. Do not add domain, API-key, or webhook lifecycle forms.
- Preserve directory-first authoring; do not reintroduce `contentTypeId` requirements.
- Preserve signed-media rules: `objectId` persists, signed URLs do not.
- Browser tests use only deterministic fixture data and non-secret placeholder configuration.
- Screenshots, videos, traces, console capture, and workflow logs must not contain JWTs, cookies, raw API keys, Supabase service-role values, internal gateway URLs, hashes, or PII.
- CI permissions use least privilege (`contents: read`). No `packages: write`, environment, OIDC, SSH, or deployment permissions are allowed in this story.
- CI must not run deployment jobs on any event.
- Overall and touched-module statements, branches, functions, and lines must remain at or above 80%; Tier-1 helpers should be 100%.

## 6. Acceptance criteria

### Script and local quality contract

- [ ] `package.json` has `typecheck` mapped to `tsc --noEmit`.
- [ ] `package.json` has focused and full release-verification scripts with deterministic ordering.
- [ ] The release gate runs ESLint, typecheck, unit tests, coverage, production build, and Playwright.
- [ ] Coverage thresholds remain enforced in configuration, not merely documented.
- [ ] Failures stop the gate immediately and preserve readable output.
- [ ] The gate does not mutate a database, call hosted services, or deploy.

### Next.js 16 proxy migration

- [ ] `middleware.ts` is renamed to `proxy.ts`.
- [ ] Exported function is named `proxy`.
- [ ] Public path, fixture gate, authenticated-session, safe redirect, and matcher behavior remain byte-for-byte equivalent unless a failing regression test proves a necessary change.
- [ ] Test file is renamed and continues to cover all current 14 cases plus migration-specific export/file assertions.
- [ ] Vitest explicitly discovers `proxy.test.ts`; the rename must not silently drop the protect-all test suite.
- [ ] Frontend dev Compose mounts `proxy.ts`, not a missing `middleware.ts`.
- [ ] Production build and Playwright no longer emit the middleware deprecation warning.

### Browser release certification

- [ ] Existing 19 Playwright tests remain green.
- [ ] New tests cover the public landing page at desktop and mobile widths in en-US and en-XA.
- [ ] Landing tests assert no blank page, hydration/page errors, raw catalog keys, overlapping primary actions, or unlabeled interactive controls.
- [ ] Anonymous protected-route navigation redirects to the configured Auth App with a safe encoded CMS return URL.
- [ ] `/SECURITY.md` is reachable and linked from the landing trust surface.
- [ ] Representative authenticated dashboard behavior is tested only through deterministic fixture routes; no real user or backend credentials are used.
- [ ] Existing UXR-7 keyboard, 24px target-size, scroll-containment, and pseudo-locale assertions remain authoritative and are not duplicated unnecessarily.
- [ ] `FE-XAPP-BUG-001` regression remains covered: outgoing Workspace Admin links include the encoded workspace slug and no credential material.
- [ ] `FE-XAPP-BUG-002`/BUG-AUTH-2 is recorded as already landed; no CMS reimplementation is attempted.
- [ ] Playwright traces/screenshots/videos are failure-only and suitable for human review without sensitive data.

### Local non-deploying CI

- [ ] `.github/workflows/quality.yml` runs on pull requests to `develop`, `main`, and `release/*`, plus `workflow_dispatch`.
- [ ] It never runs on tag/push solely to deploy and contains no image push/deployment job.
- [ ] Permissions are `contents: read` only.
- [ ] Concurrency cancels superseded runs on the same ref.
- [ ] CMS Console, frontend infra, Lumia DS, auth SDK, and i18n are checked out as sibling directories because CMS uses `link:` dependencies and the shared env loader.
- [ ] Cross-repository checkout authentication is represented only by a named read-only secret; no token value is committed.
- [ ] Node and pnpm are deterministic, Corepack is enabled, and install uses `--frozen-lockfile`.
- [ ] Workflow runs lint, typecheck, tests, coverage, build, and Playwright.
- [ ] Workflow and script contracts have static unit tests so local validation does not require pushing the branch.
- [ ] Full Group M build/push/deploy wiring remains deferred and documented because deployment is out of scope.

### Final handoff

- [ ] Fresh baseline and final results are recorded.
- [ ] Every story checkbox maps to evidence.
- [ ] A human manual-verification Markdown file is created after automated validation.
- [ ] No deployment, push, PR, or merge is performed.

## 7. Execution plan

### Task 0: Establish both local branches and capture baseline

**Files:** none.

1. Verify both repos are clean/current:

   ```bash
   git -C /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web status --short --branch
   git -C /Users/archanray/xynes-erp/xynes-front-end/infra status --short --branch
   ```

2. Create local branches:

   ```bash
   git -C /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web switch -c feature/cms-release-quality-certification develop
   git -C /Users/archanray/xynes-erp/xynes-front-end/infra switch -c feature/cms-release-quality-proxy-mount develop
   ```

3. Run and save baseline evidence:

   ```bash
   cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
   corepack pnpm lint
   corepack pnpm exec tsc --noEmit
   corepack pnpm test:coverage
   corepack pnpm build
   corepack pnpm test:e2e
   ```

Audit baseline from 2026-09-21:

- lint: pass;
- strict TypeScript: pass;
- Vitest: 64 files / 736 tests pass;
- coverage: 94.15% statements+lines, 87.69% branches, 95.96% functions;
- production build: pass;
- Playwright: 19/19 pass;
- known release-cleanliness issue: Next.js 16 middleware deprecation warning.

### Task 1: Write RED release-quality contract tests

**Files:**

- Create: `src/test/release-quality-contract.test.ts`

Write tests first that assert:

- `package.json` exposes `typecheck` and complete release verification scripts;
- coverage config keeps all four 80% thresholds;
- `.github/workflows/quality.yml` exists;
- workflow has least permissions and no deploy/push/environment job;
- workflow checks out linked repos as siblings and uses frozen install;
- `proxy.ts` exists and `middleware.ts` does not;
- frontend dev Compose mounts `proxy.ts`.

Run:

```bash
corepack pnpm exec vitest run src/test/release-quality-contract.test.ts
```

Expected before implementation: FAIL on missing scripts/workflow/proxy.

### Task 2: Normalize package quality scripts

**Files:**

- Modify: `package.json`
- Modify only if necessary: `pnpm-lock.yaml`

Add scripts with clear responsibilities, for example:

- `typecheck`: strict TypeScript with no emit;
- `verify:code`: lint + typecheck + unit tests + coverage + build;
- `test:e2e:release`: focused release-certification Playwright tag;
- `verify:release`: code verification followed by the complete Playwright suite.

Do not hide failures with `|| true`. Do not lower coverage thresholds. Do not replace the existing individual scripts.

Make the script portion of the static contract test GREEN before continuing.

### Task 3: Migrate middleware to Next.js 16 Proxy using TDD

**Files:**

- Rename: `middleware.ts` → `proxy.ts`
- Rename: `middleware.test.ts` → `proxy.test.ts`
- Modify: `proxy.ts`
- Modify: `proxy.test.ts`
- Modify: `vitest.config.ts`

1. Extend tests first to assert the exported function is `proxy` and all current behavior remains:
   - exact public paths;
   - `/api` and Next asset bypass;
   - E2E fixture bypass only when the explicit flag is `1`;
   - protected-route redirect for anonymous users;
   - authenticated protected-route pass-through;
   - safe fallback for hostile redirect inputs;
   - query preservation where currently supported.
2. Run the renamed test and prove RED before the implementation rename is complete.
3. Rename the convention and function per official Next.js 16 guidance.
4. Update `vitest.config.ts` so its explicit top-level test include points to `proxy.test.ts`; assert the full protect-all test count runs after the rename.
5. Preserve the matcher unless a test-backed Next.js requirement forces a minimal adjustment.
6. Run focused tests, lint, typecheck, and build.
7. Confirm the deprecation warning is absent.

### Task 4: Update the frontend dev bind mount

**Files in `xynes-front-end/infra`:**

- Modify: `docker-compose.dev.yml`
- Modify: `scripts/docker-compose-dev.test.mjs`

1. Add a failing contract assertion that CMS mounts `proxy.ts` to `/app/proxy.ts` and no longer mounts `middleware.ts`.
2. Run the focused infra test and capture RED.
3. Update the bind mount.
4. Re-run the focused test and `docker compose config` using non-secret local template inputs.
5. Do not start or deploy a hosted stack.

### Task 5: Extend the Playwright release matrix

**Files:**

- Create: `e2e/cms-release-certification.spec.ts`
- Modify only as needed: `playwright.config.ts`
- Create fixture route/support only if deterministic auth-like markup cannot be expressed with existing fixtures.

Add a `@release` suite covering:

1. Public landing at 1440×900, 768×1024, and 390×844.
2. en-US and en-XA locale cookies.
3. Main landmark, primary heading, signup/login CTA safety, security-policy link, and keyboard reachability.
4. No critical browser console/page errors.
5. No raw i18n key paths, JWT-like strings, raw Xynes API keys, Argon2 hashes, or service-role markers in body text or captured errors.
6. Anonymous `/dashboard/<fixture-slug>/content` redirect to the configured Auth App with a safe encoded return URL.
7. Hostile redirect inputs cannot force an external destination.
8. Existing authenticated shell behavior through the guarded test-only fixture route.
9. `workspace-admin-links` regression through existing unit coverage; add browser coverage only if it can stay deterministic without real auth/backend state.

Reuse helpers for locale cookies, viewport matrices, console capture, and secret-pattern checks. Do not duplicate the UXR-7 target-size/scroll algorithms.

Run RED/GREEN focused:

```bash
corepack pnpm test:e2e -- --grep @release
```

Then run all Playwright tests:

```bash
corepack pnpm test:e2e
```

### Task 6: Add a local-only quality workflow

**Files:**

- Create: `.github/workflows/quality.yml`

Requirements:

1. Triggers: PRs to `develop`, `main`, `release/*`; `workflow_dispatch`.
2. Permissions: `contents: read` only.
3. Concurrency: cancel stale runs for the same workflow/ref.
4. Check out repositories into one sibling layout:
   - `xynes-cms-console-web/` (current repository/ref);
   - `infra/`;
   - `lumia-ds/`;
   - `xynes-auth-sdk/`;
   - `xynes-i18n/`.
5. Pin actions by immutable commit SHA where the repository standard requires it; otherwise use the approved major and record the follow-up.
6. Use a named read-only cross-repository token secret only if GitHub's repository token cannot read sibling repos. Never put a token value in YAML.
7. Enable Corepack, install Chrome/Playwright prerequisites deterministically, install with the frozen lockfile, and run `pnpm verify:release` in the CMS directory.
8. Upload failure-only Playwright report/trace artifacts with a short retention period and no secret-bearing environment dump.
9. Do not include Docker login, package write, image build/push, SSH, environment, deploy, tag, release, or hosted health jobs.

Make the static workflow contract test GREEN. If `actionlint` is installed, run it. If not, parse the YAML with an available safe parser and document that live GitHub validation is deferred because push/PR is forbidden.

### Task 7: Run all automated gates

CMS Console:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:coverage
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm verify:release
```

Frontend infra focused regression:

```bash
cd /Users/archanray/xynes-erp/xynes-front-end/infra
node --test scripts/docker-compose-dev.test.mjs
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

Required result:

- all commands exit zero;
- no Next.js middleware deprecation warning;
- no test count regression without documented deletion/replacement rationale;
- all coverage dimensions remain ≥80% overall and for touched modules;
- existing 19 Playwright tests plus new `@release` tests pass;
- no hosted services or real secrets were used.

### Task 8: Revalidate product/security contracts and story scope

**Files:**

- Modify: `docs/DEVELOPER.md`

1. Document the Proxy ownership/security contract and local release command.
2. Document the Playwright `@release` matrix and fixture-only limitations.
3. Re-read this story line-by-line and build an evidence matrix.
4. Revalidate these non-regression contracts:
   - directory-first CMS authoring;
   - Workspace Admin contextual-consumer boundary;
   - feature-flag provider inside workspace provider;
   - signed media URLs never persist;
   - API-key actor display does not leak identifiers;
   - cross-app `?workspace=<slug>` membership validation;
   - safe auth redirect and public allowlist.
5. Review both repository diffs, run `git diff --check`, and confirm no file owned by `CMS-REL-1` changed.
6. Perform a local code/security/test review and resolve all P0/P1/P2 findings.

### Task 9: Create the human manual-verification handoff

**File:**

- Create: `docs/manual-verification/CMS-REL-2-release-quality-and-browser-certification.md`

Create this file only after every automated gate is green. It must contain:

- both local branch names and exact commit SHAs;
- prerequisites, Node/pnpm/Chrome versions, and fixture-only environment values;
- exact local release command and expected summary;
- quality workflow structure and the read-only sibling-repo token prerequisite;
- desktop/mobile × en-US/en-XA manual matrix;
- step-by-step landing-page, protected-route redirect, dashboard fixture, integrations-link, keyboard, focus, and responsive checks;
- expected screenshots/traces and their safe storage paths;
- explicit checks for blank screens, hydration errors, console errors, overlap, inaccessible controls, stale workspace selection, and secret/PII leakage;
- final test counts and all four coverage numbers;
- explanation that `FE-XAPP-BUG-001/002` are already landed and were regression-checked, not reimplemented;
- known limitations and deferred deployment/hosted-stack work;
- final recommendation: `READY FOR COMBINED LOCAL RELEASE VALIDATION` or `BLOCKED`, with reasons.

Do not create a PR. Stop with a clean summary of local commits and both repository states.

## 8. Definition of done

This story is complete only when:

- every acceptance criterion maps to fresh evidence;
- proxy, infra mount, workflow/script, and Playwright changes were driven through RED/GREEN tests;
- full lint, typecheck, unit, coverage, build, and Playwright gates pass;
- coverage stays above 80% in all dimensions overall and for touched modules;
- the Next.js middleware deprecation warning is gone;
- the local-only workflow is least-privileged and contains no deployment behavior;
- the manual-verification Markdown is complete enough for a human who did not implement the story;
- no deployment, push, PR, or merge occurred;
- both local branches are ready for later integration with `CMS-REL-1`.

## 9. Explicitly deferred work

- Docker image implementation and container security (`CMS-REL-1`).
- Build/push/deploy reusable workflows and live Group M execution.
- QA/Prod Compose, VPS changes, DNS, Caddy, hosted smoke, and release tags.
- Data Store epic `DS-*`; its backend dependencies remain Open.
- Product locale switcher `TFU-7`, Weblate, and machine translation.
- Auth/Lumia-owned translation follow-ups outside the CMS Console.
- Real OAuth, production users, customer data, or real API keys in browser tests.
