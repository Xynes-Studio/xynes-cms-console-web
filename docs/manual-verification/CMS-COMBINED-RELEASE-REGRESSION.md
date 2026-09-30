# CMS Combined Release Regression Checklist

**Status:** Not Run
**Last updated:** 2026-09-30
**Purpose:** Release-level regression of CMS Console, Auth/Workspace Admin,
gateway, CMS Core, authorization, storage, and their critical integrations.

Related API checklist:
[`CMS-API-KEY-REGRESSION.md`](./CMS-API-KEY-REGRESSION.md)

## Source snapshot

| Repository | Visible `develop` ref | Freshness |
|---|---|---|
| CMS Console | `af35ecca488d145e22d09d94bb6add91d736d640` | Fetched 2026-09-30; PR #49 |
| Auth app | `854c536bdfd451fdb2e033ed79149d4dab5ea576` | Fetched 2026-09-30 |
| Auth SDK | `7003ea39d18f0335cd5cb0f1e948aa1cb4e1a131` | Fetched 2026-09-30 |
| Gateway | `d9c47d98b34078f1bc42242104e4ba7a19ce933e` | Fetched 2026-09-30 |
| CMS Core | `35c39042abd594f8ce42da54180702cee0722283` | Fetched 2026-09-30 |
| Accounts | `fbbb5d8755668a4fdc6775b79ac5a5cdb6015d11` | Fetched 2026-09-30 |
| Authz | `9905b0e3d896842522a64177464ead90ce686c04` | Fetched 2026-09-30 |
| Storage | `47c35e796f8e20636bdbe5adcb656f1d8125cf62` | Fetched 2026-09-30 |
| Backend infra/routes | `792803dbbd76128035d39db5b9ae85f59a9d5f59` | Local `origin/develop`; remote fetch unavailable |

> Source-pin note: GitHub CLI showed CMS PR #49 as the newest visible merged
> PR and returned no merged PR matching `RDL2`, `RDL-2`, or `RDL`. Before a
> release run, replace the CMS pin above if a different PR/commit was intended.

## Lanes and execution budget

| Lane | Owner | What belongs here | Target time |
|---|---|---|---:|
| Agent smoke | AI agent | Deterministic health, build, API, browser and cleanup checks | 30–45 min |
| Agent full | AI agent | Repository gates, repeatable lifecycle and resilience checks | 90–120 min |
| Human | Human tester | Real OAuth/email, subjective visual/UX, physical devices and assistive technology | 45–60 min |

Run Agent smoke first. Stop the release run if any P0 check fails; do not spend
tokens or human time on downstream checks against a broken baseline.

## Entry criteria

- [ ] Exact repository commits under test are recorded above.
- [ ] Only local/QA data and accounts are used; production is out of scope.
- [ ] Docker and local Supabase are available.
- [ ] Canonical ignored env files exist: frontend `infra/.env`; backend
      `xynes-infra/.env.dev` and `.env.localhost`.
- [ ] No raw JWT, cookie, API key, provider credential, or signed URL will be
      copied into this document, screenshots, command output, or bug reports.
- [ ] A disposable workspace or an approved disposable directory is available.
- [ ] Test data uses `QA-CMS-REG-<timestamp>` and every created ID is recorded
      for cleanup.

## Environment topology

| Surface | Expected local URL/port |
|---|---|
| CMS Console | `http://localhost:3000` |
| Auth / Workspace Admin | `http://localhost:3100` |
| Gateway | `http://localhost:4100` |
| Doc / CMS Core / Accounts / Storage | `4201` / `4202` / `4203` / `4204` |
| Authz / Telemetry | `4300` / `4400` |
| Supabase gateway | `http://127.0.0.1:54321` |

Port `3300` is valid only when the CMS host mapping, public app URL, redirect
allowlist, and cookie/origin expectations are changed together. Do not mix
`3000` and `3300` within one run.

# Agent-owned regression

## A0 — Source and runtime preflight (P0, smoke)

- [ ] `git status --short --branch` is captured for every repository; unrelated
      dirty files are preserved and noted.
- [ ] CMS/Auth/frontend stack starts without rebuilding unrelated services.
- [ ] Backend stack and local Supabase start successfully.
- [ ] Frontend `./run.sh health` reports Auth, CMS, Supabase and API healthy.
- [ ] Backend `./scripts/smoke-health.sh` reports HTTP 200 for `/health` and
      `/ready` on gateway, accounts, doc, CMS Core, authz, telemetry and storage.
- [ ] `GET http://localhost:3000/api/health` is redacted and healthy.
- [ ] `GET http://localhost:3100/api/health` is healthy.
- [ ] No service log contains a raw token/key, stack trace with credentials, or
      signed-provider query material.

Evidence:

```text
Commit pins:
Health result:
Unexpected logs:
```

## A1 — Repository quality gates (P0, full)

Run from the owning repository. Record command, exit code, counts and coverage;
do not paste full successful logs.

### CMS Console

- [ ] `pnpm lint`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm test:coverage`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] All configured coverage thresholds pass; no skipped P0 browser case.

### Auth app

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test:coverage`
- [ ] `pnpm build`

### Cross-service contract gates

- [ ] Infra route/permission contract tests pass.
- [ ] Gateway, CMS Core, accounts, authz and storage focused/full suites pass
      according to their repository scripts.
- [ ] Dependency/security checks have no unwaived high/critical production
      finding. External advisory uploads require explicit authorization.

## A2 — Public, authentication and session smoke (P0, smoke)

| ID | Agent action | Expected result | Status |
|---|---|---|---|
| A2.1 | Open CMS `/` signed out | Public landing page renders; CTA goes to Auth with a safe return target | [ ] |
| A2.2 | Open a protected CMS dashboard URL signed out | Redirects to Auth; requested CMS route is preserved | [ ] |
| A2.3 | Use seeded local email/password test account | One login transaction; CMS workspace opens without error flash | [ ] |
| A2.4 | Hard-refresh the CMS dashboard | Session survives; no redirect loop or cross-origin cookie error | [ ] |
| A2.5 | Probe an inaccessible workspace slug | Redirects/fails closed; no other-workspace data is rendered | [ ] |
| A2.6 | Logout from CMS | Busy state blocks interaction; Auth is reached; Back cannot expose protected content | [ ] |
| A2.7 | Visit Auth protected dashboard signed out | Auth guard redirects to login without leaking protected markup | [ ] |

## A3 — CMS directory and content lifecycle (P0, full)

Use one disposable directory and entry. Record their exact IDs.

| ID | Agent action | Expected result | Status |
|---|---|---|---|
| A3.1 | Load root Content in list and grid views | Entries render once; counts/status/owner labels are coherent | [ ] |
| A3.2 | Create nested directory | Tree updates without reload; duplicate/blank/invalid names are rejected safely | [ ] |
| A3.3 | Rename directory | Path/tree update consistently; current content remains reachable | [ ] |
| A3.4 | Navigate directories with search/sort/filter/grid state | Supported state persists; pagination resets; unknown query keys are dropped | [ ] |
| A3.5 | Create an entry inside the directory | One draft is created in the correct workspace/directory | [ ] |
| A3.6 | Edit title/body and wait for autosave | Saved state is confirmed; hard refresh restores identical content | [ ] |
| A3.7 | Exercise draft → publish → draft/scheduled → archived transitions | Controls, timestamps and badges match persisted state after refresh | [ ] |
| A3.8 | Favourite/unfavourite from list and grid | Both views stay in sync; favourites filter is correct across pagination | [ ] |
| A3.9 | Generate/share internal link | Safe workspace-scoped editor URL is copied/returned; no external redirect | [ ] |
| A3.10 | Upload a disposable image when flag/role permit | Upload, save and refresh render through fresh URL; entry stores object ID, not signed URL | [ ] |
| A3.11 | Attempt upload without permission | Safe role-aware error; no filename, backend code, key or signed URL leak | [ ] |
| A3.12 | Delete entry and directory with confirmation | Soft-delete succeeds; deleted content disappears; unrelated data remains | [ ] |

## A4 — Cross-app Workspace Admin integration (P0/P1, full)

| ID | Agent action | Expected result | Status |
|---|---|---|---|
| A4.1 | Switch workspace in Auth, then open CMS | CMS opens the same authorized workspace and preserves safe subpath intent | [ ] |
| A4.2 | Create a disposable workspace from CMS handoff | Auth onboarding returns to the intended CMS workspace | [ ] |
| A4.3 | Open CMS Integrations | Read-only domain/API-key counts load or fail closed with safe unavailable state | [ ] |
| A4.4 | Follow Domains/API Keys/CMS preset deep links | Auth opens correct tab/preset for the same workspace; new-tab links use safe `rel` | [ ] |
| A4.5 | Probe malformed/hostile return URL | Allowlist fallback is used; no open redirect | [ ] |
| A4.6 | Exercise Auth directory/invite pages with authorized role | List/create/resend flows use safe errors and do not cross workspace boundaries | [ ] |
| A4.7 | Open placeholder/non-MVP CMS routes | Route renders its documented state without crash or false capability claim | [ ] |

## A5 — Resilience, accessibility and security (P0/P1, full)

- [ ] Gateway outage makes CMS health fail closed and user-facing requests show
      safe retryable errors; recovery succeeds without rebuilding the stack.
- [ ] CMS Core outage affects CMS data only; Auth remains usable.
- [ ] Auth outage prevents login/handoff cleanly; existing CMS protected data is
      not exposed.
- [ ] Storage outage does not corrupt entry JSON or leave untracked test data.
- [ ] Browser Console has no uncaught exception or critical hydration error.
- [ ] Network panel has no unexplained 5xx, redirect loop, mixed content, or
      cross-origin failure.
- [ ] Keyboard-only automated pass reaches navigation, tree, grid menu, editor,
      dialogs and logout in logical order with visible focus.
- [ ] Desktop and mobile Playwright views have no clipped pseudo-locale text,
      nested controls, overlapping sticky bars or hidden zero-state content.
- [ ] Security headers/CSP route tests pass; external links use safe schemes and
      `noopener noreferrer` when opening a new tab.
- [ ] No response/UI/log includes raw access tokens, API keys, cookies, hashes,
      internal service tokens, provider credentials or signed URLs.

# Human-only verification

Do not repeat deterministic agent checks unless the agent reports a failure.

## H1 — Real identity and delivery paths (P0)

- [ ] Complete real Google OAuth from a signed-out protected CMS URL; verify no
      transient error and exact return target.
- [ ] Complete signup email verification using a real inbox.
- [ ] Complete forgot-password/reset-password using a real delivered link.
- [ ] Accept a real workspace invitation, including identity-mismatch handling
      and already-member/self-invite messaging.
- [ ] Confirm logout/session revocation in a second tab or browser profile.

## H2 — Qualitative UX and physical-device checks (P1)

- [ ] Review visual hierarchy, spacing, copy clarity and perceived loading on
      CMS landing, dashboard, content editor and Auth flows.
- [ ] Check hover/pressed/focus/disabled affordances with mouse and keyboard.
- [ ] Verify clipboard behavior for share links and API-key one-time reveal.
- [ ] Run VoiceOver or another real screen reader through login, navigation,
      editor actions, dialogs and error announcements.
- [ ] Check Chrome plus one non-Chromium desktop browser.
- [ ] Check one physical mobile device for keyboard, viewport, scrolling,
      dialogs and touch-target usability.
- [ ] Confirm branded emails, sender identity, link host and expiry copy.

# Cleanup

- [ ] Delete/soft-delete every `QA-CMS-REG-*` entry and directory.
- [ ] Delete disposable uploads and confirm their storage rows are deleted.
- [ ] Remove temporary workspace memberships/roles and revoke temporary keys.
- [ ] Restore feature-flag overrides and outage simulations.
- [ ] Confirm original user role, workspace and pre-existing content are intact.
- [ ] Remove only disposable containers/networks created for this run.

# Release decision

Release is **Go** only when:

- [ ] Every Agent and Human P0 case passes.
- [ ] At least 90% of P1 cases pass; every exception has an owner and accepted
      workaround.
- [ ] No open critical/high security, authorization, cross-workspace, data-loss
      or session defect remains.
- [ ] No unexplained 5xx/console error remains.
- [ ] Cleanup is verified.
- [ ] The API checklist is complete for the supplied key or explicitly marked
      out of release scope by the release owner.

## Run summary

| Lane | Total | Pass | Fail | Blocked | Not Run |
|---|---:|---:|---:|---:|---:|
| Agent smoke | | | | | |
| Agent full | | | | | |
| Human | | | | | |

**Decision:** `Go / Conditional Go / No Go`
**Tester(s):**
**Date:**
**Build/commits:**
**Bug links and notes:**

```text

```
