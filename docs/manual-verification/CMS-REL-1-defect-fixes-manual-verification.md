# CMS-REL-1 Defect Fixes — Manual Verification

Editable human retest checklist for
[`CMS-REL-1-bug-report.md`](./CMS-REL-1-bug-report.md). Automated evidence is
necessary but does not replace the canonical local-runtime checks below.

## Execution record

| Field | Value |
|---|---|
| Test date | `YYYY-MM-DD` |
| Tester |  |
| CMS branch | `feature/cms-release-runtime-hardening` |
| CMS commit |  |
| Auth branch | `feature/cms-rel-1-auth-callback-hardening` |
| Auth commit |  |
| CMS runtime / container | `xynes-cms-console-web` local development stack |
| CMS URL | `http://localhost:3000` |
| Auth URL | `http://localhost:3100` |
| Browser / version |  |
| OS |  |
| Workspace slug |  |
| Final result | `Pass / Fail / Blocked` |

## Preconditions

- [ ] Start/restart the canonical local CMS and Auth services from the exact
      branches/commits under test.
- [ ] Confirm `http://localhost:3000/api/health` returns HTTP 200 with
      `checks.gateway: "ok"`.
- [ ] Confirm `http://localhost:3100/api/health` returns HTTP 200.
- [ ] Confirm gateway and required backend services are healthy.
- [ ] Use the same `localhost` hostname for CMS and Auth so browser cookies are
      not split between `localhost` and `127.0.0.1`.
- [ ] Confirm the Auth local redirect allowlist includes `localhost:3000`.
- [ ] Use only a non-production account and disposable workspace/content.
- [ ] Open browser Console and Network panels with log preservation enabled.
- [ ] Do not paste tokens, signed URLs, cookies, or provider credentials into
      this document.

## Automated baseline to confirm before manual testing

From `xynes-cms-console-web`:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test:coverage
pnpm build
pnpm test:e2e
pnpm audit --prod --audit-level=high
pnpm audit --audit-level=high
```

Expected CMS baseline:

- 66 test files and at least 777 tests pass.
- Aggregate statements, branches, functions, and lines are each at least 85%.
- 20/20 Playwright tests pass.
- Production audit has no high/critical advisory.

From `xynes-auth-app`:

```bash
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm audit --prod --audit-level=high
```

Expected Auth baseline:

- 90 test files and at least 998 tests pass.
- Aggregate statements, branches, functions, and lines are each at least 85%.
- Production audit has no high/critical advisory.

## BUG-001 — Google callback must not flash a false error

Reference: [BUG-001](./CMS-REL-1-bug-report.md#cms-rel-1-bug-001-successful-google-login-briefly-displays-an-error)

1. Clear the local Auth/CMS session or use a clean browser profile.
2. Open a protected URL such as
   `http://localhost:3000/dashboard/<workspace-slug>/content`.
3. Confirm Auth receives an encoded return target pointing to port 3000.
4. Select Google login and complete a valid login once.
5. Watch the callback page continuously until CMS loads.
6. Repeat once with Network throttling set to Slow 3G.
7. Separately exercise a deliberately invalid/expired callback to confirm real
   failures still show safe retry UI.

Expected:

- [ ] A valid callback shows only neutral loading/redirect feedback.
- [ ] No error or retry UI flashes before the successful redirect.
- [ ] The callback exchanges/sets the session only once.
- [ ] The original CMS return target is preserved.
- [ ] A genuinely invalid callback still shows safe failure UI.
- [ ] No token, code, session, or cookie value appears in Console output.

Evidence / notes:

```text

```

Result: `Pass / Fail / Blocked`

## BUG-002 — Content view/query state survives directory navigation

Reference: [BUG-002](./CMS-REL-1-bug-report.md#cms-rel-1-bug-002-content-view-mode-resets-during-directory-navigation)

1. Open the workspace Content root.
2. Select Grid view.
3. Enter a search term, change sort order, and enable Favorites if test data
   supports it.
4. Open a directory from the sidebar.
5. Open a child directory, then select the root content breadcrumb.
6. Use browser Back and Forward.
7. Hard-refresh the current URL.
8. Add an unknown query parameter manually and navigate to another directory.

Expected:

- [ ] Grid view remains selected across all content-directory navigation.
- [ ] Supported search/sort/filter query state remains coherent.
- [ ] Pagination offset resets when the directory path changes.
- [ ] Legacy `directoryId` and unknown parameters are not propagated.
- [ ] No full-document reload, overlapping content, or visible route flash occurs.
- [ ] Back/Forward and hard refresh reproduce the URL-encoded state.

Evidence / notes:

```text

```

Result: `Pass / Fail / Blocked`

## BUG-003 — Publish lifecycle actions have clear affordance

Reference: [BUG-003](./CMS-REL-1-bug-report.md#cms-rel-1-bug-003-publish-controls-lack-consistent-hover-feedback)

1. Open a disposable editable entry.
2. Hover every enabled Publish, Republish, Unpublish, and Archive control that
   is available for the current lifecycle state.
3. Reach the same controls with the keyboard.
4. Start a lifecycle mutation and inspect the control while pending.
5. Complete the Draft → Published → Unpublished/Archived paths supported by
   the fixture, refreshing after each completed change.

Expected:

- [ ] Enabled buttons/menu items show pointer and visible hover feedback.
- [ ] Keyboard focus is visible and activation works with Enter/Space as
      appropriate.
- [ ] Disabled/pending controls show `not-allowed` affordance and cannot fire.
- [ ] One user action produces one lifecycle request.
- [ ] Status remains correct after hard refresh.

Evidence / notes:

```text

```

Result: `Pass / Fail / Blocked`

## BUG-004 — Grid cards expose action parity

Reference: [BUG-004](./CMS-REL-1-bug-report.md#cms-rel-1-bug-004-grid-view-does-not-expose-entry-actions-discoverably)

1. Open Content and choose Grid view.
2. Locate the visible three-dot action trigger on a disposable entry.
3. Open it with the mouse, close it with Escape, then reopen it using only the
   keyboard.
4. Exercise Favorite/Unfavorite and confirm the card state changes once.
5. Exercise Share, confirm the localized success toast appears, and paste the
   clipboard into a scratch field to verify it contains the entry edit URL.
6. Select Delete, cancel the confirmation, and confirm the entry remains.
7. Reopen Delete, confirm it, and verify the disposable entry disappears.
8. Compare the available actions with the same entry/action state in List view.

Expected:

- [ ] Every grid card has a named, keyboard-reachable action trigger.
- [ ] Delete, Share, and Favorite/Unfavorite match List view authorization and
      pending state.
- [ ] Selecting an action does not also open the entry.
- [ ] Selecting the card's open control does not open the action menu.
- [ ] Delete remains confirmation-protected.
- [ ] Browser accessibility inspection shows no nested button/interactable.

Evidence / notes:

```text

```

Result: `Pass / Fail / Blocked`

## BUG-005 — Logout blocks protected interaction

Reference: [BUG-005](./CMS-REL-1-bug-report.md#cms-rel-1-bug-005-logout-lacks-a-blocking-progress-state)

1. Sign in and open a CMS content screen.
2. Enable Slow 3G or request blocking for the logout navigation so the pending
   state remains visible long enough to inspect.
3. Select Logout twice rapidly.
4. While pending, try mouse clicks, Tab navigation, Enter, and form submission
   against the dashboard beneath the overlay.
5. Allow logout to complete, then use browser Back.
6. In a separate run, block the `/logout` document request so the page does
   not unload; after 10 seconds confirm the blocker clears and localized
   recovery feedback appears.

Expected:

- [ ] A full-screen accessible busy state appears immediately.
- [ ] The protected interaction boundary is inert and hidden from assistive
      technology while pending.
- [ ] Background pointer and keyboard interaction is impossible.
- [ ] Rapid duplicate activation starts only one logout navigation.
- [ ] Successful logout reaches Auth and Back cannot expose protected content.
- [ ] A synchronous navigation error or a handoff that remains on the page for
      10 seconds removes the blocker and shows localized feedback.

Evidence / notes:

```text

```

Result: `Pass / Fail / Blocked`

## BUG-006 — Toolbar remains stable during rapid scrolling

Reference: [BUG-006](./CMS-REL-1-bug-report.md#cms-rel-1-bug-006-sorting-toolbar-flickers-after-rapid-scrolling)

Run on desktop `1280×900`, tablet `768×1024`, and mobile `390×844`:

1. Open a directory with enough entries to overflow the results region.
2. Confirm the primary toolbar remains pinned.
3. Scroll down: the secondary filter row should hide once.
4. Scroll up slightly: it should reveal once.
5. Rapidly scroll to the bottom, stop for at least one second, and observe.
6. Return to the top and repeat the bottom-scroll sequence five times per
   viewport.
7. Independently scroll the sidebar and confirm results do not move.

Expected:

- [ ] No toolbar flicker, oscillation, or repeated hide/reveal occurs.
- [ ] After every bottom scroll, the result region is at its current maximum.
- [ ] The primary row remains pinned within two pixels.
- [ ] The secondary row becomes non-interactive while hidden.
- [ ] Sidebar and results scrolling remain isolated.
- [ ] Content and zero-state copy never hide beneath the toolbar stack.

| Viewport | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Notes |
|---|---|---|---|---|---|---|
| Desktop |  |  |  |  |  |  |
| Tablet |  |  |  |  |  |  |
| Mobile |  |  |  |  |  |  |

Result: `Pass / Fail / Blocked`

## BUG-007 — Permission feedback and authorized port-3000 upload smoke

Reference: [BUG-007](./CMS-REL-1-bug-report.md#cms-rel-1-bug-007-permission-denied-media-upload-surfaces-only-a-generic-failure)

This execution used the currently configured local CMS origin on port 3000.
Port 3300 is also usable when the local host port, canonical CMS URL, and Auth
return allowlist are deliberately configured together before startup; there is
no application restriction against it. Do not change the external provider
policy for this test. Use two non-production role fixtures:

- a `workspace_member` without `platform.storage.objects.upload`;
- a `content_editor`, `workspace_owner`, or `super_admin` with upload access.

### Permission-denial verification

1. Sign in as the `workspace_member` and open a disposable entry.
2. Select a small disposable PNG from the editor upload dialog.
3. Confirm upload-session creation returns HTTP 403 and no provider PUT starts.
4. Confirm the page-level alert says `Media upload unavailable` and
   `Your workspace role does not allow media uploads.`
5. Inspect the alert, Console, Network, and logs for disclosure.

Expected:

- [x] The editor keeps its local failed-upload Retry/Remove affordances.
- [x] The page explains that the workspace role does not allow uploads.
- [x] The selected filename, raw backend code, bearer token, signed URL,
      provider endpoint, and credentials do not appear in page-level feedback
      or logs.
- [x] No upload session or provider object is created.

### Authorized upload verification

Upload verification:

1. Sign in as the authorized test user and create/open a disposable entry
   through `http://localhost:3000`.
2. Upload a small disposable PNG.
3. Confirm the signed provider PUT succeeds and the object becomes Ready.
4. Save the entry and hard-refresh.
5. Confirm the image renders using a fresh application download URL.
6. Inspect Console, Network, persisted entry content, and service logs for
   credential/signed-URL leakage.
7. Delete the image/object and disposable entry; confirm cleanup.

Expected:

- [x] Upload-session creation, browser preflight, and provider PUT succeed from
      port 3000.
- [x] The object reaches Ready and survives save/refresh.
- [x] No raw provider secret or reusable signed provider URL is persisted or
      logged.
- [x] Failed/abandoned sessions are cleaned up safely.
- [x] Disposable content and object are removed after the test.

Evidence / policy change reference:

```text
2026-09-23 — Chrome, http://localhost:3000
- workspace_member denial: HTTP 403 before storage-service/provider; safe
  role-aware alert rendered and retained Retry/Remove.
- temporary content_editor upload: HTTP 200 lifecycle; object
  543d0f3e-b7d5-4744-88f0-325506f7b9de reached Ready.
- persistence: image-block stored objectId with src length 0; no provider host
  or X-Amz signing material persisted.
- hard refresh: fresh HTTPS download URL rendered favicon.png (16 px).
- cleanup: object status deleted; four exact disposable entries deleted;
  temporary content_editor role removed.
- Lumia fix branch: feature/cms-rel-1-image-object-id-persistence.
```

Result: `Pass`

## Final security and regression review

- [x] No unexpected 4xx/5xx response occurred in the tested happy paths.
- [x] Console contains no uncaught error or secret-bearing message.
- [x] Network requests use the expected CMS/Auth/Gateway and configured
      provider origins only.
- [x] No new raw token, cookie, provider key, or signed URL is stored in page
      source, local storage, entry JSON, or logs.
- [ ] Keyboard-only smoke passes for navigation, grid menu, lifecycle actions,
      dialogs, and logout.
- [ ] Pseudo-locale (`en-XA`) toolbar/menu copy has no clipping or overlap.
- [x] All disposable entries, uploads, and test sessions are removed.

## Release decision

- [ ] BUG-001 through BUG-006 are manually confirmed Pass.
- [x] BUG-007 upload/save/refresh/delete is confirmed Pass on canonical port
      3000 without a provider-policy change.
- [ ] REG-14 keyboard navigation and the responsive matrix are complete.
- [ ] No P0/P1 defect remains open or blocked.

Decision: `Go / No Go`

Sign-off / notes:

```text

```
