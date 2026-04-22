# Findings

- `CMS-UI-008` is partially wired already, but not complete:
  - `CmsEditorScreen` already computes `hasUnsavedChanges`
  - `CmsEditorLayout` already shows save state and registers `beforeunload`
  - `useCmsEntryAutosave` already handles debounce, retry, and snapshot cache
- The remaining gap is sequencing and explicit exit behavior:
  - `Publish` currently calls the publish mutation directly instead of forcing
    the latest draft to persist first
  - in-app exit behavior is still only implicit and needs an explicit confirm
    step in `CmsEditorScreen`
- Existing repo standards already match the intended implementation:
  - keep route files thin
  - keep `CmsEditorLayout` presentational
  - centralize save orchestration in `CmsEditorScreen` and
    `useCmsEntryAutosave`
- The live backend dependency is available in Docker under
  `xynes-infra-gateway-1`, so local API-backed verification remains possible if
  needed after unit/integration coverage.
- Final implementation result:
  - `useCmsEntryAutosave` now exposes deterministic `flush()` behavior
  - `flush()` reuses in-flight saves, performs immediate save when required,
    and does not re-save an already persisted draft
  - `CmsEditorScreen` now waits for `flush()` before publish and aborts publish
    when the pre-publish save fails
  - editor back navigation now confirms before exit when unsaved changes exist
- Verification result for touched modules:
  - `src/features/cms-content/CmsEditorScreen.tsx`: `99.26%` statements /
    `91.48%` branches
  - `src/lib/dashboard/use-cms-entry-autosave.ts`: `90.8%` statements /
    `82.89%` branches
  - `src/components/dashboard/CmsEditorLayout.tsx`: `97.66%` statements /
    `93.47%` branches
- No feature flag was required for this story. The change stayed within the
  existing editor route and hook boundaries.
