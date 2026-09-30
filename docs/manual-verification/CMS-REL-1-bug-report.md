# CMS-REL-1 Bug Report

Defects recorded during the CMS Console production-runtime regression on
2026-09-22, remediated locally through 2026-09-23, and completion-audited on
2026-09-24. This report is the defect companion to
[`CMS-REL-1-manual-regression.md`](./CMS-REL-1-manual-regression.md).

## Environment

| Property | Value |
|---|---|
| Environment | Canonical local development stack |
| CMS URL | `http://localhost:3000` |
| Historical isolated-image URL | `http://localhost:3300` (not required for the current local-only regression scope) |
| Workspace | `xynes` |
| Branch | `feature/cms-release-runtime-hardening` |
| Commit | `1eac9ad079715ddb4882c6f1f79aef0f4b88fc12` |
| Historical isolated image | `xynesplatform/xynes-cms-console-web:local-regression` |
| Historical image ID | `sha256:ea9e2492c6f195478cdf79cea4f3aba545375d51e81017658e1cacec78791982` |
| Browser | Google Chrome `153.0.8010.53` |
| OS | macOS `26.6.2` (`25G83`) |

## Defect summary

| Bug ID | Priority | Severity | Regression case | Status | Summary |
|---|---|---|---|---|---|
| CMS-REL-1-BUG-001 | P1 | Medium | REG-03 | Fixed locally; manual retest pending | Successful Google login briefly displays an error before redirecting |
| CMS-REL-1-BUG-002 | P1 | Medium | REG-05 | Fixed locally; manual retest pending | Content view mode resets and navigation performs a visible refresh |
| CMS-REL-1-BUG-003 | P2 | Low | REG-08 | Fixed locally; manual retest pending | Publish-lifecycle controls lack consistent hover feedback |
| CMS-REL-1-BUG-004 | P1 | Medium | REG-09 | Fixed locally; manual retest pending | Grid view does not expose entry actions through a discoverable menu |
| CMS-REL-1-BUG-005 | P1 | Medium | REG-10 | Fixed locally; manual retest pending | Logout has no blocking progress state while session teardown is pending |
| CMS-REL-1-BUG-006 | P0 | Medium | REG-13, REG-15 | Fixed locally; automated stress passed | Sorting toolbar flickers after rapid scrolling and remains unstable |
| CMS-REL-1-BUG-007 | P1 | Medium | Storage upload gate | Fixed locally; browser smoke passed | Permission-denied media upload surfaces only a generic failure |

## CMS-REL-1-BUG-001: Successful Google login briefly displays an error

**Severity:** Medium

**Priority:** P1

**Type:** Functional / UI

**Status:** Fixed locally; manual Google OAuth retest pending

**Related test:** REG-03

### Description

Google authentication eventually succeeds and reaches the CMS dashboard, but
the Auth application first flashes an error with a retry prompt. A successful
login must not display a false failure state because it encourages duplicate
login attempts and reduces confidence in session creation.

### Steps to reproduce

1. Start without an authenticated session.
2. Open a protected CMS route on `http://localhost:3000`.
3. Continue to Auth and select Google login.
4. Complete the Google authentication flow.
5. Observe the Auth UI before the CMS dashboard appears.

**Reproduction rate:** Reproduced during the recorded manual run; repeat count
was not captured.

### Expected behavior

The successful login remains in a neutral loading/redirect state and returns to
the requested CMS workspace without an error message.

### Actual behavior

An error and retry message briefly appears before the successful dashboard
redirect.

### Impact and workaround

- **Impact:** Confusing false-negative authentication feedback; users may retry
  while the original redirect is still completing.
- **Data impact:** None observed.
- **Workaround:** Wait for the redirect without selecting retry.

### Retest acceptance criteria

- No error or retry UI appears during a successful Google login.
- The encoded CMS return target is preserved.
- Failure UI still appears for a genuinely failed authentication attempt.

### Remediation and automated evidence — 2026-09-23

- Owner: `xynes-auth-app`, branch
  `feature/cms-rel-1-auth-callback-hardening`.
- The client callback now treats one OAuth callback as a single transaction
  under React Strict Mode while preserving the live-page redirect guard.
- Primitive callback inputs replace the unstable search-params object in the
  effect dependency contract.
- The Strict Mode regression proves one `setSession` call and no false error
  UI during a successful implicit callback.
- Auth validation: 90 files and 998 tests pass; aggregate coverage is 91.72%
  statements, 85.15% branches, 93.48% functions, and 93.37% lines. The changed
  callback page is included in coverage at 93.26% statements, 87.50% branches,
  88.88% functions, and 96.03% lines. Lint,
  strict TypeScript, and the Next 15.5.26 production build pass.
- Auth production dependency audit has zero high or critical findings (one low
  advisory remains). A real Google login is still required before closing the
  manual regression case.

## CMS-REL-1-BUG-002: Content view mode resets during directory navigation

**Severity:** Medium

**Priority:** P1

**Type:** Functional / UI

**Status:** Fixed locally; manual navigation retest pending

**Related test:** REG-05

### Description

The selected list/grid view does not persist when moving between content
folders, and the transition visibly refreshes the page. This makes directory
navigation feel unstable and loses the user's chosen working layout.

### Steps to reproduce

1. Open the Content page.
2. Switch from the current view to the other list/grid view.
3. Open a content folder.
4. Move to another folder or return to Contents.
5. Observe the page transition and selected view.

**Reproduction rate:** Observed during the recorded manual run; repeat count was
not captured.

### Expected behavior

The selected view remains coherent while navigating directories and does not
cause an unnecessary full-page refresh.

### Actual behavior

The view choice resets and directory navigation visibly refreshes the page.

### Impact and workaround

- **Impact:** Repeated context loss for authors navigating directory-first
  content structures.
- **Data impact:** None observed.
- **Workaround:** Re-select the preferred view after navigation.

### Retest acceptance criteria

- List/grid choice persists across directory changes and refresh according to
  the documented product preference scope.
- Directory navigation does not flash overlapping loading/content states.
- Search, sort, and directory state remain coherent.

### Remediation and automated evidence — 2026-09-23

- A shared closed-allowlist query-state module now owns parsing, serialization,
  and content-path navigation.
- Shell directory links and content breadcrumbs preserve `q`, `sortBy`,
  `view`, and supported filters, drop legacy `directoryId`, reject unknown
  parameters, and reset pagination offset.
- Integration tests cover both real navigation owners; the URL remains the
  single source of truth and no storage-backed duplicate preference was added.

## CMS-REL-1-BUG-003: Publish controls lack consistent hover feedback

**Severity:** Low

**Priority:** P2

**Type:** UI

**Status:** Fixed locally; manual lifecycle retest pending

**Related test:** REG-08

### Description

Publish lifecycle actions work functionally, but some actionable buttons do
not change the cursor or provide a visible hover state. Users cannot reliably
distinguish interactive controls before clicking.

### Steps to reproduce

1. Open an editable content entry.
2. Hover each Publish/Draft/Archive lifecycle control that is available.
3. Compare cursor and visual feedback across the controls.

### Expected behavior

Every enabled action provides consistent pointer and hover/focus feedback;
disabled actions remain visually distinct.

### Actual behavior

Some enabled buttons provide no cursor change or visible hover feedback.

### Impact and workaround

- **Impact:** Reduced affordance and interaction clarity; functionality remains
  available.
- **Data impact:** None.
- **Workaround:** Click the control based on its label.

### Retest acceptance criteria

- Every enabled lifecycle control exposes consistent hover and keyboard-focus
  feedback.
- Disabled/pending controls remain distinguishable and cannot be activated.

### Remediation and automated evidence — 2026-09-23

- Lumia buttons already satisfied the shared pointer, hover, focus, and
  disabled-cursor contract (39 focused design-system tests pass).
- The uncovered CMS lifecycle menu items now explicitly use pointer affordance
  when enabled and `not-allowed` while disabled.
- CMS editor tests protect the Republish, Unpublish, and Archive menu actions.

## CMS-REL-1-BUG-004: Grid view does not expose entry actions discoverably

**Severity:** Medium

**Priority:** P1

**Type:** Functional / UI

**Status:** Fixed locally; manual grid-action retest pending

**Related test:** REG-09

### Description

Deletion itself succeeds, but entry actions are not visibly available in grid
view. The grid needs a discoverable overflow menu and, where supported, an
equivalent context-menu entry without hiding the keyboard-accessible path.

### Steps to reproduce

1. Open Content and switch to grid view.
2. Locate an entry card.
3. Attempt to find Delete or the entry action menu without changing views.

### Expected behavior

Each grid card exposes a keyboard-accessible action trigger such as a three-dot
menu. Delete remains protected by its confirmation dialog.

### Actual behavior

No visible grid action menu is available; users must leave grid view to find
the action.

### Impact and workaround

- **Impact:** Core entry actions are undiscoverable in one supported view.
- **Data impact:** None; confirmed deletion behaved correctly when invoked.
- **Workaround:** Switch to list view before managing an entry.

### Retest acceptance criteria

- Every grid card exposes a visible, keyboard-reachable overflow trigger.
- Menu actions match the list-view action set and authorization state.
- Cancel/confirm deletion behavior remains unchanged.

### Remediation and automated evidence — 2026-09-23

- Every grid card now has a localized, keyboard-reachable Lumia overflow menu
  for Delete, Share, and Favorite/Unfavorite.
- The open action and menu are sibling controls, so the fix introduces no
  nested interactive HTML.
- Grid actions reuse the list view's existing authorization, handlers, pending
  maps, and delete-confirmation flow instead of duplicating mutations.
- Component, mapper, and panel-integration tests cover action parity, disabled
  pending states, and the no-nested-button invariant.

## CMS-REL-1-BUG-005: Logout lacks a blocking progress state

**Severity:** Medium

**Priority:** P1

**Type:** Functional / UI

**Status:** Fixed locally; manual logout retest pending

**Related test:** REG-10

### Description

Session protection works after logout, but the dashboard remains interactive
while logout is taking time. Users can submit actions during session teardown,
creating ambiguous success/failure behavior.

### Steps to reproduce

1. Sign in and open the CMS dashboard.
2. Select Logout.
3. While logout is pending, attempt to click or submit dashboard actions.

### Expected behavior

A full-screen loading state or interaction-blocking overlay prevents further
dashboard actions until redirect/session teardown completes.

### Actual behavior

No blocking state is shown; dashboard controls remain available while logout
is pending.

### Impact and workaround

- **Impact:** Potential duplicate/failed requests and unclear session state.
- **Data impact:** No corruption observed.
- **Workaround:** Do not interact with the page after selecting Logout.

### Retest acceptance criteria

- Logout immediately exposes an accessible busy state.
- Pointer and keyboard interaction with protected content is blocked.
- The overlay clears on failure and navigation completes on success.
- Back navigation still cannot reveal protected content.

### Remediation and automated evidence — 2026-09-23

- Logout is single-flight and immediately marks the protected interaction
  boundary `inert` and `aria-hidden`.
- A fixed, accessible `role=status`/`aria-live=polite` busy overlay remains
  until navigation completes.
- Logout uses a hard document replacement through the same-origin `/logout`
  handoff, avoiding an unobservable App Router route-load failure.
- A synchronous navigation error or a handoff that does not leave the page
  within 10 seconds clears the blocker and produces localized error feedback;
  duplicate clicks cannot start duplicate logout navigation.
- Unit/integration tests cover the blocker, accessibility state, single-flight
  behavior, and failure recovery.

## CMS-REL-1-BUG-006: Sorting toolbar flickers after rapid scrolling

**Severity:** Medium

**Priority:** P0

**Type:** UI / Performance

**Status:** Fixed locally; automated stress passed

**Related tests:** REG-13, REG-15

### Description

On desktop, rapidly scrolling the content results to the end can make the top
sorting/filter toolbar flicker continuously. The instability persists until a
separate user action occurs. REG-15 is release-sensitive and requires all five
scroll repetitions to pass, so the first observed failure blocks that case.

### Steps to reproduce

1. Open a Content directory with enough entries to scroll.
2. On a desktop viewport, scroll rapidly to the bottom of the results.
3. Stop scrolling and observe the top sorting/filter toolbar.
4. Perform another action and observe whether the flicker stops.

**Reproduction rate:** Observed during the manual run; five-run rate still
needs collection after a fix.

### Expected behavior

The primary toolbar remains pinned, the filter row transitions once per scroll
direction, and the layout becomes stable when scrolling stops.

### Actual behavior

The sorting bar flickers after the rapid scroll and continues flickering until
another action is performed.

### Evidence

- Screenshot:
  `/Users/archanray/Desktop/Screenshot 2026-09-22 at 10.30.59 AM.heic`

### Impact and workaround

- **Impact:** Persistent visual instability on a primary authoring screen;
  release-sensitive scroll regression fails.
- **Data impact:** None observed.
- **Workaround:** Perform another action to stop the flicker; avoid rapid
  scrolling.

### Retest acceptance criteria

- Five consecutive desktop scroll repetitions pass without flicker.
- Tablet and mobile viewport rows are executed.
- Sidebar scrolling remains independent from the results area.
- Content never hides behind the sticky toolbar stack.

### Remediation and automated evidence — 2026-09-23

- Scroll state now records scroll height and viewport height and ignores only
  the bottom clamp caused when a hidden toolbar enlarges the results viewport.
  A genuine later upward scroll still reveals the filter row.
- The hook retains the last positive measured toolbar height when a clipped
  resize reports zero.
- Layout-changing `max-height` animation was removed from the secondary shell;
  border color and inner-row visual feedback remain animated without feeding
  intermediate geometry back into the scroll state machine.
- Focused state/hook tests pass. The real Chrome fixture passed ten independent
  stress runs, each containing five rapid bottom-scroll repetitions (50/50),
  with exactly one hide transition per repetition and no reopen/flicker.
- The authoritative post-fix Playwright run passes 20/20, including desktop
  and mobile accessibility/i18n/layout checks and the five-cycle BUG-006 case.

## CMS-REL-1-BUG-007: Permission-denied media upload surfaces only a generic failure

**Severity:** Medium

**Priority:** P1

**Type:** Functional / Configuration

**Status:** Fixed locally; authorized port-3000 upload verification passed

**Related gate:** CMS storage upload on the canonical local origin

### Description

The original port-3300 run was an out-of-scope origin mismatch. On the
canonical `http://localhost:3000` stack, a real upload attempt produced a
different failure: the gateway rejected upload-session creation with HTTP 403
before the request reached storage-service or R2. The active test user has the
`workspace_member` role, whose intentional RBAC contract includes
`platform.storage.objects.read` but not
`platform.storage.objects.upload`. The editor exposed the feature-flagged
upload control but displayed only the editor's generic `Upload Failed` state,
leaving the user unable to distinguish an authorization denial from a storage
or network failure.

### Steps to reproduce

1. Sign in as a `workspace_member` without
   `platform.storage.objects.upload`.
2. Open an entry editor on `http://localhost:3000` while
   `cms_editor_storage_uploads` is enabled.
3. Insert a local image through the editor.
4. Observe the upload card and page-level feedback.

### Expected behavior

The authorization denial is explained with safe, role-aware copy. Raw backend
codes, filenames, tokens, provider URLs, and credentials are not rendered or
logged. A separately authorized `content_editor` can complete the normal
upload/save/refresh/delete flow.

### Actual behavior

The upload card displays only:

```text
Upload Failed
```

Gateway evidence for the canonical run is HTTP 403 on
`POST /workspaces/:workspaceId/storage/uploads`; no provider PUT occurred.

### Impact and workaround

- **Impact:** A user without upload permission receives ambiguous feedback and
  may repeatedly retry an operation their role cannot perform.
- **Data impact:** No upload session or provider object was created; the
  gateway denied the request before storage-service/provider execution.
- **Workaround before the fix:** Use a test account with the
  `content_editor`, `workspace_owner`, or `super_admin` role for media upload.

### Retest acceptance criteria

- A `workspace_member` denial renders `Media upload unavailable` with
  `Your workspace role does not allow media uploads.`
- The alert does not include the selected filename, raw HTTP/error codes,
  tokens, signed URLs, provider material, or credentials.
- Starting a retry clears the prior page-level alert while the attempt is in
  progress.
- An authorized `content_editor` can upload a disposable PNG from
  `http://localhost:3000` and then delete it.
- Save and hard refresh render the image through a fresh download URL.
- No signed provider URL or credential material persists in CMS content or
  appears in logs.
- No external provider policy mutation is required for the canonical local
  test.

### Investigation evidence — 2026-09-23

- Canonical ignored local environment files contain the expected R2 account,
  bucket, and object credentials; no secret value was printed or copied.
- A read-only `GetBucketCors` request reached Cloudflare but returned HTTP 403
  `AccessDenied`, proving the configured object credential cannot inspect or
  mutate bucket policy.
- No infrastructure or storage-service code was changed because both owning
  worktrees contain unrelated in-progress health-contract changes and the
  missing capability is external provider administration.
- On 2026-09-23 the scope was corrected to the canonical local stack at port
  3000. Auth (`3100`), CMS (`3000`), and gateway (`4100`) were running, and the
  frontend health runner reported Auth, CMS, Supabase, and API healthy.
- The authenticated editor for disposable entry
  `2f3be79c-f45b-4b22-bbae-39da74c0216a` was reached successfully on port 3000.
  A manually selected image caused HTTP 403 on upload-session creation. DB
  inspection confirmed the active user has only `workspace_member`; the
  seeded permission contract grants that role storage reads but not uploads.
- The CMS editor now uses Lumia's upload-error callback only for local UI
  state. It maps permission denials to safe role-aware copy and never logs or
  retains the File object or raw error text. Feature-flag-off behavior still
  exposes no callback or upload-adapter surface.
- A regression test injects a hostile 403 error containing a filename, raw
  backend code, and token-shaped value, then proves none appear in the alert.
- Chrome local-file access was enabled for the existing regression session.
  Repeating the `workspace_member` attempt rendered `Media upload unavailable`
  and `Your workspace role does not allow media uploads.` while preserving the
  editor's local Retry/Remove state. Browser and service-log scans found no
  token, signing parameter, access-key pattern, or raw backend error leak.
- The existing user then received a temporary local-only `content_editor`
  assignment. A fresh PNG upload succeeded through upload-session creation,
  provider PUT, completion, and download-URL creation; the storage row reached
  `ready`.
- The first authorized run exposed a second STORAGE-11 regression in the linked
  Lumia editor: the Insert-menu file-picker path copied `result.url` and upload
  status to the image node but dropped `result.objectId`, allowing the signed
  URL to be persisted. `lumia-ds` branch
  `feature/cms-rel-1-image-object-id-persistence` now mirrors the other upload
  paths and records a non-empty `objectId`. The focused test covers present,
  missing, and empty identifiers.
- After loading the corrected linked package, disposable entry
  `6de0e002-5bd6-4596-9439-e21d86dbea25` persisted image object
  `543d0f3e-b7d5-4744-88f0-325506f7b9de` with an empty `src`, no provider host,
  and no `X-Amz-*` material. A hard refresh minted a fresh HTTPS URL and rendered
  the 16-pixel PNG successfully.
- Gateway evidence records HTTP 200 for upload creation, download-URL creation,
  object deletion, and all four disposable entry deletions. The object is
  `deleted`, all disposable entries are soft-deleted, and the temporary role
  was removed; the test user again has only `workspace_member`.

## Final automated quality evidence — revalidated 2026-09-24

- Both repositories now enforce an 85% global threshold for statements,
  branches, functions, and lines in Vitest.
- CMS: 66 files / 777 tests; 91.45% statements, 85.13% branches, 97.12%
  functions, and 92.07% lines. Lint, strict TypeScript, production build, and
  20/20 Playwright tests pass.
- Auth: 90 files / 998 tests; 91.72% statements, 85.15% branches, 93.48%
  functions, and 93.37% lines. The changed OAuth callback page is explicitly
  measured and is above 85% on every metric. Lint, strict TypeScript, and the
  Next 15.5.26 production build pass.
- Lumia editor dependency: 109 files / 1,190 tests pass with 2 skips. The
  corrected file-picker path has focused present/missing/empty `objectId`
  coverage; package coverage is 89.25% statements, 80.12% branches, 88.56%
  functions, and 90.36% lines. Containerized package lint and the production
  DTS/ESM build pass. The package-wide branch baseline predates CMS-REL-1 and
  is outside the CMS application's enforced 85% aggregate gate; the changed
  file-picker conditional itself is covered for present, missing, and empty
  identifiers.
- The dependency lockfiles were not changed after the recorded audits: CMS
  production and full audits contain zero high/critical findings; Auth's
  production audit contains zero high/critical findings. The Auth full-tree
  development advisories remain isolated to linked Lumia tooling and are not
  in the production graph.
- A fresh CMS audit refresh was attempted after BUG-007, but the execution
  policy rejected sending this private dependency manifest to npm's advisory
  endpoint without explicit authorization. The BUG-007 change does not modify
  `package.json` or `pnpm-lock.yaml`; local added-line scanning found only
  synthetic hostile-error values inside the redaction regression test and no
  production secret or credential material.

## Release disposition

**Recommendation:** No Go for final sign-off; local retest incomplete

CMS-REL-1-BUG-006 is fixed locally and has passed 50 focused real-browser
stress repetitions. CMS-REL-1-BUG-007 is fixed locally and passed both the
permission-denial and authorized upload/save/refresh/delete paths without an
external R2 policy change. Final sign-off remains No Go until BUG-001 through
BUG-005 human retests, REG-14, and the responsive viewport matrix are recorded.
