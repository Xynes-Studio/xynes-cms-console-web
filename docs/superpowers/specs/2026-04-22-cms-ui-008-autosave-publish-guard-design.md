# CMS-UI-008 Autosave, Publish, and Unsaved Guard Design

Date: 2026-04-22
Repo: `xynes-front-end/xynes-cms-console-web`
Story: `CMS-UI-008: Autosave + Publish + Unsaved Guard Wiring`
Related plan: `xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md`
Depends on: `CMS-UI-007`

## Goal

Finish the editor-route save/publish/guard behavior so the CMS editor behaves like a real authoring surface instead of a loosely connected draft form.

This story must guarantee:

- debounced autosave remains the default save path
- save state is visible and resilient (`idle`, `saving`, `saved`, `error`)
- `Publish` force-saves the latest draft before publishing
- unsaved-change protection covers both browser unload and in-app editor exit

The implementation must preserve the current module boundaries:

- route files remain thin
- `CmsEditorScreen` remains the orchestration owner
- `CmsEditorLayout` remains presentational
- `useCmsEntryAutosave` remains the single save-path abstraction

## Current Ground Truth

- `CmsEditorScreen` already:
  - loads an entry by id
  - owns combined draft state (`title`, `description`, `tags`, `body`)
  - integrates `useCmsEntryAutosave`
  - exposes a `Publish` button
  - computes `hasUnsavedChanges`
- `CmsEditorLayout` already:
  - renders visible save-state messaging
  - exposes save/publish controls
  - registers a `beforeunload` prompt when `hasUnsavedChanges` is true
- `useCmsEntryAutosave` already:
  - debounces saves
  - caches snapshots in local storage
  - exposes retry and restore helpers
  - suppresses repeated autosave loops after a successful save
- The main remaining gap is orchestration semantics:
  - `Publish` does not explicitly guarantee that the latest draft is persisted first
  - in-app editor exit still relies on caller behavior rather than an explicit user confirmation contract

## Scope

### In scope

- Extend autosave integration so the latest draft can be flushed deterministically.
- Force-save current draft before publish and only publish if save succeeds.
- Keep publish and save feedback distinct and user-visible.
- Add explicit in-app unsaved-change confirmation for editor exit paths owned by `CmsEditorScreen`.
- Keep `beforeunload` behavior for browser refresh/tab close.
- Add or refine tests to keep touched-module coverage at or above `80%` statements and branches.

### Out of scope

- New backend routes or contract changes.
- New editor UI surfaces outside the current layout chrome.
- Generic cross-app navigation-blocking infrastructure.
- Feature flags, unless implementation reveals a real rollout-risk that cannot be handled safely without one.

## Architecture

### Ownership

- `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/page.tsx`
  - remains a thin route wrapper
- `src/features/cms-content/CmsEditorScreen.tsx`
  - owns orchestration for draft state, save sequencing, publish sequencing, and exit confirmation
- `src/lib/dashboard/use-cms-entry-autosave.ts`
  - owns autosave timing, persistence, snapshot handling, and explicit save flushing
- `src/components/dashboard/CmsEditorLayout.tsx`
  - remains presentational and receives state plus callbacks only

### Design decision

Use the existing autosave hook as the single persistence path and extend it with a small imperative integration surface for deterministic save sequencing.

Rejected alternatives:

- disable `Publish` until autosave settles
  - simpler, but brittle and timing-sensitive
- add a second manual save path inside `CmsEditorScreen`
  - duplicates save logic and increases regression risk

## Data Flow

### Draft baseline

`CmsEditorScreen` will continue to track the last known persisted draft separately from the live draft. Unsaved state remains true when:

- the current draft differs from the last persisted baseline
- autosave is currently saving
- autosave is in an error state

### Autosave flow

1. User edits metadata or body.
2. `useCmsEntryAutosave` debounces a save attempt.
3. Successful save:
  - updates `lastSavedAt`
  - clears pending local snapshot state
  - updates the editor screen baseline through the existing save callback
4. Failed save:
  - keeps a recoverable snapshot
  - exposes `error`
  - leaves editor state in an unsaved condition

### Flush-before-publish flow

When the user clicks `Publish`:

1. If publish is already in progress, do nothing.
2. If a save is already running, await that save result.
3. If the current draft differs from the last persisted baseline, run an immediate save of the latest draft.
4. If that save fails, stop and surface the save failure state. Do not publish.
5. Only after save success, call `publishWorkspaceContentEntry`.
6. On publish success:
  - refresh `entry`
  - refresh the saved draft baseline from the returned entry
  - clear stale autosave snapshot state
  - reflect published status in the layout
7. On publish failure:
  - surface sanitized publish error copy
  - keep the user on the editor screen with their draft intact

## Navigation Guard Contract

### Browser unload

Keep the current `beforeunload` protection in `CmsEditorLayout` when `hasUnsavedChanges` is true.

### In-app editor exit

`CmsEditorScreen` must guard the editor-controlled exit paths it owns.

Initial guarded path for this story:

- `Back` action from the editor header

Behavior:

1. If there are no unsaved changes, navigate immediately.
2. If there are unsaved changes, show a native confirm dialog.
3. Only navigate if the user confirms exit.
4. If the user cancels, keep them in the editor with no data loss.

This story does not attempt to block every possible app-router route transition globally. It covers the editor exit paths currently owned by this feature module, which is the minimal correct scope for this story.

## UX and Accessibility

- Save status remains visible through the existing live region in `CmsEditorLayout`.
- `Publish` behavior must feel deterministic:
  - the user should not be able to publish stale draft content due to debounce timing
- When exit is blocked by unsaved changes:
  - the confirmation prompt must be understandable and interrupt only when necessary
- Existing explicit labels must remain intact:
  - `Back to content list`
  - `Save draft`
  - `Publish content`
  - metadata input labels

## Security and Resilience

- Continue sanitizing load and publish errors before rendering them.
- Do not expose raw gateway/internal error details in save or publish states.
- Keep generated-link sanitization unchanged.
- Treat cached autosave snapshots as recovery data only, not as trusted server state.
- Avoid introducing parallel save code paths that can race or overwrite each other unpredictably.

## Testing Strategy

### Tier 1

Update `use-cms-entry-autosave.test.tsx` to cover the new deterministic save sequencing contract:

- flush saves the latest draft immediately
- flush reuses an in-flight save instead of starting a duplicate save
- flush rejects when the save fails
- flush resolves cleanly when the current value is already persisted

### Tier 2

Update `CmsEditorScreen.test.tsx` to cover:

- publish triggers save-first when the draft changed
- publish waits for an in-flight save
- publish is blocked when forced save fails
- publish still succeeds when the draft is already saved
- back navigation prompts when unsaved changes exist
- back navigation proceeds when the user confirms
- back navigation is cancelled when the user declines

Keep existing assertions for:

- loading state
- sanitized load errors
- sanitized publish errors
- save-state visibility
- generated-link behavior

## Verification

Minimum verification before completion:

- targeted Vitest runs for:
  - `src/lib/dashboard/use-cms-entry-autosave.test.tsx`
  - `src/features/cms-content/CmsEditorScreen.test.tsx`
  - `src/components/dashboard/CmsEditorLayout.test.tsx`
- coverage run confirming touched-module coverage remains at or above `80%`
- `pnpm lint`

## Acceptance Criteria

- Typing in the editor still autosaves with debounce.
- Save state remains visible and accurate.
- Clicking `Publish` after local edits persists the latest draft first.
- Publish does not proceed if the required pre-publish save fails.
- Successful publish updates the editor status to published.
- Browser refresh/tab close still warns when unsaved changes exist.
- Editor `Back` navigation warns when unsaved changes exist.
- Touched-module coverage remains at or above `80%` statements and branches.

## Implementation Notes

- Prefer a small extension to `useCmsEntryAutosave` over new editor-specific save abstractions.
- Keep route-level and presentational modules free of save sequencing logic.
- If implementation exposes a real need for broader app-router transition blocking, capture it as follow-up work instead of broadening this story ad hoc.
