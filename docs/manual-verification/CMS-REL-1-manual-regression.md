# CMS-REL-1 Manual Regression Checklist

Editable human-verification checklist for the CMS Console production runtime.
The immutable implementation and automated evidence remain documented in
[`CMS-REL-1-production-runtime.md`](./CMS-REL-1-production-runtime.md).
Defects and retest criteria are tracked in
[`CMS-REL-1-bug-report.md`](./CMS-REL-1-bug-report.md). Use the editable
[`CMS-REL-1-defect-fixes-manual-verification.md`](./CMS-REL-1-defect-fixes-manual-verification.md)
for the post-fix human run.

## Execution record

| Field | Value |
|---|---|
| Date | Initial manual run: 2026-09-22; local remediation evidence: 2026-09-23 |
| Tester | Archan Ray (manual) and Codex (automated REG-11, REG-12, REG-16, defect remediation) |
| Branch | `feature/cms-release-runtime-hardening` |
| Commit | `1eac9ad079715ddb4882c6f1f79aef0f4b88fc12` |
| Image tag | `xynesplatform/xynes-cms-console-web:local-regression` |
| Image ID | `sha256:ea9e2492c6f195478cdf79cea4f3aba545375d51e81017658e1cacec78791982` |
| Browser and version | Google Chrome `153.0.8010.53` |
| Operating system | macOS `26.6.2` (`25G83`) |
| Workspace slug | `xynes` |
| Overall result | **No Go** — post-fix human retest incomplete; port-3300 storage mismatch removed from local scope |
| Related bug IDs | `CMS-REL-1-BUG-001` through `CMS-REL-1-BUG-007` |

## Scope

This suite validates:

- production-image health and hardening;
- authentication and protected-route behavior;
- critical CMS content workflows;
- gateway degradation and recovery;
- responsive, keyboard, and scroll-layout regressions;
- cleanup of disposable test data and containers.

For the current local-only regression, run browser cases against the canonical
stack at `http://localhost:3000`. The port-3300 production-image procedure below
is retained only as historical evidence from the 2026-09-22 run and is not a
current prerequisite or release gate.

## Required regression image

Do **not** run the authentication and browser cases against
`xynesplatform/xynes-cms-console-web:local-test`. That immutable runtime-evidence
image intentionally contains a fixture Supabase origin and a port-3000 return
URL, so it cannot complete REG-03 on port 3300.

Use the separate `local-regression` tag. It is built from the same source and
Dockerfile, but injects the local public browser configuration and an explicit
port-3300 CMS return URL. Building this tag does not replace or retag the
recorded `local-test` evidence image.

```bash
cd /Users/archanray/xynes-erp/xynes-front-end

set -a
source infra/.env
set +a

docker buildx build \
  -f xynes-cms-console-web/Dockerfile \
  --target prod \
  --load \
  --build-arg XYNES_BUILD_VERSION=sha-local-regression \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_API_URL="$PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3300 \
  --build-arg NEXT_PUBLIC_AUTH_APP_URL="$AUTH_APP_URL" \
  --build-arg NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS=127.0.0.1:3300,localhost:3300,127.0.0.1:3100,localhost:3100 \
  -t xynesplatform/xynes-cms-console-web:local-regression \
  .
```

Run the hardened regression container on the existing disposable test network:

```bash
docker run -d \
  --name cms-rel-1-console \
  --network cms-rel-1-test \
  -p 127.0.0.1:3300:3000 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --security-opt no-new-privileges:true \
  -e NEXT_API_URL=http://cms-rel-1-gateway:4100 \
  xynesplatform/xynes-cms-console-web:local-regression
```

Before starting REG-02, confirm the redirect returns to port 3300:

```bash
curl -sS -D - -o /dev/null http://127.0.0.1:3300/dashboard
```

Expected `location` shape:

```text
http://localhost:3100/login?redirect=http%3A%2F%2Flocalhost%3A3300%2Fdashboard
```

The CMS and Auth browser origins must both use the `localhost` hostname. Using
`127.0.0.1` for CMS and `localhost` for Auth creates distinct browser cookie
origins and prevents the local Supabase session from completing the handoff.

The Auth app must also allow the regression origin. In the git-ignored
`xynes-front-end/infra/.env`, include both port-3300 forms in the local-only
allowlist and restart `xynes-auth-app` before REG-03:

```dotenv
ALLOWED_REDIRECT_DOMAINS=localhost:3000,localhost:3100,localhost:3300,127.0.0.1:3300
```

## Preconditions

- [x] The exact branch and commit under test are recorded above.
- [x] The `local-regression` production image has been built from the
      `xynes-front-end/` parent directory using the instructions above.
- [x] The hardened CMS container is available at `http://localhost:3300`.
- [x] The Auth app is available at `http://localhost:3100`.
- [x] Gateway and required backend services are healthy.
- [ ] A non-production test user can access a disposable workspace.
- [ ] Browser developer tools are open with Console and Network preservation
      enabled.
- [ ] Test content will use the name `QA-CMS-REL-1-<timestamp>`.
- [ ] No production credentials, content, workspace, or API key is used.

## Local environment readiness — 2026-09-22

- `http://localhost:3300/api/health` returns HTTP 200 with
  `version: "sha-local-regression"` and `checks.gateway: "ok"`.
- Frontend health passes for Auth (`3100`), CMS dev (`3000`), Supabase, and
  gateway (`4100`).
- Backend health and readiness pass for gateway, accounts, documents, CMS
  core, authorization, telemetry, and storage (14/14 probes).
- The authenticated platform smoke passes 46/46 checks with 0 failures and 0
  skips, including workspace, document, CMS create/update/list/share/publish,
  comments, public content, flags, and telemetry.
- Browser verification on the production CMS image confirms the authenticated
  `xynes` workspace content list, six entries, and the Content, Integrations,
  Plugins, Access Control, and Settings routes without 404/500 responses.
- **Storage gate closure:** the earlier port-3300 result remains historical and
  did not require a provider-policy change. The configured port-3000 stack was
  exercised with both `workspace_member` and temporary `content_editor`
  permissions. The denial path rendered safe role-aware feedback; the
  authorized path reached Ready, survived save/refresh using object-ID-only
  persistence, and completed object/entry cleanup. See
  [CMS-REL-1-BUG-007](./CMS-REL-1-bug-report.md#cms-rel-1-bug-007-permission-denied-media-upload-surfaces-only-a-generic-failure).

## Initial execution summary — 2026-09-22

| ID | Priority | Test | Result | Bug/evidence |
|---|---|---|---|---|
| REG-01 | P0 | Application health | Pass | HTTP 200; gateway check ok on 2026-09-22 |
| REG-02 | P0 | Protected-route redirect | Pass | Redirected to Auth without exposing protected content |
| REG-03 | P0 | Login and CMS return | Fail | [CMS-REL-1-BUG-001](./CMS-REL-1-bug-report.md#cms-rel-1-bug-001-successful-google-login-briefly-displays-an-error) |
| REG-04 | P0 | Dashboard navigation | Pass | Five workspace routes loaded without 404/500 on 2026-09-22 |
| REG-05 | P0 | Content and directory navigation | Fail | [CMS-REL-1-BUG-002](./CMS-REL-1-bug-report.md#cms-rel-1-bug-002-content-view-mode-resets-during-directory-navigation) |
| REG-06 | P0 | Create and autosave entry | Pass | Entry `45d30707-6616-4dec-857e-06e63568686e` persisted after reload |
| REG-07 | P0 | Unsaved-change protection | Pass | Cancel and confirm behavior worked as expected |
| REG-08 | P0 | Publish lifecycle | Pass | Functional flow passed; UI follow-up [CMS-REL-1-BUG-003](./CMS-REL-1-bug-report.md#cms-rel-1-bug-003-publish-controls-lack-consistent-hover-feedback) |
| REG-09 | P0 | Delete cleanup | Fail | Deletion succeeded, but grid action is unavailable: [CMS-REL-1-BUG-004](./CMS-REL-1-bug-report.md#cms-rel-1-bug-004-grid-view-does-not-expose-entry-actions-discoverably) |
| REG-10 | P0 | Session protection | Pass | Protection passed; logout UX follow-up [CMS-REL-1-BUG-005](./CMS-REL-1-bug-report.md#cms-rel-1-bug-005-logout-lacks-a-blocking-progress-state) |
| REG-11 | P0 | Gateway outage | Pass | Two closed-schema 503 responses; failed probe cached |
| REG-12 | P0 | Gateway recovery | Pass | Health 200 and browser navigation restored after cache expiry |
| REG-13 | P1 | Responsive layout | Fail | Desktop failed; tablet/mobile not run. [CMS-REL-1-BUG-006](./CMS-REL-1-bug-report.md#cms-rel-1-bug-006-sorting-toolbar-flickers-after-rapid-scrolling) |
| REG-14 | P1 | Keyboard navigation | Not Run | |
| REG-15 | P0 | Scroll-layout regression | Fail | First repetition failed; remaining repetitions not run. [CMS-REL-1-BUG-006](./CMS-REL-1-bug-report.md#cms-rel-1-bug-006-sorting-toolbar-flickers-after-rapid-scrolling) |
| REG-16 | P1 | Runtime hardening | Pass | Read-only root, non-root UID/GID 1001, no-new-privileges, writable `/tmp` |

Use only `Pass`, `Fail`, `Blocked`, or `Skipped` after execution. A skipped P0
case prevents release certification.

## Local remediation revalidation — 2026-09-23

The original results above remain the historical production-image run. The
table below records code/automated remediation evidence; it does not convert a
case to a human Pass. Execute the dedicated editable runbook before release.

| Bug | Local remediation | Automated evidence | Human retest |
|---|---|---|---|
| BUG-001 | Fixed in Auth callback single-flight handling | Auth 998/998 tests; callback included in coverage; lint, types, build pass; all aggregate coverage metrics >=85% | Pending real Google OAuth |
| BUG-002 | Fixed with shared closed-allowlist content query navigation | Shell, breadcrumb, parser, and serializer regressions pass | Pending production image |
| BUG-003 | Fixed lifecycle menu pointer/disabled affordance | CMS editor tests and Lumia 39/39 cursor/button tests pass | Pending production image |
| BUG-004 | Fixed grid overflow menu and action parity | Component, mapper, and panel integration tests pass | Pending production image |
| BUG-005 | Fixed single-flight logout blocker and failure recovery | Shell accessibility/interaction tests pass | Pending production image |
| BUG-006 | Fixed geometry clamp, zero-height measurement, and layout transition feedback | 50/50 focused Chrome bottom-scroll repetitions and final 20/20 full Playwright suite pass | Pending responsive production image |
| BUG-007 | Added safe role-aware upload-denial feedback and fixed Lumia file-picker `objectId` persistence | Port-3000 denial and authorized upload/save/refresh/delete paths pass; persisted `src` is empty and cleanup is complete | Pass |

Port-3000 readiness was rechecked on 2026-09-23: the frontend health runner
reported Auth (`3100`), CMS (`3000`), Supabase, and API (`4100`) healthy. The
authenticated disposable editor was opened successfully. A manually selected
image then proved the actual canonical failure was an RBAC denial: the gateway
returned HTTP 403 while the active `workspace_member` lacked
`platform.storage.objects.upload`; storage-service and the provider were not
reached. The CMS now renders safe role-aware feedback for that denial. A
temporary local `content_editor` role was added for the positive path. Chrome
attached the disposable PNG after local-file access was enabled. The object
reached Ready, the corrected Lumia file-picker path persisted `objectId` with
an empty `src`, a hard refresh rendered a fresh signed URL, and gateway cleanup
deleted the object plus four disposable entries. The temporary role was then
removed, restoring the user to `workspace_member` only.

Quality/security evidence at this checkpoint:

- CMS final: 66 files / 777 tests pass; coverage is 91.45% statements, 85.13%
  branches, 97.12% functions, and 92.07% lines. Lint, strict TypeScript,
  production build, and 20/20 Playwright tests pass.
- Lumia editor dependency: 109 files / 1,190 tests pass with 2 skips; focused
  file-picker tests cover present, missing, and empty `objectId` values.
  Package coverage is 89.25% statements, 80.12% branches, 88.56% functions,
  and 90.36% lines; lint and production DTS/ESM build pass. The package-wide
  branch baseline predates CMS-REL-1; the CMS application's enforced aggregate
  gate remains above 85% on every metric.
- CMS production and full dependency audits have zero high/critical findings;
  production has one low and the full tree has two moderate plus one low.
- Auth final: 90 files / 998 tests pass; coverage is 91.72% statements, 85.15%
  branches, 93.48% functions, and 93.37% lines. The changed callback page is
  measured at 93.26% statements, 87.50% branches, 88.88% functions, and
  96.03% lines. Lint, sequential strict
  TypeScript, and the Next 15.5.26 build pass.
- Auth production audit has zero high/critical findings and one low finding.
  The broad linked-workspace development audit still reports advisories owned
  by linked Lumia development tooling; no production Auth path is affected.

## REG-01: Application health

**Priority:** P0

**Result:** Pass

1. Open `http://localhost:3300/api/health` without an authenticated session.
2. Confirm that the HTTP status is `200`.
3. Inspect the response headers and JSON body.

Expected:

- `ok` is `true`.
- `service` is `xynes-cms-console-web`.
- `version` is neither empty nor `development`.
- `uptime_seconds` is a non-negative integer.
- `checks.gateway` is `ok`.
- `Cache-Control` is `no-store`.
- The response exposes no URL, token, environment value, stack trace, error
  detail, or filesystem path.

**Actual result/evidence:**

> {"ok":true,"service":"xynes-cms-console-web","version":"sha-local-regression","uptime_seconds":75,"checks":{"gateway":"ok"}}

## REG-02: Protected-route redirect

**Priority:** P0

**Result:** Pass

1. Sign out or open a private browser window.
2. Open `http://localhost:3300/dashboard`.
3. Observe the complete redirect chain in the Network panel.

Expected:

- CMS redirects to the Auth app on port `3100`.
- Dashboard content is not exposed before the redirect.
- The return target points back to the CMS application.
- No unsafe external return URL or redirect loop occurs.

**Actual result/evidence:**

> Worked as expected

## REG-03: Login and CMS return

**Priority:** P0

**Result:** Fail

**Related bug:** [CMS-REL-1-BUG-001](./CMS-REL-1-bug-report.md#cms-rel-1-bug-001-successful-google-login-briefly-displays-an-error)

1. Log in with the designated test account using email/password or Google.
2. Complete the Auth profile gate if the test account does not yet have a
   display name.
3. Complete workspace creation or selection if it is displayed.
4. Allow the Auth app to return to CMS.
5. Refresh the resulting CMS page.

Expected:

- Login completes without a visible or console error.
- Google is displayed only when `xynes_auth_oauth_google` is enabled.
- Any required profile or workspace bootstrap preserves the encoded CMS
  dashboard return target.
- The user returns to the CMS dashboard.
- The intended workspace is active.
- Refreshing does not send the user back to login.

**Actual result/evidence:**

> Still reproducible: Authenticated with Google, it flashed for a few second an error message and try again and then it moved to dashboard it shall not show any error message if Login succeeds.

**Prior redirect resolution and revalidation (2026-09-21):**

- Fixed CMS middleware to rebuild the protected return target from the
  configured public app origin while preserving the requested path and query.
- Added port `3300` to the Auth app's local redirect allowlist and used the
  `localhost` hostname for both Auth and CMS so the browser session cookie is
  shared across ports.
- Recovered the unhealthy local Supabase database after Docker build cache had
  exhausted Docker storage; no database volume was removed or reset.
- Browser revalidation passed: refreshing `http://localhost:3300/dashboard`
  retained the authenticated session and resolved to
  `http://localhost:3300/dashboard/xynes/content` with workspace `xynes` active
  and the content list visible. This confirms the return-target fix but does
  not resolve the transient false error recorded above.

## REG-04: Dashboard navigation

**Priority:** P0

**Result:** Pass

1. Open the active workspace dashboard.
2. Visit Content, Integrations, Plugins, Access Control, and Settings.
3. Return to Content.

Expected:

- Each navigation action finishes without a `404` or `500` response.
- Workspace slug and workspace context remain consistent.
- Coming-soon panels appear cleanly where intentionally used.
- No critical browser-console error occurs.

**Actual result/evidence:**

> Browser-verified `Content`, `Integrations`, `Plugins`, `Access Control`, and
> `Settings` on `http://localhost:3300/dashboard/xynes/*`. Workspace `xynes`
> remained active; Content returned to a populated six-entry list. The three
> intentional coming-soon panels rendered cleanly, and Integrations rendered
> the Workspace Admin handoff panel.

## REG-05: Content and directory navigation

**Priority:** P0

**Result:** Fail

**Related bug:** [CMS-REL-1-BUG-002](./CMS-REL-1-bug-report.md#cms-rel-1-bug-002-content-view-mode-resets-during-directory-navigation)

1. Open Content.
2. Expand and collapse available directories.
3. Open a nested directory.
4. Switch between list and grid views.
5. Exercise search, sorting, and filtering controls.
6. Refresh the page.

Expected:

- Directory-first navigation does not require a content-type selection.
- The URL represents the selected directory path.
- Displayed entries belong to the selected directory.
- View and query state remain coherent after refresh.
- Loading, empty, and error states do not overlap navigation or toolbars.

**Actual result/evidence:**

> Switch between list and grid views. Doesn't persist view choice and refreshes everytime moving between content folder.

## REG-06: Create and autosave an entry

**Priority:** P0

**Result:** Pass

1. Select a disposable directory.
2. Select **Create content**.
3. Enter the following values:

   | Field | Value |
   |---|---|
   | Title | `QA-CMS-REL-1-<timestamp>` |
   | Description | `Manual release regression` |
   | Tags | `qa, regression` |
   | Body | `CMS-REL-1 production runtime validation` |

4. Wait for autosave confirmation.
5. Refresh the editor.

Expected:

- One entry is created in the selected directory.
- The editor uses an entry-specific URL.
- Autosave finishes without creating a duplicate entry.
- Every entered value survives refresh.
- No raw API response or internal error is shown.

**Created entry ID or URL:**

> 45d30707-6616-4dec-857e-06e63568686e

**Actual result/evidence:**

> It saved and reload kept changes.

## REG-07: Unsaved-change protection

**Priority:** P0

**Result:** Pass

1. Change the test entry title.
2. Immediately navigate back before autosave completes.
3. Cancel the leave confirmation.
4. Confirm that the editor remains open.
5. Repeat the navigation and confirm leaving.

Expected:

- Unsaved changes trigger a confirmation.
- Cancel preserves the editor and current input.
- Confirm leaves the editor without a loop or duplicate save.

**Actual result/evidence:**

> Worked as expected.

## REG-08: Publish lifecycle

**Priority:** P0

**Result:** Pass

**Follow-up bug:** [CMS-REL-1-BUG-003](./CMS-REL-1-bug-report.md#cms-rel-1-bug-003-publish-controls-lack-consistent-hover-feedback)

1. Reopen the test entry.
2. Save the draft.
3. Select **Publish**.
4. Return to the content list and refresh it.
5. Reopen the entry.
6. Move the entry back to Draft and then Archive it when those actions are
   available.

Expected:

- Publish executes once and disables conflicting controls while pending.
- Published status and timestamp are displayed correctly.
- The content list reflects the persisted status after refresh.
- Draft and archive transitions persist.
- Repeated clicks do not produce duplicate requests.

**Actual result/evidence:**

> Functionality wise it passes, few buttons don't change cursor or give feedback when hovering over them.

## REG-09: Delete cleanup

**Priority:** P0

**Result:** Fail

**Related bug:** [CMS-REL-1-BUG-004](./CMS-REL-1-bug-report.md#cms-rel-1-bug-004-grid-view-does-not-expose-entry-actions-discoverably)

1. Return to the content list.
2. Open the disposable entry's action menu and select Delete.
3. Cancel the first confirmation.
4. Confirm that the entry remains present.
5. Repeat the action and confirm deletion.
6. Refresh the content list.

Expected:

- Cancel preserves the entry.
- Confirm removes the entry from the visible list.
- A success notification appears.
- The entry does not reappear after refresh.
- No other entry is affected.

**Actual result/evidence:**

> The content was deleted and remained absent after refresh.

**Follow-up:**

> Delete and other entry actions are not visible in grid view. Add a visible,
> keyboard-accessible overflow menu; an optional context menu must not replace
> that accessible trigger.

## REG-10: Session protection

**Priority:** P0

**Result:** Pass

**Follow-up bug:** [CMS-REL-1-BUG-005](./CMS-REL-1-bug-report.md#cms-rel-1-bug-005-logout-lacks-a-blocking-progress-state)

1. Sign out.
2. Use browser Back to revisit the CMS dashboard.
3. Directly open the previously visited editor URL.

Expected:

- Protected information is not rendered from stale browser state.
- The user is redirected to Auth.
- Entry content is not visible before redirect.

**Actual result/evidence:**

> 1. Logout should trigger a full-screen loader or overlay that prevents users
>    from submitting or selecting items while session teardown is in progress.
> 2. Other than that it's working as expected.

**Follow-up:**

> Add an accessible, interaction-blocking progress state during logout.

## REG-11: Gateway outage

**Priority:** P0

**Result:** Pass

1. Stop only the disposable gateway stub:

   ```bash
   docker stop cms-rel-1-gateway
   ```

2. Request CMS health twice:

   ```bash
   curl -i http://127.0.0.1:3300/api/health
   curl -i http://127.0.0.1:3300/api/health
   ```

Expected:

- Both requests return `503`.
- The health response retains its closed schema.
- `checks.gateway` is `fail`.
- The second response is faster because failure is cached.
- No infrastructure or exception detail is exposed.

**First request duration:** 1.395687 seconds

**Second request duration:** 0.018952 seconds

**Actual result/evidence:**

> Executed 2026-09-22 against the disposable `cms-rel-1-gateway` container
> on network `cms-rel-1-test`. A healthy baseline returned HTTP 200 with
> `checks.gateway: "ok"`. After stopping only that gateway, both requests
> returned HTTP 503 and the exact closed response shape below:
>
> ```json
> {
>   "ok": false,
>   "service": "xynes-cms-console-web",
>   "version": "sha-local-regression",
>   "uptime_seconds": 40233,
>   "checks": { "gateway": "fail" }
> }
> ```
>
> Both responses included `Cache-Control: no-store`. No gateway URL,
> exception, token, environment value, or filesystem detail was exposed. The
> cached second response was approximately 73 times faster than the initial
> failed probe.

## REG-12: Gateway recovery

**Priority:** P0

**Result:** Pass

1. Restart the disposable gateway stub:

   ```bash
   docker start cms-rel-1-gateway
   ```

2. Wait at least 30 seconds for the failure cache to expire.
3. Request `/api/health` again.
4. Refresh the CMS browser page.

Expected:

- Health returns to `200`.
- `checks.gateway` returns to `ok`.
- CMS recovers without rebuilding or restarting its container.
- Normal navigation works again.

**Actual result/evidence:**

> Restarted only `cms-rel-1-gateway`, waited more than 30 seconds, and
> confirmed the container was `running`. The fresh health request returned
> HTTP 200 in 0.068991 seconds:
>
> ```json
> {
>   "ok": true,
>   "service": "xynes-cms-console-web",
>   "version": "sha-local-regression",
>   "uptime_seconds": 40303,
>   "checks": { "gateway": "ok" }
> }
> ```
>
> Refreshed `http://localhost:3300/dashboard/xynes/content` in the existing
> authenticated browser session. The six-item Content list rendered again.
> Navigation to Plugins rendered its expected coming-soon panel, and returning
> to Content restored the same six-item list. The CMS container was neither
> rebuilt nor restarted.

## REG-13: Responsive layout

**Priority:** P1

**Result:** Fail

**Related bug:** [CMS-REL-1-BUG-006](./CMS-REL-1-bug-report.md#cms-rel-1-bug-006-sorting-toolbar-flickers-after-rapid-scrolling)

Repeat Content-list and editor checks at these viewport sizes:

| Viewport | Result | Notes/evidence |
|---|---|---|
| Desktop `1440 x 900` | Fail | Sorting/filter toolbar flickered after rapid scrolling and remained unstable until another action |
| Tablet `768 x 1024` | Not Run | |
| Mobile `390 x 844` | Not Run | |

Expected:

- No horizontal page overflow appears.
- Controls remain readable and reachable.
- Dialogs remain inside the viewport.
- Long titles and tags do not break the layout.

**Observations:**

1. The top sorting bar flickers on desktop after rapidly scrolling to the end
   and remains unstable until another action occurs.
2. A local HEIC screenshot was captured on 2026-09-22 but is not committed;
   reviewers should use the linked bug report and the new manual rerun evidence.
3. Tablet and mobile rows remain unexecuted.

## REG-14: Keyboard navigation

**Priority:** P1

**Result:** Not Run

1. Reload the Content page.
2. Navigate using only `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape`.
3. Open and close menus and the delete confirmation dialog.

Expected:

- Keyboard focus is always visible.
- Focus order follows the visual order.
- Sidebar, toolbar, results, menus, and dialogs are reachable.
- Escape closes overlays and returns focus to the trigger.
- No keyboard trap exists.

**Actual result/evidence:**

> Add screenshot or notes here.

## REG-15: Scroll-layout regression

**Priority:** P0

**Historical result (2026-09-22):** Fail

**Post-fix status:** Automated Playwright stress coverage passes; the five-run
human repetition remains pending and this case is not yet a manual Pass.

**Related bug:** [CMS-REL-1-BUG-006](./CMS-REL-1-bug-report.md#cms-rel-1-bug-006-sorting-toolbar-flickers-after-rapid-scrolling)

1. Populate or select a directory with enough entries to scroll.
2. Scroll the results area down and back up several times.
3. Scroll the directory sidebar independently.
4. Observe the primary and secondary toolbars throughout.
5. Repeat the scenario five times.

Expected:

- The primary toolbar remains pinned.
- The filter row hides while scrolling down and reopens correctly when
  scrolling up.
- Sidebar scrolling does not move the results area.
- Content does not become hidden behind the sticky toolbar stack.
- All five repetitions pass.

| Repetition | Result | Notes/evidence |
|---|---|---|
| 1 | Fail | Sorting/filter toolbar flickered after rapid scrolling and remained unstable until another action |
| 2 | Not Run | |
| 3 | Not Run | |
| 4 | Not Run | |
| 5 | Not Run | |

This is release-sensitive because the related Playwright case has previously
been intermittent. Do not hide a failure with retries; record the reproduction
and treat it as a combined-release blocker.
**Observations:**

1. Repetition 1 failed with persistent toolbar flicker after a rapid scroll.
2. A local HEIC screenshot was captured on 2026-09-22 but is not committed;
   reviewers should use the linked bug report and new manual rerun evidence.
3. Repetitions 2–5 were not run after the release-sensitive failure.

## REG-16: Runtime hardening

**Priority:** P1

**Result:** Pass

Run:

```bash
docker inspect cms-rel-1-console \
  --format 'status={{.State.Status}} health={{.State.Health.Status}} readonly={{.HostConfig.ReadonlyRootfs}} user={{.Config.User}} security={{json .HostConfig.SecurityOpt}}'

docker exec cms-rel-1-console sh -c \
  'id; if touch /app/should-fail 2>/dev/null; then echo app_write=unexpected-success; else echo app_write=rejected; fi; touch /tmp/write-ok; test -f /tmp/write-ok; echo tmp_write=ok'
```

Expected:

- Container status is `running` and health is `healthy`.
- Root filesystem is read-only.
- Runtime user is `nextjs`, UID/GID `1001`.
- `no-new-privileges:true` is present.
- Writing to `/app` is rejected.
- Writing to `/tmp` succeeds.

**Actual result/evidence:**

> Executed 2026-09-22 against the disposable production regression container.
> Exact inspection and probe output:
>
> ```text
> status=running health=healthy readonly=true user=nextjs security=["no-new-privileges:true"]
> uid=1001(nextjs) gid=1001(nodejs) groups=1001(nodejs)
> app_write=rejected
> tmp_write=ok
> app_probe_artifact=absent
> tmp_probe_artifact=removed
> ```
>
> The `/app` write failed as required by the read-only root filesystem. The
> `/tmp` probe succeeded and its temporary file was removed after validation.
> No container restart, rebuild, source change, or configuration mutation was
> required.

## Browser diagnostics review

- [ ] No unexpected `4xx` or `5xx` response remains unexplained.
- [ ] No uncaught exception or critical console error occurred.
- [ ] No raw access token, API key, cookie, secret, or internal stack appeared
      in the UI, URL, console, or response bodies.
- [ ] Failed requests displayed safe and actionable user-facing messages.
- [ ] Screenshots and exported logs contain no credentials before attachment.

## Exit criteria

The regression result is **Pass** only when:

- [ ] Every P0 case passes.
- [ ] No case is blocked or silently skipped.
- [ ] No security, authorization, or data-isolation defect is found.
- [ ] No critical console error or unexpected `5xx` response remains.
- [x] Health degradation and recovery match the documented contract.
- [ ] REG-15 passes all five human repetitions; automated stress coverage is
      green, but it does not replace this manual release gate.
- [x] Disposable CMS content has been deleted.
- [ ] Disposable containers and network are removed after evidence collection.
- [ ] Every failure has a bug reference, screenshot, URL, timestamp, console
      output, and relevant redacted network response.

## Failure log

| Bug ID | Test ID | Severity | Summary | Evidence | Retest result |
|---|---|---|---|---|---|
| CMS-REL-1-BUG-001 | REG-03 | Medium | Successful Google login briefly displays an error before redirecting | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-001-successful-google-login-briefly-displays-an-error) | Fixed locally; manual pending |
| CMS-REL-1-BUG-002 | REG-05 | Medium | View mode resets and folder navigation visibly refreshes | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-002-content-view-mode-resets-during-directory-navigation) | Fixed locally; manual pending |
| CMS-REL-1-BUG-003 | REG-08 | Low | Publish controls lack consistent hover feedback | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-003-publish-controls-lack-consistent-hover-feedback) | Fixed locally; manual pending |
| CMS-REL-1-BUG-004 | REG-09 | Medium | Grid view does not expose entry actions | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-004-grid-view-does-not-expose-entry-actions-discoverably) | Fixed locally; manual pending |
| CMS-REL-1-BUG-005 | REG-10 | Medium | Logout has no blocking progress state | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-005-logout-lacks-a-blocking-progress-state) | Fixed locally; manual pending |
| CMS-REL-1-BUG-006 | REG-13, REG-15 | Medium | Sorting toolbar flickers after rapid scrolling | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-006-sorting-toolbar-flickers-after-rapid-scrolling) | Fixed locally; automated stress passed |
| CMS-REL-1-BUG-007 | Storage gate | Medium | Permission-denied media upload showed only a generic failure | [Bug report](./CMS-REL-1-bug-report.md#cms-rel-1-bug-007-permission-denied-media-upload-surfaces-only-a-generic-failure) | Pass on canonical port 3000; cleanup complete |

## Final recommendation

**Decision:** No Go

**Tester:** Archan Ray (manual) and Codex (automated REG-11, REG-12, REG-16, and defect remediation)

**Date:** 2026-09-22 through 2026-09-23


**Rationale:**

> BUG-006 is fixed locally and passes focused real-browser stress. BUG-007's
> denial and authorized upload/save/refresh/delete paths pass on port 3000,
> with object-ID-only persistence and complete cleanup; no external R2 CORS
> change was needed. BUG-001 through BUG-005 still need the dedicated human
> retest, REG-14 is not run, and the REG-13 viewport matrix is incomplete.
> Complete the linked post-fix runbook and attach redacted browser/network
> evidence before reconsidering release.

## Cleanup

Remove only the named disposable verification resources:

```bash
docker rm -f cms-rel-1-console cms-rel-1-gateway
docker network rm cms-rel-1-test
```

Optionally remove only the disposable functional-regression image tag after
validation is accepted:

```bash
docker image rm xynesplatform/xynes-cms-console-web:local-regression
```

Do not remove the recorded `local-test` evidence image, feature branch, database
backup, or unrelated local Docker resources as part of this cleanup.
