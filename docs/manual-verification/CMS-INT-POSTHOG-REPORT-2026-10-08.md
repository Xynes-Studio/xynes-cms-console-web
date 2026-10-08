# CMS content integrations: PostHog rollout verification

Fresh pre-PR regression, coverage, build, browser and local environment results:
[2026-10-08 revalidation report](CMS-INT-POSTHOG-PRE-PR-VALIDATION-2026-10-08.md).

Implementation and live workspace flag evaluation verified locally on 2026-10-08.
The initial profile-completion redirect was resolved through the owner-approved
local stack repair described below. No commit, push, PR, database migration,
production deployment, or PostHog setting change was performed.

## Scope and ownership

Branch `feature/CMS-INT-posthog-content-integrations` in CMS console, auth SDK,
and gateway, based on their fetched `origin/develop` references. Existing CMS
manual regression documents and planning files were preserved.

- CMS: shared `useContentIntegrationsEnabled` gates folder/list/grid/editor hosts;
  old environment gate and Docker build argument removed. Loading or failed flag
  evaluation hides controls, including a previously true value. Existing dialog
  scope logic closes an open dialog when disabled. Authoring authentication remains
  required. Publication, delivery and API-key permissions are unchanged.
- SDK: add typed `cms_content_integrations`, default false, and retain only boolean
  wire values. Request versions reject obsolete successes and failures after a
  workspace change or unmount. Independent review reproduced that race; two tests
  failed before the guard and passed afterward.
- Gateway: add the same false default. Existing PostHog evaluation sends the
  `workspace` group and `id` property. The flag remains absent from public flags;
  its anonymous individual endpoint returns 401. No new endpoint or dependency.
- Browser fixtures and the isolated B5 runner use the existing
  `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` mechanism. They do not depend on a live
  PostHog project or real credentials.
- AGENTS.md records the owner preference: agree the key and ask the owner to create
  a PostHog flag before implementation/rollout.

## Verification

| Repository | Full tests via coverage | Lines | Branches | Functions | Statements |
| --- | ---: | ---: | ---: | ---: | ---: |
| CMS | 1,056 pass | 93.50% | 87.31% | 97.59% | 92.96% |
| Auth SDK | 389 pass | 93.04% | 87.41% | 89.09% | 93.04% |
| Gateway | 730 pass | 95.09% | Bun does not report | 95.92% | Bun does not report |

CMS's configured 85% global gate and SDK's 80% gate pass. Gateway exceeds the
repository's documented 80% requirement for reported metrics.

Changed production files, from coverage-final.json or Bun's coverage output:

| File | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| CMS useContentIntegrationsEnabled.ts | 100% | 100% | 100% | 100% |
| CMS host-context.ts | 100% | 100% | 100% | 100% |
| CMS CmsContentListPanel.tsx | 92.92% | 80.95% | 94.83% | 94.17% |
| CMS CmsEditorScreen.tsx | 91.89% | 81.58% | 100% | 92.86% |
| SDK types/feature-flags.ts | 100% | 100% | 100% | 100% |
| SDK FeatureFlagsProvider.tsx | 95.65% | 87.10% | 100% | 95.65% |
| Gateway featureFlags/types.ts | Not reported | Not reported | 100% | 100% |

The non-production host fixture is excluded by the existing coverage policy; its
folder, entry, grid, editor and disabled states are exercised by browser tests.
No exclusion or threshold was weakened.

Commands and outcomes:

- CMS: `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`,
  `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE= pnpm build`: pass.
- SDK: `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm build`: pass.
- Gateway: `bun run lint`, `bun run typecheck`, `bun run coverage`: pass.
  No package build script exists; `bun build src/index.ts --target=bun` to an
  owned temporary output also passes.
- `pnpm exec playwright test e2e/content-integration-hosts.spec.ts
  e2e/content-integrations.spec.ts`: nine pass, zero skips.
- `python3 scripts/e2e/run-cms-integrations.test.py`: 13 pass.
  Python syntax compilation passes with an owned temporary cache directory.
- `git diff --check`: pass in all three repositories.
- Independent code review: no remaining task-critical findings; SDK provider
  suite independently rerun, 21/21 pass.

Baseline failures were diagnosed before implementation. The SDK's test packages
were linked through the Auth app's incompatible Vitest dependency tree; authorized
`pnpm install --frozen-lockfile` restored its own dependencies and both baseline
385 tests and typecheck passed without a source test-setup patch. CMS's previous
local environment flag enabled fixtures without Intl providers; forcing it off
for the baseline gave 1,055 pass. Gateway's telemetry timing assertion failed
under parallel load, then passed in isolation and the full baseline gave 725 pass.
A concurrent coverage attempt timed out in an unchanged snippet execution test;
a repeat after other expensive checks finished passed. Assertions and timeouts
were not relaxed.

Existing SDK `children: any` interoperability debt for React versions and legacy
editor document casts remain unchanged; no new type bypass or relaxed compiler
setting was introduced. SDK build retains its existing bundler directive warnings.

## Real PostHog manual acceptance

1. Ship gateway and SDK additions with the CMS consumer. For local development,
   rebuild the linked SDK and restart CMS. No package publication is needed for
   the local linked setup.
2. Leave `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` empty. The old
   `NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED` value is ignored; the local
   flag added during earlier verification has been removed.
3. Configure boolean `cms_content_integrations` with an OFF default and enable
   the intended workspace group/UUID in PostHog.
4. Complete normal account onboarding/sign-in if required, then refresh CMS.
   The shared provider fetches on mount/workspace changes and does not poll.
5. Open a saved folder and verify its heading button. At the root, the button
   remains disabled with “Open a folder first.” Verify entry list/grid actions
   and the editor Integrations tab.
6. Disable the flag in PostHog and refresh. All contextual controls should hide.
   A newly evaluated false value closes an open integration dialog.
7. Switch to a disabled workspace. Its controls should stay hidden, even if a
   previous workspace request completes later.

## Approved local stack repair and live verification

The initial redirect was caused by `/me` HTTP 500: Gateway had newer signed-request
code but no configured private-key path/key ID, and clean backend primary checkouts
were older than the matching receivers. SDK bootstrap failure then presented empty
profile/workspace state. It was not evidence that the stored profile was incomplete.

The owner approved refreshing clean backends and configuring local identities.
Accounts, Authz, Documents and Telemetry primary develop checkouts were fast-forwarded;
CMS core moved from the detached A2 snapshot to current develop. Gateway retains the
PostHog feature branch. Storage and infra in-progress source edits were preserved.
Storage's hung process was restarted, restoring health/readiness without source edits.

Six local-only Ed25519 identities and a public trust manifest are stored in ignored
`xynes-infra/.tmp/local-internal-request/` (directory 0700, files 0600). The ignored
Compose override mounts each caller's own private key read-only and the public trust
file; Authz mounts only the public trust file. Audience/action/body/context checks
remain enforced. No profile values or database contents were manually changed.

Final evidence:
- All seven backend `/health` and `/ready` endpoints return 200 (14/14 checks).
- Auth app, CMS, Supabase gateway, and API frontend health checks pass.
- Gateway logs show `/me`, `/flags`, content directories and content entries returning
  200 after repair, without signing configuration errors.
- The running CMS process has no local feature flag override and Gateway's PostHog
  integration is configured. The real workspace renders contextual integration
  controls and its entry dialog opens; the profile-completion redirect no longer occurs.
- No remote flag OFF/ON setting change was performed; disabled/error behavior is
  covered by automated tests, rather than falsely claimed as live admin proof.

Use both backend Compose files when recreating containers to retain the signing
mounts. The ignored local README contains the exact command:
`/Users/archanray/xynes-erp/xynes/xynes-infra/.tmp/local-internal-request/README.md`.
The successful browser screenshot is `/private/tmp/cms-posthog-stack-repaired.png`.
