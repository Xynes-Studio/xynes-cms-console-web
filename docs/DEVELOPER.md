# Developer Guide — xynes-cms-console-web

## Purpose

`xynes-cms-console-web` is a Next.js App Router consumer application that relies on `xynes-auth-app` as the auth authority and `@xynes/auth-sdk` for session/bootstrap primitives.

## Global Engineering Standards

### Next.js (App Router)
- Keep route files under `app/*` with server components by default.
- Use client components only when browser APIs/hooks are required.
- Keep app-level providers centralized in `src/app/providers.tsx` and injected once from `app/layout.tsx`.

### React
- Keep rendering concerns in components and move environment/config/security logic into `src/lib/*` pure utilities.
- Prefer explicit provider composition over ad hoc context setup in route files.

### Folder Structure
- `app/*`: route/layout files only.
- `src/app/*`: app-level client composition (providers).
- `src/lib/*`: pure utility logic (config parsing, validation, URL/security helpers).
- `docs/*`: standards and implementation notes.

Feature ownership for cross-app auth:
- `middleware.ts`: protect-all route enforcement and public allowlist policy.  
  **Next.js 16 deprecation note:** middleware is deprecated in favor of `proxy.ts` for new implementations. `proxy.ts` runs on the `nodejs` runtime, while `middleware.ts` remains `edge`. Prefer `proxy.ts` unless edge runtime behavior is explicitly required. Migration reference: `https://nextjs.org/docs/app/guides/upgrading/version-16`.
- `app/logout/route.ts`: server route that delegates logout to auth-app authority.
- `src/lib/auth/logout.ts`: Tier 1 pure helper for canonical auth-app logout URL handoff.

## Auth Integration Contract (S1-005)

Root provider composition is mandatory:
- `AuthProvider` from `@xynes/auth-sdk`
- `WorkspaceProvider` from `@xynes/auth-sdk`

Runtime config is sourced from infra env mappings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AUTH_APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS`

Config is validated at bootstrap (`validateAuthConfig`) and fails closed on invalid env values.

## Security Standards

- Do not read or expose server-only secrets in client modules.
- Only allow redirect hosts from explicit allowlist values (`NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS`).
- Keep fallback redirect deterministic (`/`) to avoid open redirect behavior.
- In server routes (`app/*/route.ts`), avoid importing SDK barrel exports that include React providers/hooks.
- Keep server-route redirect helpers local and framework-neutral; keep client-side config/guards on SDK contracts.

## Auth Routing Standards (S1-006/S1-007)

- CMS follows protect-all by default through `middleware.ts`.  
  **Next.js 16 deprecation note:** for any new route interception logic, implement `proxy.ts` by default (node runtime) and keep `middleware.ts` only for edge-specific needs. Migration reference: `https://nextjs.org/docs/app/guides/upgrading/version-16`.
- Middleware matcher is UI-focused and excludes `/api/*` and Next static/image internals.
- Public allowlist must stay explicit and minimal:
  - `/` (landing)
  - `/logout` (delegates to auth-app logout even when local cookie is absent)
  - `/_next/*`, `/favicon.ico`, `/api/*`
- Protected route redirects must use auth-sdk URL helpers and preserve safe return URLs.
- Never pass unvalidated external redirect values directly into auth/logout URLs.
- Logout authority is `xynes-auth-app`; CMS must not clear Supabase auth cookies directly.

## Dashboard Route Contract

- Workspace dashboard routes must be namespaced under `/dashboard`.
- Canonical content route is `/dashboard/:workspaceSlug/content`.
- Legacy workspace root `/dashboard/:workspaceSlug` is supported only as a redirect to canonical content.
- Alias resolver routes use `/dashboard/current/*` and must always redirect to canonical slugged routes.
- `/dashboard` is a resolver route:
  - redirects to `/dashboard/:workspaceSlug/content` when a valid last-selected workspace is available
  - renders an accessible 404-style state when workspace resolution fails
- Legacy flat route `/:workspaceSlug` is retired and must not be reintroduced.
- Logout redirects from dashboard pages must preserve the namespaced target (for example, `/logout?redirect=/dashboard/acme-team/content`).

### Dashboard Implementation Standards (Next.js + React)

- Next.js route ownership:
  - `app/dashboard/[workspaceSlug]/layout.tsx`: server layout that owns `CmsDashboardShell`.
  - `app/dashboard/[workspaceSlug]/page.tsx`: server redirect route to canonical content entry.
  - `app/dashboard/page.tsx`: client resolver route only (workspace state + navigation behavior).
- React responsibility split:
  - Keep stateful resolver behavior in client route only.
  - Keep pure URL/validation logic in `src/lib/dashboard/*` utilities (no duplicated inline regex logic across routes).
- Segregation and low-tech-debt rules:
  - Route files should orchestrate; reusable logic belongs in `src/lib/*`.
  - Add Tier 1 tests for pure helpers (`src/lib/**/*.test.ts`) and Tier 2 tests for route behavior (`app/**/*.test.tsx`).
  - Reuse existing logout/middleware security helpers instead of introducing alternate redirect-validation code paths.

### CMS Content Tree Contract

- Canonical content routes:
  - root: `/dashboard/:workspaceSlug/content`
  - nested: `/dashboard/:workspaceSlug/content/:segment*`
- Directory UI is mounted through Lumia `DashboardShell.directorySection` from:
  - `src/components/dashboard/CmsDashboardShell.tsx`
- Tier 1 ownership (pure logic):
  - `src/lib/dashboard/content-directory-tree.ts`
  - `src/lib/dashboard/dashboard-section-route.ts`
- Tier 2 ownership (integration and route behavior):
  - `src/components/dashboard/CmsDashboardShell.test.tsx`
  - `app/dashboard/[workspaceSlug]/content/*.test.tsx`
- UX contract:
  - Directory subtree is visually indented under `Contents`.
  - Parent/child row clicks keep URL as source of truth for selected node.
  - Deep links to nested content paths must hydrate with matching expanded path in sidebar.

### CMS Content Directory API Contract

- API route:
  - `GET /workspaces/:workspaceId/content-directories`
    - gateway action key: `cms.content_directories.listForWorkspace`
  - `POST /workspaces/:workspaceId/content-directories`
    - gateway action key: `cms.content_directories.create`
  - `PATCH /workspaces/:workspaceId/content-directories/:directoryId`
    - gateway action key: `cms.content_directories.update`
  - `DELETE /workspaces/:workspaceId/content-directories/:directoryId`
    - gateway action key: `cms.content_directories.delete`
- Frontend integration ownership:
  - `src/lib/dashboard/content-directories-client.ts`: persisted directory list/create/update/delete API client + strict runtime shape validation
  - `src/components/dashboard/CmsDashboardShell.tsx`: effect orchestration + workspace-scoped synchronization into `DashboardShell.directorySection`
- Security and fail-closed rules:
  - Require bearer token from `useAuth().getAccessToken()` for content directory list/create/update/delete requests.
  - Never trust API payload shape implicitly; validate before rendering.
  - If content-directories fetch/create/update/delete fails or is malformed, keep shell stable and avoid crashing the dashboard.
  - Surface user-visible error feedback via Lumia toast for failed create/rename/delete mutations.
  - Persistent directory tree source of truth is backend API (`GET /content-directories`); do not treat URL-only path segments as persisted nodes.
- No-redundancy routing rule:
  - Treat `routeSegment` from API as the source of truth for directory path generation.
  - Do not derive path segments from labels when `routeSegment` is available.
- Workspace isolation rule:
  - Reset API-backed root directory nodes on workspace changes to prevent cross-workspace sidebar leakage.
  - Preserve manual same-workspace nodes by merging non-conflicting roots only.

### Directory CRUD UX + Role Guard Standards

- Directory management is owner-gated in current phase:
  - `workspace_owner`: create/rename/delete enabled.
  - all other roles: actions visible but disabled.
- Disabled-action UX:
  - Right-click context menu remains available.
  - Disabled actions open a lower-left explanatory pop-up.
  - "Request access" and related escalation actions remain disabled until access-request backend is implemented.
- Rename UX:
  - Rename input is inline at node level.
  - `Escape` cancels rename without mutating state.
- Delete UX:
  - Delete requires confirmation dialog.
  - Dialog must include directory breadcrumb context and cascade-impact warning for nested subdirectories/content.

### Dashboard API Integration Standards (Next.js + React)

- Next.js:
  - Keep page/layout files as orchestration only; no direct fetch/shape-validation logic in route files.
  - Keep dashboard data synchronization logic in client shell/component layer.
- React:
  - Use effect-driven synchronization for API-backed sidebar data.
  - Scope sync effects to stable identifiers (`workspaceId`, auth state) to avoid redundant network calls.
  - Use cleanup (`AbortController`) for in-flight fetches during route/workspace transitions.
- Folder segregation:
  - Pure data/client helpers in `src/lib/dashboard/*`.
  - UI composition/state ownership in `src/components/dashboard/*`.
- Route segments remain thin under `app/dashboard/*`.

### Content Directory Persistence Standards (Next.js + React)

- Next.js route ownership:
  - Keep route files in `app/*` orchestration-only; do not call content-directories API directly from route files.
  - Keep directory API client logic in `src/lib/dashboard/*` and shell state orchestration in `src/components/dashboard/*`.
- React client orchestration:
  - `CmsDashboardShell` is the single owner of directory tree fetch/sync and optimistic create behavior.
  - Persisted directory reads and writes must stay effect/callback-driven with auth token acquisition via `useAuth().getAccessToken()`.
  - URL path remains source of truth for active/expanded route-derived nodes.
- Redundancy and tech-debt controls:
  - Reuse shared gateway client helpers from `src/lib/dashboard/gateway-client-utils.ts`.
  - Avoid duplicating envelope unwrapping, primitive guards, and common API input normalization across client modules.
  - Keep new directory tree transforms in pure helpers (`content-directory-tree.ts`) with Tier 1 tests.
- Security and resilience:
  - Treat all API payloads as untrusted; validate runtime shape before rendering.
  - Fail closed on malformed responses and keep shell stable.
  - Never persist route-derived ephemeral `content-path-*` parent IDs.

### Dashboard Design Standardization (Auth Parity)

Reference:
- `../../infra/docs/plans/2026-02-24-fe-dashboard-design-standardization.md`

Rules:
- Treat auth dashboard visuals/behavior as the parity baseline.
- Use Lumia DS `DashboardShell` as the source of truth for shell structure.
- Do not introduce app-local re-implementations of shell internals.
- If shell internals need adjustment (for example, workspace trigger alignment), fix in `lumia-ds` and consume the updated package in apps.

### CMS Content Grid Card Standards

- Component ownership:
  - `src/components/dashboard/CmsContentCardGrid.tsx`
- Rendering rules:
  - title must stay one-line truncated.
  - description must stay max three visual lines for grid consistency.
  - draft badge only renders for draft status.
- Accessibility:
  - card root remains keyboard focusable with `role="button"` and `tabIndex={0}`.
  - Enter/Space keyboard activation must match click behavior.
  - avatar uses accessible alt and initials fallback.
- DS usage:
  - use Lumia primitives (`Card`, `Avatar`, `Badge`) instead of app-local duplicates.
- Testing:
  - keep Tier 2 interaction coverage in component test file.
  - include metadata fallback and keyboard activation assertions.

### CMS Content List Card Standards

- Component ownership:
  - `src/components/dashboard/CmsContentCardList.tsx`
- Rendering rules:
  - row 1: avatar + title + draft badge (draft only).
  - row 2: owner + created date + collaborator summary.
  - collaborator summary displays up to 3 names, then `+N`.
  - row 3 description remains max three visual lines.
  - row 4 action row includes delete/share/favourite controls.
- Accessibility:
  - open region supports keyboard activation with Enter/Space.
  - action controls expose explicit `aria-label` values with content context.
  - favourite control must expose `aria-pressed`.
- DS usage:
  - keep primitives in Lumia DS (`Card`, `Avatar`, `Badge`, `Button`).
- Testing:
  - include collaborator overflow formatting, metadata fallback, action callback assertions, and keyboard open assertions.

### CMS Content Toolbar Standards

- Component ownership:
  - `src/components/dashboard/CmsContentToolbar.tsx`
- State model:
  - controlled props for `query`, `sortBy`, `view`, `followingOnly`, `favoritesOnly`.
  - URL/query synchronization should be owned by a dedicated hook in `src/lib/dashboard/*`.
- Rendering:
  - row 1: path label + item count (left), create/search controls (right).
  - row 2: following/favorites/filter chips (left), sort/view controls (right).
- Accessibility:
  - search is form-submittable with keyboard enter.
  - toggle chips expose toggle semantics through DS chip behavior.
  - create/search/sort/view controls must keep explicit accessible names.
- DS usage:
  - use Lumia DS controls (`Button`, `Input`, `Select`, `ViewToggle`, `Chip`) and Lumia icon primitives.
- Security:
  - treat user-entered query as untrusted input and delegate sanitization/validation to API boundary.

### CMS Editor Layout Standards

- Component ownership:
  - `src/components/dashboard/CmsEditorLayout.tsx`
- Layout contract:
  - desktop uses two-column split (`20%` metadata, `80%` editor canvas).
  - tablet/mobile uses drawer access for metadata editing.
- Metadata sections:
  - path preview, generated link, title, description, tags, status badge.
- Top actions:
  - back navigation (optional), save draft, publish.
  - save status messaging supports idle/saving/saved/error states.
  - optional retry action can be surfaced when save state is `error`.
- Navigation resilience:
  - optional `hasUnsavedChanges` guard registers a `beforeunload` prompt to prevent accidental tab close refresh loss.
- Accessibility:
  - save status message uses `aria-live="polite"`.
  - all action buttons and metadata inputs must have explicit labels.
  - metadata drawer trigger must remain keyboard accessible.
- Security:
  - generated link and metadata values are treated as untrusted user data.
  - generated link is clickable only for internal paths (relative or same-origin absolute); external/unsafe URLs render as plain text.

### CMS Entry Data Layer Standards

- Ownership:
  - `src/lib/dashboard/content-entries-client.ts`
  - `src/lib/dashboard/use-cms-content-query-state.ts`
  - `src/lib/dashboard/use-cms-content-entries.ts`
  - `src/lib/dashboard/use-cms-entry-autosave.ts`
  - `src/features/cms-content/CmsContentListPanel.tsx`
  - `src/features/cms-content/CmsContentListState.tsx`
- API contract:
  - use gateway workspace routes under `/workspaces/:workspaceId/content/entries*`.
  - include bearer token on every request.
  - treat all responses as untrusted and fail closed on invalid shape.
  - for list API compatibility, avoid sending default query values and allow one compatibility retry path on `400` before surfacing user-facing error state.
- Query state:
  - keep toolbar/list query state URL-backed.
  - normalize invalid query values to safe defaults (`date`, `desc`, `list`, `all`).
  - avoid redundant history writes: do not push router state when computed URL is unchanged.
  - reset pagination offset to `0` when query/sort/filter changes to prevent stale paged views.
- CMS-UI-002 container wiring (Next.js + React):
  - keep route files (`app/dashboard/[workspaceSlug]/content/**/page.tsx`) thin and delegate orchestration to `src/features/cms-content/CmsContentListPanel.tsx`.
  - preserve directory context from pathname segments; never duplicate this parsing logic across route files.
  - wire toolbar controls through `useCmsContentQueryState` as the single source of truth for URL/query params.
  - keep presentational components (`CmsContentToolbar`, cards) stateless and reusable; integration logic stays in feature container/hooks.
- CMS-UI-003 state wiring (Next.js + React):
  - all deterministic list states (`loading`, `error`, `empty`, `ready`) are resolved through `resolveCmsContentListState` to keep route/container branches consistent.
  - keep error copy sanitized and generic (no raw backend payload leakage in UI).
  - retry action should call hook refresh without duplicating fetch orchestration in presentational components.
- Autosave:
  - debounce save calls (default 2s).
  - maintain local snapshot cache for draft recovery.
  - guard browser storage access (`window.localStorage`) for SSR/runtime safety.
  - expose explicit retry path on save failure.
- Testing:
  - Tier 1 tests for client normalization/validation and hook state logic.
  - maintain >=80% statements/branches in touched modules.

### CMS-UI-004 Grid/List Renderer Standards

- Ownership:
  - `src/features/cms-content/CmsContentListPanel.tsx`
  - `src/features/cms-content/mappers.ts`
- Segregation rules:
  - keep presentational rendering in Lumia components (`CmsContentCardGrid`, `CmsContentCardList`).
  - keep entry-to-card prop adaptation in `mappers.ts` (no duplicate mapping logic in route files).
  - keep route files thin (`app/dashboard/[workspaceSlug]/content/**/page.tsx` delegates to feature container).
- Layout contract:
  - `view=grid` renders responsive `1/2/3` columns (mobile/tablet/desktop).
  - `view=list` renders a single-column list.
- Redundancy + tech-debt controls:
  - reuse shared entry action handler references while CMS-UI-005 wiring is pending.
  - avoid per-item inline action object creation in render loops.
- TDD + coverage (ADR-001):
  - add/maintain Tier 2 container tests for view-mode branch rendering.
  - add/maintain Tier 1 mapper tests for data transformation behavior.
  - keep touched module coverage >=80% statements/branches.

### CMS-UI-006 Create Flow Standards (Next.js + React)

- Ownership and segregation:
  - keep create-flow orchestration in feature layer (`src/features/cms-content/*`), not in route files.
  - keep route files thin and declarative; no direct content-entry mutation calls in `app/*` routes.
  - centralize edit-path generation in shared helper (`CmsContentActions`) to avoid duplicated path templates.
- React container behavior:
  - create action must be idempotent under rapid clicks (in-flight guard in container state).
  - create action should resolve workspace slug from trusted workspace context first, then route fallback.
  - preserve directory context by forwarding `directoryId` when present.
- Security and resilience:
  - validate workspace slug/entry id via safe path helpers before route navigation.
  - never surface raw backend error payloads; show generic user-safe feedback.
  - treat API/env/query inputs as untrusted and fail closed when required create dependencies are missing.
- Accessibility:
  - keep explicit accessible control labels via toolbar contract (`Create content`).
  - ensure error feedback is surfaced through shared toast provider with readable copy.
- Redundancy and tech-debt controls:
  - remove repeated toast payloads and repeated route-template strings by helper extraction.
  - keep mutation API invocation in one action helper and unit test it independently.
- TDD and coverage:
  - add/maintain Tier 1 tests for action helper path generation + payload mapping.
  - add/maintain Tier 2 container tests for create success + failure behavior.
  - maintain touched module coverage >=80% statements/branches.

### CMS-UI-005 Card Action Standards (Open / Share / Delete / Favorite)

- Ownership and segregation:
  - keep all card action orchestration in `src/features/cms-content/CmsContentListPanel.tsx`.
  - presentational components (`CmsContentCardGrid`, `CmsContentCardList`) receive typed callbacks only — no orchestration logic.
  - edit-route URL generation lives exclusively in `CmsContentActions.buildContentEntryEditRoute`.
- Action semantics:
  - **Open**: navigate to editor route via `router.push(buildContentEntryEditRoute({workspaceSlug, entryId}))`.
  - **Share**: copy the full editor URL (`window.location.origin + editPath`) to the clipboard via `navigator.clipboard.writeText`. Silently ignore clipboard errors.
  - **Delete** (stub — CMS-UI-005 full wiring not yet complete): currently a no-op; implement as confirm-dialog then soft-delete mutation with optimistic list removal when ready.
  - **Favorite** (stub — CMS-UI-005 full wiring not yet complete): currently a no-op; implement as optimistic toggle with rollback on failure when ready.
- Resilience and fallback:
  - wrap `buildContentEntryEditRoute` calls in try/catch; silently ignore errors (invalid slug/entryId should not crash the view).
  - guard all actions against missing workspace context (`resolvedWorkspaceSlug`); return early and do nothing if absent.
- Tech-debt controls:
  - do NOT inline path-template strings in card handlers; always delegate to `buildContentEntryEditRoute`.
  - do NOT use `state.directoryId` (deprecated URL query-param) in card handler context; use `resolvedDirectoryId` (path-segment-resolved UUID) exclusively.
  - replace no-op stubs with real implementations incrementally as each action's backend contracts are confirmed.
- TDD and coverage:
  - test Open by clicking the card's open button and asserting router.push target.
  - test Share by clicking the card's share button and asserting clipboard.writeText argument.
  - test error resilience by making `buildContentEntryEditRoute` throw and asserting no-crash / no router.push.
  - test noop stubs for delete/favorite by clicking and asserting no throw and no router.push.

### CMS-UI-007 Editor Route Standards (CmsEditorScreen)

- Route ownership:
  - `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/page.tsx`: thin Next.js RSC — awaits async params, passes `workspaceSlug` + `entryId` to `CmsEditorScreen`.
  - `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/layout.tsx`: full-screen overlay layout (`fixed inset-0 z-50`) to escape the dashboard shell chrome.
- Feature container:
  - `src/features/cms-content/CmsEditorScreen.tsx`: client component that loads entry by id, orchestrates autosave, publish, and unsaved-change guard.
- Responsibilities of CmsEditorScreen:
  - fetch entry by `entryId` on mount.
  - pass entry data to `CmsEditorLayout` (metadata fields + editor canvas).
  - integrate `useCmsEntryAutosave` for debounced save.
  - expose publish action that calls the publish mutation and updates status.
  - guard browser unload when `hasUnsavedChanges` is true.
- Next.js standards:
  - route params (`workspaceSlug`, `entryId`) come from async `params` prop — must be `await`-ed in RSC.
  - route/layout files must remain thin; no direct data fetching or mutation logic.
  - the full-screen layout wraps only the editor; it must not affect other dashboard routes.
- React standards:
  - keep all stateful logic (autosave, publish, unsaved guard) inside `CmsEditorScreen`; keep `CmsEditorLayout` presentational.
  - initialize content state from loaded entry; track local draft separately from saved state.
- Security and resilience:
  - treat `entryId` as untrusted; validate via API response before rendering content.
  - do not expose raw error messages in editor UI.
  - unsaved-change prompt must cover both in-app navigation and browser tab close/refresh.
- TDD and coverage:
  - Tier 2 tests for: loading state, entry display, autosave trigger, publish action, unsaved guard.
  - Tier 2 tests for route page and layout files (thin RSC — assert correct prop passthrough).
  - maintain >=80% statements/branches for all editor route files.

### Directory-Scoped Content Listing (URL Path Segment → Directory UUID Resolution)

- Problem solved:
  - The CMS dashboard URL path encodes directories as human-readable segments (e.g. `/content/level-1-2/level-2`). The backend API expects a UUID `directoryId` to filter entries. Without resolution, all entries across every directory were shown regardless of the active path.
- Resolution pattern:
  - `listWorkspaceContentDirectories` fetches all persisted directories for the workspace.
  - `materializePersistedContentDirectories` builds the in-memory directory tree.
  - `getContentDirectoryPathIds` walks the tree, matching each URL segment by `pathSegment` field, returning a list of matched UUIDs.
  - The last UUID in the list is the leaf (deepest matching) directory, used as `directoryId` for the entries fetch.
- Implementation ownership:
  - Resolution logic lives in `CmsContentListPanel.tsx` (container). Pure helpers live in `src/lib/dashboard/content-directory-tree.ts` (Tier 1 tested).
- Loading state contract:
  - `isDirectoryResolving` is `true` while resolution is in progress.
  - `useCmsContentEntries` is `enabled: false` while `isDirectoryResolving = true` to prevent showing unfiltered results during resolution.
  - `effectiveIsLoading = isLoading || isDirectoryResolving` — passes the combined loading signal to the list state resolver so skeleton is shown during directory resolution.
- State semantics:
  - `resolvedDirectoryId === undefined`: resolution pending (directory path exists but UUID not yet resolved)
  - `resolvedDirectoryId === null`: root content view (no path segments) or resolution finished with no match
  - `resolvedDirectoryId === string`: UUID of the leaf directory matching the current URL path
- Tech-debt rules:
  - any reference to the deprecated `state.directoryId` (URL query-param) in content listing/create/logging context must be replaced with `resolvedDirectoryId`.
  - resolution is keyed on `breadcrumbKey` (stable join of path segments) to avoid redundant API calls on unrelated state updates.
  - `breadcrumbParts` and `breadcrumbKey` must be declared before any `useEffect` that references them (TDZ safety).
- Testing:
  - Tier 2: assert that `mockListWorkspaceContentDirectories` is called and the resulting leaf UUID is passed to `useCmsContentEntries`.
  - Tier 2: assert that root path (no segments) skips API call and passes `undefined` directoryId.

## Accessibility Standards

- Keep semantic HTML in route files.
- Ensure auth-gated UI paths preserve keyboard/screen-reader accessibility when adding guards/middleware in future stories.

## Testing Standards (ADR-001)

Reference: `../../lumia-ds/docs/ADR-001-testing-standards.md`

- Follow TDD red-green-refactor for feature work.
- Keep global coverage at `>=80%`.
- Prefer focused tests close to feature ownership:
  - route/layout behavior under `app/*.test.tsx`
  - middleware policy under `middleware.test.ts`
  - provider/config behavior under `src/app/*.test.tsx` and `src/lib/**/*.test.ts`

Verification commands:
- `pnpm test`
- `pnpm test:coverage`
- `pnpm lint`

## Lint Strategy

- Use ESLint flat config (`eslint.config.mjs`) as required by Next.js 16 / ESLint 9.
- Canonical command: `pnpm lint` (executes `eslint .` through infra env wrapper).
- Keep lint setup non-mutating and deterministic for local + CI usage.
