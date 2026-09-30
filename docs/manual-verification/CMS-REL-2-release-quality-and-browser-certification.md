# CMS-REL-2 release quality and browser certification

Validated on 2026-09-22 (Asia/Kolkata). This record covers the local,
non-deploying CMS-REL-2 quality story only. It does not certify the separately
owned CMS-REL-1 container work or any hosted environment.

## Recommendation

**READY FOR COMBINED LOCAL RELEASE VALIDATION**

The complete local release command passed in one uninterrupted run. The CMS
Console and frontend-infra changes are committed on isolated local feature
branches. Nothing was pushed, deployed, merged, released, or connected to a
hosted service.

## Revisions and repository state

| Repository | Branch | Develop base | Validated implementation commit |
|---|---|---|---|
| `xynes-front-end/xynes-cms-console-web` | `feature/cms-release-quality-certification` | `af35ecca488d145e22d09d94bb6add91d736d640` | `a883a99b627de664a33d83b6266e5e401ea24e22` |
| `xynes-front-end/infra` | `feature/cms-release-quality-proxy-mount` | `d931dd867b1e7931e19b89c26f32479929512af9` | `bdd91af4eebd273c570bafba84fe8cb347bb4ed2` |

Both branches were created from freshly pulled `develop`. Git transport write
access was verified with non-mutating `git push --dry-run` checks for the exact
feature refs; no branch was pushed. The effective author identity in both
repositories was `archan96 <archan.ray2011@gmail.com>`.

The CMS checkout still contains the pre-existing untracked `.dockerignore`,
`AGENTS.md`, and `CLAUDE.md`. They were preserved and excluded from the story
commits. The infra checkout is clean after its story commit.

## Prerequisites and deterministic fixture configuration

- macOS development host or an equivalent CI runner
- Node.js `v20.15.0`
- Corepack with pnpm `10.33.0`
- Google Chrome `153.0.8010.48` locally
- linked sibling repositories beside the CMS checkout: `infra`, `lumia-ds`,
  `xynes-auth-sdk`, and `xynes-i18n`
- no production account, customer data, backend credential, or hosted service

The browser harness supplies only these non-secret fixtures:

```text
NEXT_PUBLIC_SUPABASE_URL=https://fixtures.supabase.local
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key
NEXT_PUBLIC_API_URL=http://127.0.0.1:<port>/api/e2e
NEXT_PUBLIC_AUTH_APP_URL=http://127.0.0.1:3100
NEXT_PUBLIC_APP_URL=http://127.0.0.1:<port>
NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS=127.0.0.1:<port>,localhost:<port>
NEXT_PUBLIC_ENABLE_E2E_FIXTURES=1
```

The `/e2e/*` Proxy bypass and `/api/e2e/flags` response fail closed unless the
explicit fixture flag equals `1`. The flags endpoint returns only an
unauthenticated empty SDK envelope with `Cache-Control: no-store`.

## Automated release gate

Canonical command:

```bash
cd "$XYNES_ROOT/xynes-front-end/xynes-cms-console-web"
pnpm verify:release
```

The validated host had a stale Docker Desktop listener on the default port
`3200`, so the equivalent supported override below was used. It changes only
the local fixture port:

```bash
PLAYWRIGHT_E2E_PORT=3210 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
pnpm verify:release
```

Expected order is fail-fast: ESLint, strict TypeScript, unit tests, V8
coverage, production build, then the full Playwright suite. The final run
exited zero with:

- ESLint: pass
- `tsc --noEmit`: pass
- Vitest: **66 files / 745 tests passed**
- V8 coverage: **94.16% statements, 87.66% branches, 95.97% functions,
  94.16% lines**
- production build: pass with Next.js `16.3.5` using the explicitly selected,
  supported Webpack builder
- Proxy route manifest: present; no deprecated `middleware.ts` warning
- Playwright/Chrome: **31/31 passed**, including **12/12 `@release`** cases
- frontend-infra contract: **5/5 passed**
- merged Compose configuration: `docker compose ... config --quiet` passed
- `git diff --check`: passed in both repositories before commit

The explicit Webpack selection makes `pnpm build` reproducible in hardened
runners where Next.js 16.3.5 Turbopack's CSS worker attempts an internal port
bind and fails with `EPERM`. This remains a full optimized Next.js production
build, not a reduced test build. Re-evaluate the explicit selection after a
future Next.js upgrade proves Turbopack in the same runners.

## CI quality workflow

`.github/workflows/quality.yml` runs only for pull requests targeting
`develop`, `main`, or `release/*`, and for manual `workflow_dispatch`. It:

1. grants only `contents: read`;
2. cancels superseded runs for the same workflow/ref;
3. checks out CMS, frontend infra, Lumia DS, auth SDK, and i18n as siblings;
4. pins GitHub actions to immutable commit SHAs;
5. pins Node `20.15.0` and pnpm `10.33.0` via Corepack;
6. installs with `pnpm install --frozen-lockfile`;
7. installs Chrome and runs `pnpm verify:release`;
8. uploads only failure evidence for three days; and
9. contains no push, package-write, OIDC, environment, image, SSH, release, or
   deployment job.

Private sibling checkout requires the repository secret
`XYNES_REPO_READ_TOKEN`, scoped read-only to those repositories. Never place
the token value in workflow YAML or diagnostic output. The workflow structure,
scripts, permissions, sibling layout, frozen install, Proxy rename, coverage
floor, and Compose mount are enforced by static tests. `actionlint` was not
installed locally; live GitHub validation remains intentionally deferred until
an authorized later PR because this story forbids pushing or opening a PR.

The infra companion change must be integrated before, or together with, the
CMS branch so the workflow's `develop` sibling checkout contains the Proxy
mount contract.

## Automated browser matrix

| Surface | 1440×900 | 768×1024 | 390×844 | `en-US` | `en-XA` |
|---|---:|---:|---:|---:|---:|
| Public landing | Pass | Pass | Pass | Pass | Pass |
| Safe sign-in/sign-up destinations | Pass | Pass | Pass | Pass | Pass |
| Security-policy link | Pass | Pass | Pass | Pass | Pass |
| Keyboard reachability | Pass | Pass | Pass | Pass | Pass |
| Unlabelled-control and CTA-overlap scan | Pass | Pass | Pass | Pass | Pass |
| Authenticated dashboard fixture | Existing responsive suite | Existing responsive suite | Existing responsive suite | Pass | Pass |

Additional cases passed for hostile landing redirects, anonymous protected
navigation, hostile nested redirect input, anonymous `/SECURITY.md`, raw locale
keys, critical console/page errors, secret-shaped content, 24px targets,
keyboard focus order, scroll containment, and pseudo-locale overlap.

## Human verification procedure

Run these checks only against the deterministic local fixture configuration.
Do not enter a real email, password, session cookie, API key, or customer
workspace.

### 1. Landing page and responsive layout

For `en-US` and `en-XA`, repeat at 1440×900, 768×1024, and 390×844:

1. Open `/` and confirm the page is non-blank, has one visible level-one
   heading, a `main` landmark, and readable localized content.
2. Confirm there are no raw `cms.*` catalog keys, hydration messages, React
   page errors, or critical browser-console errors.
3. Confirm primary sign-in and sign-up actions are visible, do not overlap,
   remain keyboard reachable, and point only to the configured Auth App's
   `/login` and `/signup` paths.
4. Confirm visible links and controls have an accessible name and visible
   focus treatment.
5. Confirm the trust surface links to `/SECURITY.md`, and open that link while
   anonymous to verify a successful Markdown response.
6. Inspect narrow widths for clipped text, horizontal document scrolling,
   overlapping actions, truncated pseudo-locale copy, or controls below the
   usable viewport.

### 2. Protect-all redirect

1. With no CMS session cookie, open
   `/dashboard/fixture-slug/content?tab=recent`.
2. Confirm the response redirects to the configured Auth App `/login` route.
3. Decode its `redirect` parameter and confirm the origin is the configured
   CMS origin, the path is `/dashboard/fixture-slug/content`, and `tab=recent`
   is preserved.
4. Repeat with nested redirect values such as `https://attacker.example`,
   `//attacker.example`, `/\\attacker.example`, and a credential-bearing URL.
   Confirm neither the login destination nor return URL leaves the trusted
   origins and no embedded credentials are reflected.

### 3. Dashboard fixture and accessibility

1. With `NEXT_PUBLIC_ENABLE_E2E_FIXTURES=1`, open
   `/e2e/cms-dashboard-scroll` in both locales and desktop/mobile widths.
2. Confirm the dashboard navigation and content-results scroll region are
   visible and independently focusable.
3. Tab through the interface. Confirm focus reaches the sidebar, result
   region, toolbar actions, menus, and controls in logical order.
4. Confirm dense controls retain at least 24×24 CSS pixels, the primary
   toolbar stays pinned, the secondary filter row hides/reappears on results
   scrolling, and sidebar scrolling does not move the document.
5. Confirm `en-XA` expansion does not overlap the primary toolbar and that the
   empty fixture keeps its zero state visible below the sticky stack.

### 4. Workspace Admin integration boundary

1. Open the CMS integrations surface with deterministic fixture data.
2. Confirm domain, API-key, webhook, Content API, and publisher actions remain
   contextual read-only cards; CMS must not expose lifecycle forms.
3. Confirm outgoing Workspace Admin URLs include the encoded originating
   `workspace=<slug>` hint and the typed preset when applicable.
4. Confirm external links use `target="_blank"` plus safe `rel` values, while
   relative fail-closed fallbacks do not pretend to be external.
5. Switch workspace context and verify counts clear while the next request is
   pending; no stale prior-workspace identifiers or values may remain.
6. Confirm no URL, text, accessible label, console entry, screenshot, or trace
   contains a JWT, raw API key, cookie, internal actor identifier, hash,
   service-role marker, provider credential, or PII.

`FE-XAPP-BUG-001` (workspace slug in outgoing Workspace Admin links) and
`FE-XAPP-BUG-002`/`BUG-AUTH-2` (server-authoritative workspace membership
validation) were already implemented. CMS-REL-2 regression-checked their
contracts and did not duplicate either implementation.

## Failure evidence and data handling

- Local Playwright screenshots and traces are failure-only under
  `test-results/`; the HTML report is under `playwright-report/`.
- CI uploads those two paths only when the gate fails and retains them for
  three days.
- Video capture is disabled, avoiding unnecessary persistence of browser
  state.
- Before sharing any artifact, review it for cookies, authorization headers,
  query strings, workspace/user identifiers, tokens, secrets, internal URLs,
  and PII. Delete unsafe evidence locally and rerun with fixture-only data.
- Successful validation produced no failure artifact requiring retention.

## Database backup and restore evidence

CMS-REL-2 does not mutate a database, but a recovery point was created before
local runtime work:

- private directory: `$XYNES_ROOT/local-backups/CMS-REL-2` (`0700`)
- full local Supabase archive: `cms-rel-2-baseline.dump` (`0600`, 346397 bytes)
  - SHA-256 `2a1d84dbec3233098acc5dc8f48c51280ed66f29519baff3150d893912bb4e3a`
- restorable application-schema archive: `cms-rel-2-app-baseline.dump` (`0600`,
  140939 bytes)
  - SHA-256 `9db4eec65e61c0799ade8bf12b748a05962213fbc6dd8af858aba99a630d00b6`

The application archive was restored into the disposable database
`cms_rel_2_restore_verify_20260921` using `pg_restore --clean --if-exists
--exit-on-error --no-owner --no-privileges`. All 35 application tables and
every table's row count matched the source. The scratch database was then
dropped. The full cluster archive remains useful for selective recovery, but a
blank restore of Supabase-managed `realtime` objects requires Supabase tooling
because those objects contain privileged settings. The local backup README is
the recovery runbook and must remain uncommitted/private.

## Acceptance evidence matrix

| Requirement | Evidence |
|---|---|
| Deterministic local scripts and fail-fast ordering | `package.json`; 5 static CMS-REL-2 contract tests; uninterrupted `pnpm verify:release` pass |
| Four configured coverage floors ≥80% | `vitest.config.ts`; static threshold test; final 94.16/87.66/95.97/94.16 results |
| Next.js 16 Proxy migration without auth redesign | 95–96% Git renames; 15/15 Proxy tests; production route manifest; no middleware warning |
| Dev Compose mounts `proxy.ts` | infra commit; 5/5 infra tests; Compose config pass |
| Desktop/tablet/mobile and `en-US`/`en-XA` release matrix | 12/12 `@release`; 31/31 full Playwright suite |
| Safe public allowlist and redirects | Proxy tests plus protected/hostile browser cases |
| Fixture-only authenticated representative UI | explicitly gated `/e2e/*` and empty no-store flags envelope |
| Workspace Admin contextual-consumer boundary | 17 URL/security helper tests plus 27 integrations tests in the full unit gate |
| Directory-first and signed-media invariants | unchanged production ownership; full existing content/storage/editor regression suites pass |
| Feature-flag provider placement/stability | 9/9 provider tests; override object memoized to stop repeated `/flags` fetches |
| Least-privilege non-deploying workflow | immutable action SHAs, `contents: read`, static workflow contract, no push/deploy capability |
| Security and artifact hygiene | hostile-input/secret-pattern checks, failure-only trace/screenshots, video disabled, staged-diff secret scan |
| Database recoverability | application archive restored with exact schema/table row-count parity |
| No CMS-REL-1 overlap | no changes to `next.config.ts`, health route, Dockerfiles, CVE waiver, README, or production-runtime contract |
| Traceability and no remote mutation | two isolated local commits, this evidence record, no push/PR/merge/deploy |

## Findings resolved during certification

1. A newly allocated feature-flag override object caused the auth SDK's fetch
   dependency to change on every render, creating a continuous `/flags`
   request loop. The object is now referentially stable and regression-tested.
2. A content-list test clicked before React committed the asynchronous auth
   bootstrap state, creating order-sensitive false failures. The test now
   awaits that state inside `act`; production behavior was not changed.
3. Next.js 16.3.5's default Turbopack build was environment-sensitive in the
   hardened host. The supported Webpack production builder is now explicit and
   contract-tested so local and CI commands are identical.

## Deferred follow-ups and limitations

- CMS-REL-1 owns Docker image/runtime implementation and container security.
- Group M reusable build/push/deploy workflows and live CI execution remain
  deferred; this workflow is quality-only.
- QA/production Compose, VPS, DNS, Caddy, hosted smoke tests, release tags, and
  all deployment activity are out of scope.
- Real OAuth, production users, customer data, API keys, storage credentials,
  and hosted backends are intentionally not browser-certified here.
- Data Store `DS-*`, product locale switcher `TFU-7`, Weblate/machine
  translation, and auth/Lumia-owned translation work remain separate stories.
- Revisit Turbopack after upgrading Next.js and proving its CSS worker under
  the same hardened local/CI execution policy.
- Configure `XYNES_REPO_READ_TOKEN` before the first authorized workflow run,
  integrate the infra companion commit first/together, and run live GitHub
  workflow validation when a later PR is explicitly authorized.
