# CMS-UI-007 Lumia Editor Integration Design

Date: 2026-04-20
Repo: `xynes-front-end/xynes-cms-console-web`
Story: `CMS-UI-007: Editor Route Plug-In with CmsEditorLayout`
Related plan: `xynes-front-end/infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md`

## Goal

Replace the current placeholder editor canvas in the CMS editor route with the Lumia rich-text editor, while preserving the existing route structure, autosave flow, publish flow, and directory-first backend contract.

This story will ship rich-text document editing and persistence only. Media upload is explicitly out of scope until backend upload and storage contracts exist.

## Current Ground Truth

- The editor route already exists at `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/page.tsx`.
- `CmsEditorScreen` already loads entries, owns metadata draft state, integrates autosave for metadata fields, and publishes entries through existing backend APIs.
- `CmsEditorLayout` currently renders metadata controls and action chrome, but the editor canvas is still a placeholder.
- Backend support already exists for persisting `body` on `cms.entry.create`, `cms.entry.update`, and `cms.entry.getById`.
- No verified backend media upload contract currently exists in `xynes-gateway`, `xynes-platform-config`, or `xynes-cms-core`.
- Local Supabase storage is enabled globally, but no CMS media bucket contract is provisioned in the checked-in local config.

## Scope

### In scope

- Render Lumia DS editor in the CMS editor canvas.
- Load existing `entry.body` into the Lumia editor.
- Persist editor body JSON through existing `updateWorkspaceContentEntry` autosave flow.
- Include body changes in unsaved-change detection.
- Keep publish behavior working with the editor-enabled draft state.
- Document known media-upload gap as explicit tech debt.

### Out of scope

- Media upload, image upload, file upload, video upload, or storage bucket provisioning.
- New backend routes, action keys, or platform route seeds.
- New public content rendering logic.
- A custom app-local editor implementation.

## Architecture

### Route ownership

- `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/page.tsx`
  - remains a thin route wrapper
  - passes `workspaceSlug` and `entryId` into `CmsEditorScreen`

### Feature ownership

- `src/features/cms-content/CmsEditorScreen.tsx`
  - remains the orchestration container
  - loads the entry
  - owns combined draft state for metadata plus editor body
  - coordinates autosave, publish, and sanitized error handling

- `src/features/cms-content/*editor*.ts`
  - new pure helper module for body normalization, default editor state, and draft comparison support
  - keeps non-React transformation logic out of route and component files

### Presentational ownership

- `src/components/dashboard/CmsEditorLayout.tsx`
  - remains presentational
  - replaces the placeholder canvas area with a passed editor surface
  - does not own API, mutation, or data-mapping concerns

## Data Model and Flow

### Editor draft model

`CmsEditorScreen` will own a single draft snapshot that includes:

- `title`
- `description`
- `tags`
- `body`

`body` will be stored as Lumia editor JSON compatible with the existing backend `body` field.

### Load flow

1. Load entry with `getWorkspaceContentEntryById`.
2. Normalize `entry.body` into Lumia editor JSON.
3. If `entry.body` is empty, missing, malformed, or incompatible, fall back to a safe default empty document.
4. Seed metadata and body into one draft state.
5. Track the loaded draft as the last-saved snapshot.

### Save flow

1. Metadata and editor body update the same draft object.
2. `useCmsEntryAutosave` watches the full draft value.
3. `saveDraftFn` sends `title`, `description`, `tags`, and `body` through `updateWorkspaceContentEntry`.
4. Successful responses refresh the last-saved snapshot and local entry state.

### Publish flow

- Publish continues to use `publishWorkspaceContentEntry`.
- The screen should preserve the current draft snapshot after successful publish.
- Save state and publish state remain independently visible to the user.

## Security and Resilience

- Persist editor content as JSON only. Do not introduce HTML rendering in this story.
- Treat backend `body` payloads as untrusted input.
- Fail closed on malformed editor data by falling back to a safe empty document.
- Keep user-facing error messages sanitized; do not expose raw internal backend details.
- Do not provide a Lumia media upload adapter in this story.
- Do not invent client-side direct uploads to Supabase Storage without backend authorization and bucket policy design.
- Keep existing workspace-scoped authenticated entry API calls unchanged.

## Accessibility and UX

- Preserve current save and publish controls and accessible labels.
- Ensure the editor canvas has a meaningful accessible name and remains keyboard reachable.
- Remove placeholder-only messaging once the real editor is mounted.
- Keep unsaved-change behavior tied to real content edits, not only metadata edits.
- Preserve mobile and desktop layout behavior already defined by `CmsEditorLayout`.

## Testing Strategy

### Tier 1: Pure logic tests

Add unit tests for the new editor helper module:

- empty body returns a safe default Lumia document
- malformed body returns a safe default Lumia document
- valid Lumia body returns normalized document state
- draft comparison includes body changes

### Tier 2: Integration/component tests

Update or add tests for:

- `CmsEditorScreen`
  - renders a real editor for a loaded entry
  - falls back safely when backend body is malformed
  - autosave updates include `body`
  - unsaved state changes when editor content changes
  - publish flow still succeeds with editor-enabled draft state

- `CmsEditorLayout`
  - renders editor canvas content instead of placeholder copy
  - preserves action controls and accessibility labels

### Verification target

- Run targeted editor-related tests first as the TDD cycle evidence.
- Run repo lint and the relevant test or coverage commands before claiming completion.
- Maintain at least 80% touched-module statement and branch coverage.

## Tech Debt

### TD-1: Backend media upload contract missing

Media upload is intentionally deferred because the checked-in backend state does not currently provide:

- platform route seeds for CMS media upload
- gateway route exposure for media upload
- CMS core upload/media action handlers
- a verified CMS storage bucket contract for local development

Follow-up work should define:

- upload route and action ownership
- bucket naming and access policy
- upload authorization model
- editor media adapter contract in the CMS app

### TD-2: Lumia editor peer dependency declaration

`@lumia-ui/editor` currently declares React 18 peer dependencies while `xynes-cms-console-web` runs React 19. If this causes integration friction, it should be resolved in Lumia DS package metadata rather than patched ad hoc in the app.

## Implementation Notes

- Prefer adding a small editor helper module in `src/features/cms-content/` instead of expanding `CmsEditorScreen` with inline parsing logic.
- Keep `CmsEditorLayout` presentational; pass the editor surface in as render content.
- Reuse existing autosave and publish flows rather than introducing a second persistence path.
- Do not add feature flags unless integration reveals an unavoidable compatibility risk.

## Acceptance Criteria

- Visiting the editor route shows a real Lumia rich-text editor instead of placeholder content.
- Existing entry body content is loaded when valid.
- Editing the document updates autosave and persists through the existing backend update API.
- Unsaved-change detection includes document body changes.
- Publish still works on the editor route.
- No media upload UI is wired to a backend upload path in this story.
- The media-upload gap is documented as explicit tech debt.
