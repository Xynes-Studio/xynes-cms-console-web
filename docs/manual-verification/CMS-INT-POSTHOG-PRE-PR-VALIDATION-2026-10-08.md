# PostHog content integrations: pre-PR revalidation

**Result: PASS — no blocking issue found in the story scope.**

The PR-review follow-up at the end records subsequent SDK fixes and the CMS CI
dependency-pin repair; the initial validation snapshot below is preserved.

Fresh validation performed on 2026-10-08 (Asia/Calcutta). This report covers the
`cms_content_integrations` PostHog rollout change in CMS console, auth SDK, and
Gateway. It also rechecks the repaired local environment. No implementation fix
was needed during this revalidation; only validation documentation was added.
No commit, push, PR, migration, deployment, or PostHog administration change was
performed in this pass.

## Repository and branch verification

All three checkouts use `feature/CMS-INT-posthog-content-integrations`. Fetching
`origin/develop` succeeded using the configured `archan96` GitHub identity. Each
HEAD matches its latest fetched base, with `HEAD...origin/develop` reporting
`0 0`; the story changes are currently uncommitted.

| Repository | Verified HEAD and origin/develop |
| --- | --- |
| xynes-cms-console-web | `6762c50ee14f7f5765f09af653ad91b8f5825b78` |
| xynes-auth-sdk | `a9e6265863ea31fa14eb991da95615494f2a6822` |
| xynes-gateway | `8e956b9d5df403d52516a7821f9ba3927260f4b0` |

Six pre-existing CMS regression/planning files were checked against the saved
SHA-256 preservation manifest and remain byte-for-byte intact. Their dirty status
is unrelated to this story and they must be excluded from its commits. Storage
and infrastructure in-progress edits were not changed.

## Requirement evidence

| Requirement | Evidence and result |
| --- | --- |
| Existing remotely evaluated flag, no separate environment gate | Shared CMS hook reads `cms_content_integrations` through the existing SDK provider; production list/editor and host fixture use it. Old helper and Docker build argument are removed. Tests prove the old env value cannot override the SDK result. PASS. |
| Conservative default and boolean contract | Gateway and SDK default to false. Missing flags, false, and non-boolean variants remain disabled. PASS. |
| Workspace targeting | SDK test asserts bearer authentication and `X-XS-Workspace-Id`; Gateway tests assert PostHog `groups.workspace` and `groupProperties.workspace.id`. PASS. |
| Safe pending/failure behavior | Shared hook hides controls during loading and after a fetch failure even with cached true. List orchestration tests exercise both states. PASS. |
| Workspace response isolation | SDK tests resolve an old workspace success or failure after the new workspace completes; the version guard preserves the new result. PASS. |
| Close invalidated integration UI | List test closes an open dialog when the flag evaluates false; existing scope/auth-loss tests remain passing. PASS. |
| Preserve authoring and permission boundaries | Existing authenticated host gates remain in place; the flag does not change publication, API-key, or delivery authorization. Editor tests/browser acceptance preserve unsaved title/body and assert no save/publish calls. PASS. |
| Private flag exposure | Gateway route tests exclude it from anonymous flag listings and return 401 for anonymous individual access. PASS. |
| Reusable hosts and UX | Nine browser tests cover folder/list/grid/editor hosts, desktop/mobile, focus restoration, disabled controls, pseudolocale layout, request controls, and copy behavior. PASS. |
| Owner creates flags before implementation | CMS AGENTS.md records agreeing the exact key and asking the owner to create it before implementation/rollout. PASS. |
| Real current environment | Fresh CMS reload loads the existing profile and entries. Entry and saved-folder heading dialogs open with the running override empty and Gateway PostHog configured. PASS for live ON behavior. |

The original implementation's TDD and review evidence is recorded in
[the implementation report](CMS-INT-POSTHOG-REPORT-2026-10-08.md). This pass reran
the finished suites; it did not repeat destructive/revert-style RED experiments
in these shared dirty checkouts.

## Fresh automated results

Full regression suites were run through their coverage commands: **2,175 tests
passed, zero failed**. Browser acceptance adds nine passing tests, and launcher
safety checks add 13 passing tests. No checks were skipped or thresholds reduced.

| Repository | Tests / files | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: | ---: |
| CMS | 1,056 / 86 | 92.96% | 87.31% | 97.59% | 93.50% |
| SDK | 389 / 22 | 93.04% | 87.41% | 89.09% | 93.04% |
| Gateway | 730 / 49 | Not reported | Not reported | 95.92% | 95.09% |

CMS's configured global 85% thresholds and SDK's global 80% thresholds passed.
Gateway's Bun output exceeds its documented 80% requirement for the metrics it
reports; branch/statement coverage is not claimed.

Changed production files, calculated from the freshly generated coverage JSON
(Gateway from Bun output):

| File | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| CMS `src/features/content-integrations/useContentIntegrationsEnabled.ts` | 100% | 100% | 100% | 100% |
| CMS `src/features/content-integrations/host-context.ts` | 100% | 100% | 100% | 100% |
| CMS `src/features/cms-content/CmsContentListPanel.tsx` | 92.92% | 80.95% | 94.83% | 94.17% |
| CMS `src/features/cms-content/CmsEditorScreen.tsx` | 91.89% | 81.58% | 100% | 92.86% |
| SDK `src/types/feature-flags.ts` | 100% | 100% | 100% | 100% |
| SDK `src/providers/FeatureFlagsProvider.tsx` | 95.65% | 87.10% | 100% | 95.65% |
| Gateway `src/featureFlags/types.ts` | Not reported | Not reported | 100% | 100% |

The non-production host fixture remains excluded under the pre-existing policy
and is exercised in browser acceptance. No coverage configuration was modified.

| Command | Result | Local evidence |
| --- | --- | --- |
| CMS `pnpm test:coverage` | PASS: 1,056 tests | `/private/tmp/posthog-revalidation-cms-coverage.log` |
| SDK `pnpm test:coverage` | PASS: 389 tests | `/private/tmp/posthog-revalidation-sdk-coverage.log` |
| Gateway `bun run coverage` | PASS: 730 tests | `/private/tmp/posthog-revalidation-gateway-coverage.log` |
| CMS `pnpm lint`; `pnpm typecheck` | PASS, no lint warnings | `/private/tmp/posthog-revalidation-0-{lint,typecheck}.log` |
| SDK `pnpm lint`; `pnpm typecheck` | PASS, no lint warnings | `/private/tmp/posthog-revalidation-1-{lint,typecheck}.log` |
| Gateway `bun run lint`; `bun run typecheck` | PASS; 33 existing lint warnings, zero errors | `/private/tmp/posthog-revalidation-2-{lint,typecheck}.log` |
| SDK `pnpm build` | PASS: CJS, ESM, declarations | `/private/tmp/posthog-revalidation-sdk-build.log` |
| CMS `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE= pnpm build` | PASS: production Webpack build, typecheck, page generation | `/private/tmp/posthog-revalidation-cms-build.log` |
| Gateway `bun build src/index.ts --target=bun --outdir=/private/tmp/posthog-revalidation-gateway-build` | PASS; repo has no package build script | `/private/tmp/posthog-revalidation-gateway-build.log` |
| `pnpm exec playwright test e2e/content-integration-hosts.spec.ts e2e/content-integrations.spec.ts` | PASS: 9, zero failures/skips | `/private/tmp/posthog-revalidation-browser.log` |
| `python3 scripts/e2e/run-cms-integrations.test.py` | PASS: 13 | `/private/tmp/posthog-revalidation-launcher.log` |
| `PYTHONPYCACHEPREFIX=/private/tmp/posthog-revalidation-pycache python3 -m py_compile scripts/e2e/run-cms-integrations.py` | PASS | Launcher check output |
| `git diff --check` in all three repos | PASS | Direct command output |

## Live environment and browser acceptance

- Backend `./scripts/smoke-health.sh --env-file .env.dev`: **14/14 HTTP 200**,
  covering health and readiness of Gateway, Accounts, Documents, CMS, Authz,
  Telemetry, and Storage. Evidence:
  `/private/tmp/posthog-revalidation-backend-health.log`.
- Frontend `./run.sh health`: Auth, CMS, Supabase, and Gateway healthy. Evidence:
  `/private/tmp/posthog-revalidation-frontend-health.log`.
- Fresh browser reload of `http://localhost:3000/dashboard/xynes/content` loads
  the existing profile and six entries, without the previous onboarding redirect.
  Current Gateway logs show `/me`, `/flags`, and content directories returning 200.
- Running CMS reports `FEATURE_FLAGS_OVERRIDE_EMPTY=true`; the current Gateway
  reports `POSTHOG_CONFIGURED=true`, without exposing either environment value.
- The root heading control is disabled with “Open a folder first.” The entry
  action opens its dialog and displays the expected draft publication notice.
- Navigating to the saved `check-test/check2` folder enables “Integrations for
  folder check2”. Clicking it opens the shared dialog with the correct workspace,
  folder path, published-content wording, sorting, fields, and bounded page size.
- No content, profile, API key, or remote flag configuration was edited. The saved
  folder remains open for manual inspection.

Screenshots from this pass:

- `/private/tmp/posthog-revalidation-entry-dialog.png`
- `/private/tmp/posthog-revalidation-folder-dialog.png`

## Reviewed change inventory

The implementation spans three independently versioned repositories:

- **CMS production:** shared hook, list host, editor host, and removal of the
  old gate from `host-context.ts`.
- **CMS tests/fixtures:** new real-provider hook tests; list, editor, and
  host-context tests; host fixture; Playwright configuration; isolated integration
  launcher override.
- **CMS configuration/docs:** `.env.example`, `Dockerfile`, `AGENTS.md`, `README.md`,
  `docs/DEVELOPER.md`, contextual manual verification guide, implementation report,
  and this report.
- **SDK:** typed/default flag, request-version guard in `FeatureFlagsProvider`,
  provider/normalization tests, and README.
- **Gateway:** default flag registry, service and route tests, and DEVELOPER.md.

## Security, type safety, and remaining limits

There is no schema or database data change and no migration/backup requirement
for this story. No new endpoint, dependency, credential, authorization bypass,
compiler relaxation, coverage exclusion, or TypeScript suppression was introduced.
PostHog credentials remain server-side. Browser snippets retain placeholders;
global API-key lifecycle stays in Workspace Admin.

Gateway's 33 `no-explicit-any` warnings occur in existing test code in
`jwtAuth.test.ts`, `flags.route.test.ts`, and `tests/integration.test.ts`. Existing
SDK React-version interoperability typing and legacy editor casts remain as
documented in the implementation report. Added lines contain no `as any`,
TypeScript suppression, ESLint disable, or `skipLibCheck` change. SDK bundling
retains the existing warnings about ignored module-level `use client` directives;
the SDK build and consuming CMS production build pass.

Operational conditions and evidence limits:

1. **Coordinate all three PRs.** CMS consumes the SDK addition and Gateway flag
   default. Local pnpm links need a rebuilt SDK; no local package publication is
   required. Other environments must consume the matching SDK artifact/source.
2. **Flag flips need a fresh evaluation.** The configured provider fetches on
   mount/workspace changes and has no polling. Refresh after changing PostHog.
   Dialog closure is proved after a false evaluation, not as an immediate remote
   push from PostHog.
3. **Live ON only.** OFF/loading/error and reversed workspace-response behavior
   passed automated tests. No live PostHog OFF/ON administration or second real
   workspace switch was performed; those are not claimed as manual evidence.
4. **Local signing config is ignored.** Recreating backend containers must retain
   both canonical Compose and `.tmp/local-internal-request/compose.json`. The
   local README records that command. This repair is not shipped by these story
   PRs, and its private keys must stay excluded from version control.
5. **Storage work remains preserved.** Storage health/readiness passed; its dirty
   feature checkout was not moved to develop. This report does not certify all
   Storage processing/download paths.
6. **Bounded scope.** The nine relevant browser tests were rerun. The full B5
   isolated database/copied-request transport matrix was not rerun because the
   delivery API/transport is unchanged by this flag story. Prior B5 proof remains
   historical evidence, not a fresh claim in this report.

These limits do not block the scoped PostHog change from PR review. Stage only the
story-owned files, keep the three PR dependencies explicit, and preserve unrelated
dirty work.

## PR review follow-up — 2026-10-08

Reviewed SDK #24, Gateway #50, and CMS #59. Gateway and CMS had no actionable
inline comments. SDK had two P2 findings, both fixed in
`fae49e08898d309fee03c645fd54eb831a8b524c` and resolved with replies:

- Polls previously superseded every pending evaluation when the polling interval
  was shorter than response time. Poll ticks now skip while the current evaluation
  is pending, and version-aware finally cleanup releases the polling guard after
  success or failure without affecting a newer scope/manual request.
- With `fetchOnMount={false}`, a changed scope invalidated a pending manual request
  but left loading true. It now clears loading without issuing an automatic
  replacement; a later explicit refetch evaluates the new workspace.

Four regression cases (success and failure for each finding) failed for the
expected reasons before the implementation fix and passed afterward. Existing
out-of-order workspace tests remain passing.

CMS CI failed because all three workflow SDK checkouts pinned
`a9e6265863ea31fa14eb991da95615494f2a6822`, which lacks the new flag. The quality,
required-gates, and release-provenance workflows now pin the corrected SDK commit
above. The provenance build record uses the same SHA. No action pin, credential
permission, gate, timeout, or assertion was weakened. The canonical infrastructure
quality-profile JSON contains no SDK dependency SHA requiring a matching edit.

Fresh follow-up validation:

- SDK: **393/393 tests**, **25/25 provider tests**; coverage **93.22% lines**,
  **87.72% branches**, **89.09% functions**; lint, typecheck, and build pass.
  Changed provider coverage, rounded from coverage JSON: **97.65% statements/lines**,
  **92.11% branches**, **100% functions**. Flag types remain at 100%.
- CMS: **1,056/1,056 tests**, unchanged coverage **93.50% lines**, **87.31% branches**,
  **97.59% functions**, **92.96% statements**; lint, typecheck, and production build
  pass against the rebuilt SDK. **Nine browser acceptance tests pass**, zero skips.
- The first CMS coverage attempt under heavy concurrent load hit a list waiting
  failure and two existing snippet execution timeouts. The snippet suite passed
  alone, then the full configured coverage gate passed using
  `pnpm test:coverage --maxWorkers=2`. No tests, assertions, timeouts, or thresholds
  were changed to obtain that result.
- Workflow security policy passes using the official pinned `oven/bun:1.4.2`
  container with a read-only checkout and no container network. The installed
  local Bun lacks `Bun.YAML`; its first policy invocation could not parse inputs,
  so that attempt is not counted as validation success.
- SDK CI on the fix commit is green. CMS CI will rerun on the workflow-pin push;
  local validation is not a claim that that future run has completed.

Evidence logs: `/private/tmp/posthog-review-sdk-{red,green,coverage,lint,typecheck,build}.log`,
`/private/tmp/posthog-review-cms-{coverage,coverage-retry,snippets,lint,typecheck,build,browser}.log`.
The SDK README documents polling and manual-only scope behavior. Unrelated CMS
changes and local infrastructure keys remain excluded. Merge SDK before CMS.
