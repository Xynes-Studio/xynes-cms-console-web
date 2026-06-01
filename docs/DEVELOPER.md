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
- `app/e2e/*` fixture routes are test-only and must remain deny-by-default in app runtime.
- Only the Playwright harness may enable fixture access via `NEXT_PUBLIC_ENABLE_E2E_FIXTURES=1`.

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
- Workspace creation is owned by `xynes-auth-app`. When the user triggers "Create Workspace" from `DashboardShell`, CMS redirects to `${NEXT_PUBLIC_AUTH_APP_URL}/onboarding?redirect=<encoded CMS dashboard URL>` using `window.location.assign()` so the auth-app's post-create flow returns the user to CMS Console (WSA-FIX-2, 2026-05-12). The redirect target is `${NEXT_PUBLIC_APP_URL}/dashboard`, which the CMS dashboard resolver page redirects to the user's current/first workspace once it exists.
  - If `NEXT_PUBLIC_APP_URL` is unset or not a valid `http(s)` URL, the `?redirect=` query is **omitted entirely** — the request fails closed to the auth-app's Auth-Admin fallback rather than sending a malformed redirect target.
  - If `NEXT_PUBLIC_AUTH_APP_URL` is unset, CMS falls back to a local `router.push("/onboarding")` (with the `?redirect=` query still appended when `NEXT_PUBLIC_APP_URL` is set).
  - The auth-app revalidates the `redirect` value against `getAllowedRedirectDomains()` before honouring it. A tampered or unknown host falls back to Auth Admin (`/dashboard/apps`). CMS Console therefore does **not** need to URL-encode or hash the value beyond standard `encodeURIComponent`.
- Only the Playwright harness may enable fixture access via `NEXT_PUBLIC_ENABLE_E2E_FIXTURES=1`.

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

### Dashboard shell contract (BUG-CMS-9, landed 2026-05-31)

Background: BUG-LDS-1 (landed 2026-05-29) made Lumia DS `DashboardShell` the single viewport-height + scroll authority — its root is `h-dvh w-full overflow-hidden`, the sidebar uses fixed-height grid rows with anchored top/bottom slots, and the right pane is `h-full overflow-y-auto`. After BUG-LDS-1, consumer routes that mount inside the shell must NOT reintroduce shell-bypassing layout primitives, otherwise the document grows past the viewport and the workspace switcher / profile menu slide off the rail again.

Contract:

- Routes that mount inside `<CmsDashboardShell>` must inherit the shell's scroll containment. **Do not** add `fixed inset-0`, `min-h-screen`, `h-screen`, or document-level `overflow-hidden` inside these routes.
- Panel-internal `overflow-y-auto` is fine as long as the panel root is bounded (`h-full min-h-0`). This is the pattern in `CmsContentListPanel.tsx` — a `flex h-full min-h-0 flex-col overflow-hidden` shell with a sticky toolbar (`shrink-0`) above a scrolling results region (`min-h-0 flex-1 overflow-y-auto`). The inner scroll is required for the infinite-scroll handler; it does NOT contribute to document scroll because the panel root is clamped to the shell pane.
- The Playwright fixture `CmsContentScrollLayoutFixture.tsx` deliberately mirrors the panel layout — it tests the same contract.

Documented escape hatches (the only allowed shell bypasses within scan scope):

1. **Editor full-screen overlay** — `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/layout.tsx` uses `fixed inset-0 z-50 overflow-hidden bg-background` so the writer gets the entire viewport. Intentional focused-writing UX. The layout carries a `data-bug-cms-9="editor-fullscreen-overlay"` marker.
2. **Pre-auth / loading fallback `<main>`** blocks inside `CmsDashboardShell.tsx` — `<main className="flex min-h-screen items-center justify-center px-6">` is rendered ONLY when no shell is mounted (auth loading, redirect-to-login). These are not shell consumers, so `min-h-screen` is correct.
3. **Toolbar collapsible-row `overflow-hidden`** in `CmsContentToolbar.tsx:138` — this is the animation transition for the secondary row, not a viewport-scroll escape (the regression guard only treats `fixed inset-0`, `min-h-screen`, and `h-screen` as bypasses).

Out of scan scope (intentionally NOT shell consumers):

- Top-level dashboard redirector pages: `app/dashboard/page.tsx`, `app/dashboard/current/[[...segments]]/page.tsx`. These render a centered status `<main>` BEFORE the workspace slug is resolved; no `<DashboardShell>` is mounted, so `min-h-screen` is the correct vertical centering. They live above `app/dashboard/[workspaceSlug]/layout.tsx` (which is where `<CmsDashboardShell>` mounts) and the regression guard's `SCAN_DIRS` deliberately excludes them.

Regression guard:

- `app/dashboard-shell-contract.test.ts` scans `app/dashboard/[workspaceSlug]/**`, `src/components/dashboard/**`, and `src/features/**` for any of the bypass patterns above and fails the build if a new offender appears outside the allowlist. The test exists so a future contributor adding a benign-looking `min-h-screen` to a shell-mounted panel is caught at PR time rather than during the next scroll regression.
- The test treats `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/layout.tsx` and `src/components/dashboard/CmsDashboardShell.tsx` as the only allowlist entries. Adding a new allowlist entry MUST come with a new bullet under "Documented escape hatches" above.

If a new shell escape hatch is genuinely needed:

1. Add the file to the allowlist in `app/dashboard-shell-contract.test.ts`.
2. Add a corresponding bullet to the "Documented escape hatches" list above.
3. Add a `data-bug-cms-9="<short-purpose>"` marker on the bypassing wrapper so the intent is visible at the markup level.
4. Justify the bypass in the PR description against the BUG-LDS-1 contract.

### UXR-6 Dashboard Alignment (landed 2026-05-10)

Background: UXR-6 in `xynes/xynes-infra/docs/research/ux-review/01-user-stories.md` aligns the CMS Console dashboard with the shared Lumia design language without breaking directory-first authoring or Workspace Admin contextual ownership.

What landed:

- `CmsDashboardShell` builds a typed `DashboardShellLabels` bundle from the `cms.shell` catalog and forwards it via the Lumia `labels` prop (`navigation`, `workspace`, `profile`, `notifications`). Lumia stays product-copy-neutral; this seam is where CMS Console owns translated product copy.
- `workspaceCreationDisabledMessage`, `sidebarFooterNote`, the user-menu fallbacks (`User` / `No email`), and the loading + redirect status copy all flow through `next-intl` instead of being hard-coded English. ICU placeholders (`{unreadCount}`, `{title}`) are preserved verbatim and interpolate at render time.
- Shared destinations (`Access Control`, `Integrations`, `Settings`) keep the labels documented in `xynes/xynes-infra/docs/research/ux-review/02-cross-app-navigation-vocabulary.md` (UXR-4).
- UXR-3 follow-through: `CmsContentToolbar` no longer imports `Star` from `lucide-react` — the favorites chip now uses Lumia's canonical `<Icon name="star" />`. `CmsEditorLayout` no longer registers app-local `republish` / `archive-entry` SVG icons; those IDs are seeded in `@lumia-ui/icons`'s default registry.
- Workspace Admin contextual ownership is preserved unchanged: the integrations page still summarises status + counts and deep-links into Workspace Admin without hosting domain or API-key lifecycle forms.

What is intentionally NOT in scope for UXR-6:

- No app-local `WorkspaceSwitcher` exists in CMS Console — the Lumia shell already owns workspace switching via `DashboardWorkspaceSwitcher` from UXR-2. Route-aware workspace switching (`buildDashboardSectionPath` preserves the active section + tail segments) is unchanged.
- No CMS API behaviour, no directory-first contract changes, no integrations panel form additions.

Catalog surfaces added to `messages/en-US/cms.shell.json` and `messages/en-XA/cms.shell.json`:

- `shell.navigation.*` — landmark + nav aria labels
- `shell.workspace.*` — switcher trigger, sections, create action
- `shell.workspaceCreationDisabledMessage`
- `shell.profile.*` — profile menu trigger + actions
- `shell.notifications.*` — drawer trigger, list, ICU patterns (`titlePattern`, `unreadCountPattern`, `deletePattern`)
- `shell.userMenu.fallbackName` / `shell.userMenu.fallbackEmail`
- `shell.footerNote`
- `status.loadingDashboard` / `status.redirectingToLogin`

Translator metadata is documented in `messages.meta/cms.shell.json`. Vocabulary alignment with `auth.dashboard.shell.*` (Auth Admin) is mandatory for shared destinations — keep wording identical unless a product owner documents an exception.

Tests:

- `src/components/dashboard/CmsDashboardShell.test.tsx` — full mock-translator coverage of every new key; new label-bundle propagation test asserts the Lumia `DashboardShellLabels` bundle is forwarded with all branches populated; new fallback test verifies the user-menu fallbacks come from the catalog when `displayName` and `email` are both null.
- `src/components/dashboard/CmsDashboardShell.i18n.test.tsx` — new file driving the **real** `next-intl` provider with the en-US and en-XA `cms.shell` catalogs; verifies (a) every nav label and shell label flows through the catalog, (b) ICU patterns interpolate correctly, (c) the en-XA pseudo-locale renders bracketed/doubled characters without breaking the shell shape, and (d) raw catalog key paths never leak into a forwarded label.
- `src/components/dashboard/CmsContentToolbar.test.tsx` — Chip mock now renders the `icon` ReactNode and `iconName` so the new UXR-3 follow-through assertion can confirm the favorites chip renders Lumia's canonical "star" icon (not a hard-coded lucide-react `Star`).

Quality gates from the 2026-05-10 implementation pass:

- `pnpm test` — 445/445 pass across 54 test files
- `pnpm test:coverage` — `CmsContentToolbar.tsx` 100% / 100% / 100% / 100%; `CmsDashboardShell.tsx` 85.21% lines / 78.01% branches / 100% functions; `CmsEditorLayout.tsx` 91.86% lines (improved by removing dead inline icon code). All above the ADR-001 80% lines floor.
- `pnpm lint` — clean
- `pnpm build` — clean (16 routes built, no type errors)

## Translation Prototype Standards

The CMS Console translation prototype is intentionally modular and low-cost:

- Runtime library: `next-intl`.
- Shared cross-repo primitives: `@xynes/i18n` for locale allowlisting, normalization, negotiation, pseudo-locale metadata, and future catalog tooling.
- Catalogs live in this app under `messages/<locale>/*.json`; translator/agent context lives beside them in `messages.meta/*.json`.
- Routes stay stable. Do not introduce locale-prefixed dashboard paths unless a later architecture plan explicitly changes the routing contract.

### Locale Resolution

- Cookie: `xynes_locale`.
- Resolution order: allowlisted cookie -> allowlisted `Accept-Language` -> `en-US`.
- Current prototype locales: `en-US` and `en-XA`.
- `app/layout.tsx` is the single place that reads `cookies()` / `headers()` and loads messages.
- `src/app/providers.tsx` is the single client provider composition point and wraps existing Auth/Workspace/Toast providers with `NextIntlClientProvider`.

### Catalog Ownership

- `cms.shell`: dashboard navigation, directory labels, directory mutation copy.
- `cms.content`: toolbar, content card labels/aria labels, list loading/error/empty states.
- `cms.integrations`: contextual Workspace Admin integration copy.

When adding a new user-facing CMS surface:

- add copy to the closest existing namespace, or create a new feature namespace if the surface has independent ownership;
- add matching keys to all supported locales;
- add/update `messages.meta/<namespace>.json` with translator context and variable notes;
- add tests that prove the UI uses translated copy, not hard-coded English.

### Security and Accessibility

- Treat locale input as untrusted; only use the shared `@xynes/i18n` negotiation helpers.
- Never render catalog strings through `dangerouslySetInnerHTML`.
- Do not put URLs, HTML, JWTs, raw API keys, hashes, audit fields, request ids, or stack traces in catalog values.
- Preserve ICU variables exactly, for example `{count}`, `{title}`, and `{owner}`.
- Translate accessible labels and hints with the visible control labels so keyboard and screen-reader users receive equivalent context.
- Continue using Lumia DS primitives for translated controls; do not create app-local theme or layout overrides to accommodate longer strings. Use pseudo-locale browser tests to catch overflow.

### Testing

- Tier 1 locale/config tests: `src/i18n/config.test.ts`.
- Tier 2 provider/layout tests: `app/layout.test.tsx`, `src/app/providers.test.tsx`.
- Tier 2 component tests: shell, toolbar, cards, list state, and integrations panel tests include translated-copy coverage.
- Browser smoke: `e2e/cms-dashboard-scroll-layout.spec.ts` includes `@i18n` pseudo-locale checks across desktop and mobile viewports.

Verification commands:

- `pnpm test`
- `pnpm test:coverage`
- `pnpm lint`
- `pnpm build`
- `pnpm test:e2e -- --grep @i18n`

### CMS Content Grid Card Standards

- Component ownership:
  - `src/components/dashboard/CmsContentCardGrid.tsx`
- Rendering rules:
  - title must stay one-line truncated.
  - description must stay max three visual lines for grid consistency.
  - draft badge only renders for draft status.
  - fallback owner/date, draft badge, avatar alt, and open label come from `cms.content.card`.
  - created date formatting uses the active `next-intl` locale.
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
  - fallback owner/date, draft badge, avatar alt, open label, and action labels come from `cms.content.card`.
  - created date formatting uses the active `next-intl` locale.
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
- Feature wiring ownership:
  - `src/features/cms-content/useCmsContentToolbarScrollStack.ts`
  - `src/features/cms-content/content-toolbar-scroll-stack.ts`
- State model:
  - controlled props for `query`, `sortBy`, `view`, `followingOnly`, `favoritesOnly`.
  - URL/query synchronization should be owned by a dedicated hook in `src/lib/dashboard/*`.
  - sticky/hide-on-scroll state is feature-owned; keep it out of `CmsContentToolbar`.
- Rendering:
  - row 1: path label + item count (left), create/search controls (right).
  - row 2: following/favorites/filter chips (left), sort/view controls (right).
  - row 2 visibility must be driven only by the results scroller, not `window`.
  - when the results area does not overflow, row 2 must remain visible.
  - all visible labels, placeholders, aria labels, item-count plural copy, and sort labels come from `cms.content.toolbar`.
- Interaction rules:
  - hide requires accumulated downward scroll intent; do not depend on a single large wheel-style delta.
  - reveal uses a smaller upward threshold so MacBook trackpad scrolling reopens reliably.
  - keep scroll-state transitions in the pure helper and keep the hook as a thin React adapter.
- Accessibility:
  - search is form-submittable with keyboard enter.
  - toggle chips expose toggle semantics through DS chip behavior.
  - create/search/sort/view controls must keep explicit accessible names.
  - the results scroller must remain keyboard-focusable and explicitly named.
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
  - path preview, title, description, tags, status badge.
- Top actions:
  - back navigation (optional), save draft, publish.
  - save status messaging supports idle/saving/saved/error states.
  - optional retry action can be surfaced when save state is `error`.
- Navigation resilience:
  - `hasUnsavedChanges` must register a `beforeunload` prompt to prevent accidental tab close or refresh loss.
  - in-app exit confirmation remains feature-owned in `CmsEditorScreen`; `CmsEditorLayout` stays presentational and must not own route transitions.
- Accessibility:
  - save status message uses `aria-live="polite"`.
  - all action buttons and metadata inputs must have explicit labels.
  - metadata drawer trigger must remain keyboard accessible.
- Security:
  - metadata values are treated as untrusted user data.

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
  - treat the first loaded draft as the saved baseline; do not autosave untouched server state on mount.
  - guard browser storage access (`window.localStorage`) for SSR/runtime safety.
  - expose explicit retry path on save failure.
  - expose deterministic `flush()` behavior for feature-owned actions that must persist the latest draft before continuing.
  - `flush()` must reuse an in-flight save instead of starting a parallel save.
  - clear or suppress pending timers when autosave is disabled or the hook enters an error state.
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
  - keep integration orchestration in `src/features/cms-content/CmsContentListPanel.tsx`.
  - keep pure route/share helper logic in `src/features/cms-content/CmsContentActions.ts`.
  - presentational components (`CmsContentCardGrid`, `CmsContentCardList`) receive typed callbacks only and do not own mutation logic.
- Action semantics:
  - **Open**: navigate to editor route via `router.push(buildContentEntryEditRoute({workspaceSlug, entryId}))`.
  - **Share**: build the canonical full editor URL through `buildContentEntryShareUrl`, copy it via `navigator.clipboard.writeText`, and show explicit success/error toast feedback.
  - **Delete**: open Lumia `ConfirmDialog`, perform delete mutation after confirmation, keep pending state row-scoped, and show success/error toast feedback.
  - **Favorite**: perform optimistic toggle with rollback on failure and error toast feedback.
- Resilience and fallback:
  - wrap route/share URL construction in try/catch so invalid slug/entryId values cannot crash the view.
  - guard all actions against missing workspace context (`resolvedWorkspaceSlug`); return early and do nothing if absent.
- Tech-debt controls:
  - do NOT inline path-template strings in card handlers; always delegate to `CmsContentActions` helpers.
  - do NOT use the deprecated URL query-param directory id in card handler context; use `resolvedDirectoryId` (path-segment-resolved UUID) exclusively.
  - keep toast copy and mutation sequencing in the feature layer rather than burying feedback inside presentational cards.
- TDD and coverage:
  - test Open by clicking the card's open button and asserting router.push target.
  - test Share by clicking the card's share button and asserting clipboard copy plus success/error toast behavior.
  - test Delete by covering cancel, confirm, row-scoped pending state, success toast, and failure toast.
  - test Favorite by covering optimistic update, non-blocking interaction, and rollback on failure.
  - maintain touched-module coverage `>= 80%` statements and branches.

### CMS-UI-007 Editor Route Standards (CmsEditorScreen)

- Route ownership:
  - `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/page.tsx`: thin Next.js RSC — awaits async params, passes `workspaceSlug` + `entryId` to `CmsEditorScreen`.
  - `app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/layout.tsx`: full-screen overlay layout (`fixed inset-0 z-50`) to escape the dashboard shell chrome.
- Overlay layering contract:
  - Lumia DS dialogs opened from the full-screen editor must render their scrim and content above the editor layout shell.
  - Keep modal stacking in `@lumia-ui/components` (`Dialog` / `ConfirmDialog`) rather than adding app-local z-index overrides in CMS routes or layouts.
- Feature container:
  - `src/features/cms-content/CmsEditorScreen.tsx`: client component that loads entry by id, orchestrates autosave, publish, and unsaved-change guard.
- Responsibilities of CmsEditorScreen:
  - fetch entry by `entryId` on mount.
  - pass entry data to `CmsEditorLayout` (metadata fields + editor canvas).
  - integrate `useCmsEntryAutosave` for debounced save.
  - expose publication actions that always call `autosave.flush()` before mutating live/scheduled state.
  - guard browser unload when `hasUnsavedChanges` is true.
  - guard feature-owned in-app exit paths when `hasUnsavedChanges` is true.
- Publication-state contract:
  - persisted backend `status` values are `draft`, `scheduled`, `published`, and `archived`.
  - editor-only `publicationState` extends persisted status with `published-with-changes` when a published entry has newer saved edits than `publishedAt`.
  - `CmsEditorScreen` owns the derived `publicationState`; `CmsEditorLayout` stays presentational and receives the derived state as a prop.
- Publication action semantics:
  - `draft`: top-level actions are `Save Draft`, `Schedule`, and `Publish`.
  - `scheduled`: top-level actions are `Save Draft`, `Reschedule`, and `Manage`; `Manage` contains `Publish now`, `Move to draft`, and `Archive entry`.
  - `published`: top-level actions are `Save Draft` and `Manage`; there is no schedule action when the live page is already current.
  - `published-with-changes`: top-level actions are `Save Draft` and `Manage`; `Manage` contains `Republish now`, `Unpublish to draft`, and `Archive entry`.
  - `archived`: top-level action remains `Manage`; restore/archive transitions stay in the publication menu rather than adding a second archive-specific toolbar.
- Scheduling semantics:
  - schedule inputs are shown only when there is a non-live entry to schedule (`draft` or `scheduled`).
  - do not expose scheduling for `published-with-changes` until the backend has separate live-vs-draft revision support.
  - browser-local date and time are converted to UTC ISO before calling `setWorkspaceContentEntryStatus({ status: "scheduled", publishAt })`.
  - schedule popover defaults should initialize to the next valid future slot for draft scheduling; only real scheduled entries should seed from `publishedAt`.
  - the status API rejects scheduling entries that are already `published`; use `Republish now` for immediate updates.
- Next.js standards:
  - route params (`workspaceSlug`, `entryId`) come from async `params` prop — must be `await`-ed in RSC.
  - route/layout files must remain thin; no direct data fetching or mutation logic.
  - the full-screen layout wraps only the editor; it must not affect other dashboard routes.
- React standards:
  - keep all stateful logic (autosave, publish, unsaved guard) inside `CmsEditorScreen`; keep `CmsEditorLayout` presentational.
  - initialize content state from loaded entry; track local draft separately from saved state.
  - load Lumia editor styling centrally from `app/globals.css`; do not import editor CSS ad hoc inside route or feature components.
  - do not introduce a second manual-save path for publish; use `useCmsEntryAutosave` as the single draft persistence abstraction.
- Security and resilience:
  - treat `entryId` as untrusted; validate via API response before rendering content.
  - do not expose raw error messages in editor UI.
  - unsaved-change prompt must cover both in-app navigation and browser tab close/refresh.
  - publish must not proceed when the required pre-publish save fails.
- TDD and coverage:
  - Tier 2 tests for: loading state, entry display, autosave trigger, save-before-publish behavior, publish action, status mutation actions, schedule action, and unsaved guard.
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
  - `resolvedDirectoryId === null`: root content view (no path segments)
  - `resolvedDirectoryId === UNMATCHED_DIRECTORY_ID`: path resolution finished but no persisted directory matched the requested breadcrumb path
  - `resolvedDirectoryId === string`: UUID of the leaf directory matching the current URL path
- Tech-debt rules:
  - any reference to the deprecated URL query-param directory id in content listing/create/logging context must be replaced with `resolvedDirectoryId`.
  - resolution is keyed on `breadcrumbKey` (stable join of path segments) to avoid redundant API calls on unrelated state updates.
  - `breadcrumbParts` and `breadcrumbKey` must be declared before any `useEffect` that references them (TDZ safety).
- Testing:
  - Tier 2: assert that `mockListWorkspaceContentDirectories` is called and the resulting leaf UUID is passed to `useCmsContentEntries`.
  - Tier 2: assert that `mockListWorkspaceContentDirectories` and `useCmsContentEntries` preserve `UNMATCHED_DIRECTORY_ID` for unmatched paths and never fall back to a root (`null`) fetch.
  - Tier 2: assert that root path (no segments) skips API call and passes `null` directoryId.

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
  - pure scroll-state logic under `src/features/cms-content/*.test.ts`
  - route-level browser regressions under `e2e/*.spec.ts` with fixture routes in `app/e2e/*`

Verification commands:
- `pnpm test`
- `pnpm test:coverage`
- `pnpm lint`
- `pnpm test:e2e`

## Lint Strategy

- Use ESLint flat config (`eslint.config.mjs`) as required by Next.js 16 / ESLint 9.
- Canonical command: `pnpm lint` (executes `eslint .` through infra env wrapper).
- Keep lint setup non-mutating and deterministic for local + CI usage.

## Workspace Admin Integrations (CMS Contextual Consumer)

Reference:
- Epic: `xynes/xynes-infra/infra/architecture/epics/workspace-admin-integrations.md`
- Implementation plan: `xynes/xynes-infra/docs/plans/2026-04-24-workspace-admin-integrations-cms-contextual-ui.md`

### Ownership rule

- The CMS console is a **contextual consumer** of workspace integration primitives (verified domains, workspace API keys, future webhooks). It must **not** host global lifecycle forms.
- Verified domains and API keys are owned by the Workspace Admin (auth) app. CMS surfaces counts, helper context, and deep links to Workspace Admin.

### Frontend ownership (segregation)

- Route: `app/dashboard/[workspaceSlug]/integrations/page.tsx` — thin async RSC; awaits `params` and forwards `workspaceSlug` to the client panel. **No** data fetching, env reads, or lifecycle forms here.
- Feature: `src/features/integrations/CmsIntegrationsPanel.tsx` — owns rendering and effect orchestration. Surfaces `workspaceSlug` in the page header for active-context disambiguation.
- Message namespace: `cms.integrations`. All panel copy is catalog-driven; links and counts remain code-owned.
- Pure URL/security helper: `src/features/integrations/workspace-admin-links.ts` (`buildWorkspaceAdminIntegrationUrl`) — generates Workspace Admin deep links. Uses typed preset-key constants (`CMS_READONLY_PRESET_KEY`, `CMS_PUBLISHER_PRESET_KEY`) from `./workspace-api-key-preset-keys.ts` rather than embedded literals; a canonical-list rename surfaces as a TS error in the mirror file instead of a silently broken `?preset=…` URL.
- Cross-package contract mirror: `src/features/integrations/workspace-api-key-preset-keys.ts` (PFU-6, landed 2026-05-09) exports `WORKSPACE_API_KEY_PRESET_KEYS` (mirror of `@xynes/platform-contracts` `WORKSPACE_API_KEY_PRESET_KEYS`) and the typed `CMS_READONLY_PRESET_KEY` / `CMS_PUBLISHER_PRESET_KEY` references used by the deep-link builder. Parity with the canonical contract is enforced by `workspace-api-key-preset-keys.contract.test.ts`.
- Pure data client: `src/lib/dashboard/workspace-integrations-client.ts` — exports `fetchCmsWorkspaceIntegrationStatus`, the `CmsWorkspaceIntegrationStatus` type, and the canonical frozen sentinel `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS`.

### Canonical "unavailable" sentinel

- `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS` is exported once from the client and is `Object.freeze`d.
- The panel imports the sentinel; it MUST NOT redeclare its own copy. This rule keeps the contract single-sourced and prevents drift if the shape ever changes.

### Security and resilience

- Only `http:` and `https:` `NEXT_PUBLIC_AUTH_APP_URL` values are honored when building Workspace Admin links. Anything else (missing, whitespace, malformed, `javascript:`, `data:`, `file:`, `vbscript:`, `ws:`, `ftp:`, embedded userinfo like `https://user:pass@host`) falls back to a relative `/dashboard/integrations?...` path so the link cannot be hijacked.
- `react/jsx-no-target-blank` is active in this workspace's ESLint config (inherited from `eslint-config-next/core-web-vitals`); any future external link missing `rel="noopener"` will fail lint.
- `fetchCmsWorkspaceIntegrationStatus` reuses `gateway-client-utils` (`unwrapGatewayEnvelope`, `normalizeGatewayClientInputs`) and **fails closed** to `unavailable: true` on:
  - missing inputs (apiBaseUrl/workspaceId/accessToken)
  - HTTP errors (non-2xx)
  - malformed payloads (non-object after envelope unwrap, or missing the named list)
  - thrown exceptions / aborts
- **Wire contract (canonical, single-sourced with `xynes-auth-app/src/lib/integrations/workspace-integrations-client.ts` and `xynes-accounts-service/src/actions/handlers/integrations/{domains,apiKeys}.ts`):** after `unwrapGatewayEnvelope` peels the gateway `{ok, data, meta}` wrapper(s), the resulting value is an OBJECT, not a bare array:
  - `GET /workspaces/:wsId/domains` → `{ domains: WorkspaceDomain[] }`
  - `GET /workspaces/:wsId/api-keys` → `{ apiKeys: WorkspaceApiKey[] }`
  
  The internal `fetchUnwrappedRows({ url, listKey })` helper enforces this strictly — bare-array payloads (the pre-2026-05-09 contract) and any other shape fail closed to the sentinel. There is a regression-guard test that asserts a bare `data: []` payload is rejected, so the old contract cannot silently come back.
- The client returns an object whose keys are exactly the documented contract (`verifiedDomainCount`, `pendingDomainCount`, `activeApiKeyCount`, `cmsScopedApiKeyCount`, `unavailable`). Hostile fields like `rawKey`/`keyHash`/`internalAuditNote` cannot bleed through (asserted by an explicit "documented-keys-only" test that injects hostile fields).
- `catch {}` blocks are intentionally empty — no upstream payload, token, or stack trace is ever logged. Errors collapse to the canonical `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS` sentinel.
- `workspaceSlug` is rendered as a React text child (auto-escaped); never used in any URL or via `dangerouslySetInnerHTML`.

### UI rules (do / do-not)

The CMS integrations page MAY:
- show counts, status copy, and Workspace Admin deep links
- show informational cards for future Workspace Admin features (e.g. webhooks)

The CMS integrations page MUST NOT host:
- verified-domain lifecycle forms (add domain, verify domain, delete domain)
- API-key lifecycle forms (create key, revoke key, copy raw key)
- webhook lifecycle forms (create/delete webhook)

### Lumia DS composition rules

- Panel chrome uses Lumia DS only: `Card`, `Badge`, `Alert` from `@lumia-ui/components`.
- Workspace Admin **deep links use a styled native `<a>`**, NOT `<Button>`. Lumia's `Button` is a real `<button>` element; nesting `<a>` inside `<button>` is invalid HTML and violates a11y (interactive content nested in interactive content). Use Lumia's exported `buttonStyles` to apply the visual treatment to the anchor.
- External links (when `NEXT_PUBLIC_AUTH_APP_URL` resolves to a real `http(s)` origin) must include `target="_blank"`, `rel="noopener noreferrer"`, the visible `↗` glyph (with `aria-hidden="true"`), AND a screen-reader-only "(opens in new tab)" hint so AT users get the same affordance.
- Relative-fallback links (when `NEXT_PUBLIC_AUTH_APP_URL` is missing/unsafe) must NOT carry `target="_blank"`.

### Accessibility contract

- Page heading is an `<h1>`.
- Cards expose a real `<h2>` per card and a real `<h3>` for the future-webhooks section.
- Counts are wrapped in semantic `<dl>/<dt>/<dd>`.
- The unavailable Alert renders with `role="alert"` (Lumia maps `variant="warning"` and `variant="error"` to `role="alert"`; everything else maps to `role="status"`).

### Testing

- Tier 1 — pure URL builder: `src/features/integrations/workspace-admin-links.test.ts`.
- Tier 1 — pure data client: `src/lib/dashboard/workspace-integrations-client.test.ts` (includes a "frozen sentinel + documented-keys-only" test and a "no leak from hostile upstream" test).
- Tier 2 — panel composition: `src/features/integrations/CmsIntegrationsPanel.test.tsx` (covers slug-as-context, native-anchor deep links, safe `rel`, sr-only hint, `role="alert"` mapping, and absence of every disallowed lifecycle form).
- Tier 2 — route orchestration: `app/dashboard/[workspaceSlug]/integrations/page.test.tsx`.

### Cross-app workspace handoff (FE-XAPP-BUG-001, landed 2026-05-12)

CMS Console and the Auth App run on different origins (`:3000` vs `:3100` in dev; different subdomains in production), so their `xynes_workspace_id` localStorage entries are scoped independently. Without an explicit handoff, a "Manage in Workspace Admin" deep link would land the user on whatever workspace the Auth App had selected last — silently disconnecting from the CMS-side workspace selection.

**Builder signature.** `buildWorkspaceAdminIntegrationUrl(target, workspaceSlug)` now takes the **originating workspace slug** as a required argument and appends `&workspace=<encodeURIComponent(slug)>` to the URL alongside the existing `tab=…&preset=…`. Empty / whitespace-only slugs are deliberately omitted (the recipient falls through to its existing localStorage-based selection) — never sent as `&workspace=` (empty string) which would be ambiguous on the receiving side.

```ts
// Domains link, originating from the "acme demo" workspace
buildWorkspaceAdminIntegrationUrl("domains", "acme-demo");
// → https://auth.xynes.example/dashboard/integrations?tab=domains&workspace=acme-demo

// CMS publisher key preset, no originating workspace context
buildWorkspaceAdminIntegrationUrl("cms_publisher_key", "");
// → https://auth.xynes.example/dashboard/integrations?tab=api-keys&preset=cms_publisher
```

**Caller.** `CmsIntegrationsPanel.tsx` is the only caller. It already receives the active workspace slug as a prop (`workspaceSlug`) from `app/dashboard/[workspaceSlug]/integrations/page.tsx` and threads it into every card via the `buildIntegrationCards({ status, t, workspaceSlug })` helper.

**Security invariants (preserved).**

- The slug is `encodeURIComponent`-ed before embedding, so reserved characters never produce a broken query string (regression test asserts `"acme demo & co"` → `"acme%20demo%20%26%20co"`).
- The slug is NOT a permission grant. The Auth App side (`xynes-auth-app/src/components/dashboard/WorkspaceHandoffSync.tsx`) re-resolves it against `useAuth().workspaces` — server-authoritative via `/me` — before honouring the override. A malicious or stale slug fails closed.
- The slug NEVER appears in a `dangerouslySetInnerHTML`, route concatenation, or fetch target. It is only embedded into the query string of the Workspace Admin deep link.

**Tests touched.**

- `workspace-admin-links.test.ts` — every existing assertion updated to expect the new `&workspace=acme-demo` suffix; 3 new tests cover URL-encoding of reserved characters, empty-slug omission, and whitespace-only-slug omission. 17 tests total.
- `CmsIntegrationsPanel.test.tsx` — 6 URL assertions updated to the new shape; 21 tests, no behaviour change beyond URL expectations.

**Recipient app.** The Auth App's `WorkspaceHandoffSync` client component mounts inside `AuthDashboardShell` and honours the contract for every dashboard route, not just `/dashboard/integrations`. See `xynes-front-end/xynes-auth-app/docs/DEVELOPER.md` § "Cross-app workspace handoff (FE-XAPP-BUG-001)" for the consumer-side details.

## Storage Client (STORAGE-10)

Reference:
- Plan: `xynes/xynes-infra/docs/plans/2026-05-10-universal-object-storage-file-upload-api.md` § STORAGE-10
- Service: `xynes/xynes-storage-service`
- Gateway routes: `xynes/xynes-infra/supabase/migrations/20251229100001_seed_platform_routes.sql` (storage rows)

### Module

- `src/lib/dashboard/storage-client.ts` — universal storage client, reused by the CMS editor upload UX (STORAGE-11) and any future CMS Console feature that needs to mint upload sessions, complete uploads, fetch object metadata, or mint signed download URLs.
- Companion tests: `src/lib/dashboard/storage-client.test.ts`.

### Exports

| Function | Purpose | Gateway route |
|---|---|---|
| `createStorageUploadSession` | Create an upload session | `POST /workspaces/:wsId/storage/uploads` |
| `directProviderUpload` | PUT the file body to the signed provider URL(s) | (provider host — NOT the gateway) |
| `completeStorageUploadSession` | Mark upload complete + queue processing | `POST /workspaces/:wsId/storage/uploads/:uploadId/complete` |
| `abortStorageUploadSession` | Abort a pending session | `POST /workspaces/:wsId/storage/uploads/:uploadId/abort` |
| `getStorageObject` | Read object metadata + variants + processing jobs | `GET /workspaces/:wsId/storage/objects/:objectId?operation=get` |
| `createStorageDownloadUrl` | Mint a short-lived signed read URL | `POST /workspaces/:wsId/storage/objects/:objectId/download-url` |

Public type surface is single-sourced in the same module: `StorageObject`, `UploadSession`, `CreateUploadSessionResult`, `CompletedPart`, `ProcessingJob`, `StorageObjectVariant`, `StorageObjectDetail`, `DownloadUrlResult`, `DirectUploadResult`, plus the closed-set status / method / visibility unions.

### Canonical "drop the leak" list

`UNAVAILABLE_STORAGE_CLIENT_RESPONSE_FIELDS` is the single, frozen source of truth for the documented-keys-only contract. Every parser builds its result through explicit field assignment — upstream rows are NEVER spread — and the test sweep `assertNoLeakedFields` checks that none of the following appear as a standalone JSON field in any response, for any of the five MVP-ready providers (R2 / B2 / iDrive e2 / AWS S3 / MinIO):

```
provider_kind, providerKind, providerId, endpoint, region, bucket,
provider_object_key, providerObjectKey, credential_ref, credentialRef,
accessKeyId, secretAccessKey, r2Token, signedUrl, presignedUrl
```

This is the same posture `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS` enforces for the CMS integrations panel: contract is single-sourced from one frozen export, panel-local mirrors are forbidden.

The signed `uploadUrl` / `parts[].url` / download `url` strings themselves embed signature parameters opaquely. That is by design — callers treat them as bearer-token URLs.

### CMS defaults

`createStorageUploadSession` enforces the STORAGE-10 acceptance criterion by defaulting:

- `purpose = "cms_media"`
- `visibility = "private"`
- `compression = true`

Callers can override any of these per-file when needed (`purpose = "platform_generic"` for non-CMS uploads, `visibility = "public"` if a future feature opts in to public delivery, `compression = false` for assets that must not be transformed).

### Security invariants

1. **Gateway requests carry the Xynes bearer.** Every gateway call goes out with `Authorization: Bearer <jwt>` plus `Accept: application/json` (and `Content-Type: application/json` for POSTs). No `X-XS-*` actor headers are ever set by this module — the gateway is the only thing that mints actor headers (PFU-1 / CMS-API-KEY-ACTOR-1).
2. **Provider requests carry nothing else.** `directProviderUpload` issues a credential-less `fetch` (`credentials: "omit"`) against the signed provider URL, with ONLY the provider-supplied headers (or, for multipart parts, an empty header set — the part URL itself carries the signature). The Xynes session cookie, the Xynes `Authorization` bearer, and any `X-XS-*` header are forbidden — there is a dedicated test that asserts this on every direct-upload call.
3. **Multipart ETag is required.** Multipart provider responses MUST carry an `ETag` header. If a provider omits it, the client refuses to manufacture a fake one — the upload fails with a generic message, not a silent success.
4. **Error messages never echo provider material.** `safeGatewayError` builds the surfaced `Error.message` from `HTTP <status> <statusText>` + the closed-set storage-service error code (e.g. `(NOT_FOUND)`). Provider error bodies, signed URLs, `X-Amz-Signature`-style parameters, raw access keys, and provider endpoint hostnames are never reflected back to the UI. `directProviderUpload` collapses every fetch exception to a generic `"Provider upload failed: network error"` for the same reason.
5. **Soft-deleted / missing objects are indistinguishable.** `getStorageObject` returns `null` for HTTP 404 without exposing the error body. This matches the storage-service "soft-deleted objects look like never-existed" invariant from STORAGE-6.
6. **Strict-by-construction TypeScript types.** Every exported DTO carries `readonly` fields and the provider-config field names listed above DO NOT appear anywhere in the type. Any future drift surfaces as a compile error.

### Operation discriminator

The storage-service registers ONE handler per action key and branches on a payload-level `operation` field (`'create' | 'complete' | 'abort' | 'list' | 'get' | 'download_url' | 'delete' | 'usage'`). This module is responsible for injecting `operation` on every call:

- POST routes carry `operation` in the JSON body.
- GET routes (currently only `getStorageObject`) carry `operation` as a URL query parameter — the gateway merges URL query into the action payload before forwarding to storage-service.

### Pagination / list / usage

`getStorageObject(...)` covers single-object reads. **List, usage, and delete** are deliberately out of STORAGE-10 scope and live in storage-service today as `platform.storage.objects.read` (op `list`), `platform.storage.usage.read`, and `platform.storage.objects.delete`. STORAGE-11 (CMS editor upload UX) does not need them; if a future feature does, add a thin wrapper that follows the same parser / redaction / error-shape conventions documented above.

### Quality gates (STORAGE-10)

- 59 tests in `storage-client.test.ts` (full happy paths + every parser hardening branch + redaction sweep + header-isolation guard + provider-network-error path).
- `bun run lint` / `pnpm run lint` clean.
- `tsc --noEmit` introduces zero new errors against the pre-existing baseline.
- `pnpm run test:coverage` reports `storage-client.ts` at **98.98% lines / 94.85% branches / 100% funcs** (well above the ADR-001 80% floor).

## CMS Content Editor Upload UX (STORAGE-11)

Owner plan: `xynes/xynes-infra/docs/plans/2026-05-10-universal-object-storage-file-upload-api.md` § STORAGE-11.

STORAGE-11 wires the STORAGE-10 storage client into the Lumia editor so CMS authors can upload images inline while the entry stays draft-safe and the persisted body never carries signed delivery URLs.

### Wiring

- `src/lib/dashboard/use-storage-upload-adapter.ts` exports `useStorageUploadAdapter({ apiBaseUrl, workspaceId, accessToken, purpose? })`. The hook returns `{ uploadAdapter, resolveDownloadUrl }` — a bridge the Lumia editor consumes via its `media` prop. Both fields are `undefined` until the workspace + access token are available so the editor falls back to its read-only UX rather than throwing inside an upload click handler.
- The `uploadAdapter.uploadFile(file, { onProgress })` implementation drives the full storage lifecycle:
  1. `createStorageUploadSession` — workspace + purpose defaults from STORAGE-10 (`cms_media` / `private` / `compression: true`).
  2. `directProviderUpload` — credential-less `fetch` to the provider, no `Authorization` / `Cookie` / `X-XS-*` headers forwarded.
  3. `completeStorageUploadSession` — multipart parts forwarded only when present.
  4. `createStorageDownloadUrl` — best-effort signed URL for immediate display. Failure is non-fatal: the editor swaps a fresh URL in on next mount via the resolver path.
- `resolveDownloadUrl(objectId)` mints a fresh signed URL via `createStorageDownloadUrl`. Returns empty string on failure (graceful degradation — the editor keeps its existing `src` rather than blanking the image).
- `CmsEditorScreen` calls `useStorageUploadAdapter(...)` and passes the bridge to `<LumiaEditor media={...} />`. No other CMS component needs to know about storage.

### Entry body normalisation

- `src/features/cms-content/cms-editor-image-refs.ts` exports `stripTransientImageUrls(body)` and `collectMediaObjectIds(body)`.
- `stripTransientImageUrls` walks the editor body and clears the transient `src` field on every `image-block` node that carries an `objectId`. Nodes without an `objectId` (legacy image-from-URL entries) keep their `src` byte-for-byte. Returns a deep-cloned tree — never mutates input.
- `CmsEditorScreen` applies `stripTransientImageUrls` inside its `saveDraftFn` before forwarding the body to `updateWorkspaceContentEntry`, so **the persisted entry body never carries a signed delivery URL when an `objectId` is present.**
- `collectMediaObjectIds(body)` returns the set of storage object ids referenced by image-block nodes. Not used at save time; available for future telemetry / cross-references.
- The walker is depth-bounded at 64 levels (defensive — hostile editor state cannot pin the CPU).

### Lumia DS support (`@lumia-ui/editor`)

The companion Lumia DS PR (`feature/storage-11-image-objectid-support`) adds:
- An optional `objectId?: string` field to `ImageBlockNode`'s payload, `SerializedImageBlockNode`, node fields, constructor, and accessor (`getObjectId()`).
- An optional `objectId?: string` on `MediaUploadResult` so the adapter's `uploadFile()` return shape carries the stable storage object id alongside the display URL.
- An optional `resolveDownloadUrl?: (objectId: string) => Promise<string>` on `EditorMediaConfig`. The `ImageBlockComponent` mounts a `useEffect` that calls the resolver whenever a node carries an `objectId` and applies the fresh URL to the node's `__src` for the current session. A race-guard ensures stale resolutions never overwrite a node whose `objectId` changed mid-flight; resolver rejections / empty strings are swallowed so a partial outage degrades gracefully rather than blanking the image.
- Re-exports `EditorMediaConfig`, `MediaUploadAdapter`, `MediaUploadResult`, `UploadOptions`, `ImageBlockNode`, `$createImageBlockNode`, `$isImageBlockNode`, `ImageBlockPayload`, `SerializedImageBlockNode` from the package entry so consumers can type the adapter + walk the editor body.

These are **additive** Lumia DS changes — all new fields are optional, all existing call sites continue to work, and the existing 1096-test editor suite continues to pass. Pre-STORAGE-11 entries that used `image-block` nodes without an `objectId` remain valid and render with their stored `src`.

### Security invariants (STORAGE-11)

1. **Persisted body never carries a signed URL when an `objectId` is set.** Asserted by `cms-editor-image-refs.test.ts` "STORAGE-11 invariant: no signed URL survives when objectId is set" — `JSON.stringify` of the normalised body sweep for `X-Amz-Signature`, `X-Amz-Credential`, `X-Amz-Security-Token`, `xynes_live_<hex>`, `AKIA[0-9A-Z]+`.
2. **Provider URLs never reach the user-visible error surface.** `use-storage-upload-adapter.test.ts` "STORAGE-11 invariant: error messages NEVER include raw provider material" injects a hostile error containing bucket name, AWS access key ID, raw API key, signature parameters, and provider hostnames; the thrown adapter error is asserted not to contain any of them.
3. **Direct upload `fetch` is credential-less.** Inherited from STORAGE-10's `directProviderUpload` test guarantee.
4. **Soft-deleted objects look like never-existed.** Inherited from STORAGE-10's `getStorageObject` HTTP-404 = `null` behaviour.
5. **Bridge stability.** The `uploadAdapter` reference stays stable across re-renders with stable args (proven by `bridge stability` test) so the Lumia editor's `MediaContext` memo doesn't tear down mid-upload.

### Quality gates (STORAGE-11)

- 33 new tests across `cms-editor-image-refs.test.ts` (15) and `use-storage-upload-adapter.test.ts` (18).
- Full repo suite: **555 / 555 pass / 0 fail / 57 files** (was 513 / 513 / 55 — delta +42 new tests + 2 new files; the +9 difference vs the +33 I added is because two pre-existing test files gained a handful of new tests during integration).
- `pnpm lint` clean.
- `npx tsc --noEmit` introduces zero new errors against `main` (12 pre-existing test-file errors carry over byte-for-byte).
- `pnpm run test:coverage` overall **93.85% statements / 87.57% branches / 96.33% funcs / 93.85% lines**. Per-file: `cms-editor-image-refs.ts` at **100% / 97.36% / 100% / 100%**; `use-storage-upload-adapter.ts` at **95.13% / 83.33% / 100% / 95.13%** (above ADR-001 80% floor).
- `pnpm build` Next.js production build succeeds with no new route footprint.

### Out of scope (deferred)

- Video and generic-file inline upload UX. STORAGE-11 ships image-only — Lumia DS `VideoBlockNode` and `FileBlockNode` would need parallel `objectId` field additions before they can adopt the same path.
- Inline `Uploading` / `Processing` / `Ready` / `Failed` state badges separate from the existing Lumia editor status pill — STORAGE-11 reuses the editor's pre-existing `status` field on `ImageBlockNode` (`uploading` / `uploaded` / `error`). A richer "processing" state that polls storage-service's processing queue (STORAGE-7) and swaps in optimised variants when ready is a clean follow-up.
- Pinned thumbnail / variant selection. The download URL resolver currently mints a URL against the original `objectId`; switching to an optimised variant once STORAGE-8 lands in production is a one-line resolver change.
- Drag-and-drop, paste-from-clipboard, and bulk upload flows that route through the storage adapter (the Lumia editor already wires those into `media.uploadAdapter` — they will work end-to-end once STORAGE-11 is shipped, but tests beyond the unit level live with STORAGE-12).
- Live STORAGE-12 smoke against a real R2 / MinIO target. The unit suite proves the bridge contract; the live end-to-end browser smoke against the dev stack lands with STORAGE-12.

## Feature Flags (STORAGE-LIVE-5)

Owner plan: `xynes/xynes-infra/docs/plans/2026-05-14-storage-live-provider-rollout.md` §8.

STORAGE-LIVE-5 introduces the **first feature-flag consumption** in the CMS Console, routing through the **canonical gateway architecture** that already exists for the auth-app:

```
PostHog Cloud (EU)
  ↑ posthog-node (server-only)
xynes-gateway FeatureFlagService (INFRA-BE-1)
  → GET /flags  (JWT-authenticated, workspace-scoped)
@xynes/auth-sdk <FeatureFlagsProvider> + useFeatureFlag(flag)
  → React context
CmsEditorScreen.tsx
```

**There is NO `posthog-js` in the CMS Console bundle. There is NO `phc_*` key in the browser.** PostHog runs server-side only via `xynes-gateway`'s `FeatureFlagService`. The browser fetches a single `GET /flags` response that carries every workspace-resolved boolean.

### What lives here

- `src/lib/feature-flags/CmsFeatureFlagsProvider.tsx` — thin bridge mounted inside `<AuthProvider>` (so it can read `useAuth().getAccessToken` for the authenticated `/flags` fetch). Wraps the SDK's `<FeatureFlagsProvider>`.
- `src/lib/feature-flags/overrides.ts` — `getCmsFeatureFlagOverrides()` parses `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` (JSON-shaped env var) for local-dev / CI flag forcing. Mirrors the auth-app pattern.

> **BUG-CMS-5 (2026-05-30):** the bridge is also mounted **inside `<WorkspaceProvider>`** so it can read `useWorkspace().currentWorkspace.id` and forward it to the SDK provider as `workspaceId`. The SDK sends the value as the `X-XS-Workspace-Id` request header on `/flags`; the gateway lifts it into a PostHog `workspace` group + `groupProperties` so per-workspace flag rollouts (e.g. flipping `cms_editor_storage_uploads` ON for a single workspace in the PostHog admin UI) resolve correctly. Without this wiring, the gateway sent no workspace context at all and PostHog returned the default (`false`) regardless of admin-configured workspace conditions — see the BUG-CMS-5 verification block in workspace-root `AGENTS.md` for the full root-cause trace.

### Reading a flag

```tsx
import { useFeatureFlag } from "@xynes/auth-sdk";

const isEnabled = useFeatureFlag("cms_editor_storage_uploads");
```

The SDK's `useFeatureFlag(flag: FeatureFlagKey): boolean` is the canonical hook. **`FeatureFlagKey` is a closed TypeScript union** — every flag the CMS Console reads MUST be added to:
1. `xynes-front-end/xynes-auth-sdk/src/types/feature-flags.ts` — `FeatureFlags` interface + `DEFAULT_FEATURE_FLAGS` constant.
2. `xynes/xynes-gateway/src/featureFlags/types.ts` — `DEFAULT_FLAGS` (same default value).

`cms_editor_storage_uploads` lives in both (default `false`).

### How the CMS editor gates the upload affordance

`CmsEditorScreen.tsx` reads the flag once, then derives the `<LumiaEditor media={...}>` prop:

| Flag | `media.uploadAdapter` | `media.resolveDownloadUrl` |
|---|---|---|
| OFF | `undefined` (upload paths in Lumia DS short-circuit silently) | wired (existing image-block `objectId`s still render — graceful degradation) |
| ON | wired via `useStorageUploadAdapter` | wired |

Lumia DS plugins (`InsertFilePlugin`, `DragDropPastePlugin`, every `*ToolbarButton` / `*BlockComponent`) all check `mediaConfig?.uploadAdapter` truthy before invoking. **No Lumia DS code change is needed to silently hide the upload affordance when the flag is OFF.**

The `resolveDownloadUrl` stays wired regardless of flag state. **Existing entries with `objectId` image-blocks (created when the flag was previously ON) continue to render** even after the flag flips OFF for the workspace — only NEW uploads are blocked.

### Configuration

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` | No | empty | JSON-shaped local-dev override. Applied AFTER the gateway fetch, so it's the source of truth for the page lifetime when set. Example: `{"cms_editor_storage_uploads":true}`. |

In production, flag flips happen in PostHog admin against the gateway-side `FeatureFlagService` — no FE redeploy needed.

### Rollout posture

- **Default:** `cms_editor_storage_uploads` is OFF in every workspace (set in `DEFAULT_FLAGS` on both sides).
- **Order:** dev workspace → 1 internal workspace → 5 friendly customers → general availability.
- **Per-step gate:** a fresh `bash scripts/smoke-universal-storage.sh --full --provider r2` run + redaction sweep against the workspace's `platform.workspace_storage_providers` row must pass before each step.
- **Forbidden:** `*: on` wildcard. Workspace-specific overrides only.

### SSR / hydration

The SDK's `<FeatureFlagsProvider>` initialises with `DEFAULT_FEATURE_FLAGS` (off for `cms_editor_storage_uploads`) on first render — on the server AND during initial client mount. The PostHog-resolved value lands on a second render after the gateway fetch resolves. On flag-on workspaces the editor briefly renders without the upload affordance before hydration flips it on. Acceptable because the editor is already a heavyweight client-only component (Lexical) showing a loading state during that window.

### Why this is NOT client-side PostHog

The earlier client-side `posthog-js` design was rejected because:
1. `xynes-gateway` already integrates `posthog-node` server-side (INFRA-BE-1 `FeatureFlagService`).
2. `@xynes/auth-sdk` already exposes the canonical `useFeatureFlag(flag)` hook consuming the gateway.
3. No `phc_*` key in the browser → no key exposed in bundle.
4. Adblocker-resilient — `/flags` rides the first-party gateway domain.
5. Single source of truth for flag definitions and per-workspace overrides.

### Quality gates (STORAGE-LIVE-5)

- **Lumia DS:** 1121 passed / 2 skipped / 0 fail / 104 files (was 1119; +2 net new for the additive `source` arg on `MediaUploadCallbacks.onUploadStart`). Lint clean. `tsc --noEmit` baseline byte-identical (146 errors). `pnpm --filter @lumia-ui/editor build` succeeds (ESM 202.71 KB, DTS 16.01 KB).
- **CMS Console:** 573 passed / 0 fail / 59 files (was 556; +17 net new: 5 `CmsEditorScreen` flag-gate tests, 7 `overrides` tests, 5 `CmsFeatureFlagsProvider` bridge tests). Lint clean. `tsc --noEmit` baseline byte-identical (12 errors). `pnpm build` succeeds.
- **Coverage:** overall **93.91% stmts / 87.74% branches / 96.36% funcs / 93.91% lines** (above ADR-001 80% floor). New `src/lib/feature-flags/` directory at **100% / 100% / 100% / 100%**.

### Out of scope (deferred)

- **Client-side telemetry for upload events.** A previous draft of STORAGE-LIVE-5 emitted `storage.upload.{started,completed,failed}` events from the browser via `posthog-js`. The gateway-architecture migration dropped this because (a) PostHog is server-only here, (b) gateway audit-log telemetry already captures storage actions (STORAGE-9). If a future story wants per-user upload analytics, route them through the gateway's existing telemetry pipeline rather than re-introducing client-side PostHog.
- **Server-side flag evaluation via `posthog-node` directly from CMS Console RSCs.** The editor is a `"use client"` boundary; no RSC needs the flag at MVP. Future RSC consumers should add a thin server helper that hits the gateway `/flags/:key` endpoint (already documented in `xynes/api-docs/gateway/README.md`).
- **The `source` arg on `MediaUploadCallbacks.onUploadStart`** (Lumia DS) was added speculatively for the original client-telemetry design. It's currently **unconsumed** but stays in the API surface for the eventual gateway-proxied telemetry story.

## Content Card Rendering (BUG-CMS-1)

CMS content cards intentionally do NOT render the `description` field from the entry DTO. This is the BUG-CMS-1 decision (sprint plan §5 / `xynes/xynes-infra/docs/plans/2026-05-29-q2-bugfix-sprint-stories.md`).

### Contract

- `CmsContentCardGrid` and `CmsContentCardList` (under `src/components/dashboard/`) accept ONLY `title`, `ownerName`, `createdAt`, `avatarUrl`, `status`, and (for the list variant) `collaborators` + `isFavorite` + action callbacks.
- Neither component accepts a `description` prop. Adding one back requires a product decision (see "Future hover-reveal / detail view" below).
- The entry DTO field `description` (`WorkspaceContentEntry.description`) is **preserved** for the editor + future detail view. Only the card render is dropped.
- `mappers.ts` (`mapEntryToGridCardProps` / `mapEntryToListCardProps`) does NOT forward `entry.description`.

### Why no description slot

Three options were weighed during planning (recorded in `xynes/xynes-infra/docs/plans/2026-05-29-q2-bugfix-sprint-stories.md` §5 / BUG-CMS-1 Decision):
1. Collapse the slot to zero when empty → rejected (sparse descriptions produce ragged tile heights).
2. Remove the slot entirely → **chosen** (uniform card height, denser grid, no layout shift, converges with BUG-CMS-7 archived badge + BUG-CMS-8 owner display name).
3. Reserve the slot with a placeholder → rejected (visual noise on the majority of cards).

### Future hover-reveal / detail view

If product later wants description previews back, the recommended follow-up is a hover-reveal tooltip or an info-icon-triggered detail panel — both preserve information without sacrificing grid rhythm. That work is **out of scope** for BUG-CMS-1 (feature, not a bug fix).

### Regression guards (per-test-file)

Both `CmsContentCardGrid.test.tsx` and `CmsContentCardList.test.tsx` ship three BUG-CMS-1 regression tests:
- "renders no description `<p>` element" — fails if a future change re-adds a `<p>` with `min-h-[72px]` or a `line-clamp` utility (the previous description-slot signature).
- "card vertical structure" — asserts the card has exactly the documented number of direct children (1 for grid: metadata row; 2 for list: open region + actions row).
- "uniform DOM shape across mixed entries" — mounts three card instances and asserts identical `className` + `children.length` on the outermost element.

## Archived Status Visual Treatment (BUG-CMS-7)

`CmsContentCardGrid` and `CmsContentCardList` now surface the third entry status (`archived`) explicitly. The mappers no longer collapse `archived` into `draft`.

### Contract

- `status: "draft" | "published" | "archived"` on both card prop types.
- `mappers.ts::resolveCardStatus` returns `archived` directly when the upstream `WorkspaceContentEntry.status === "archived"`. No fallback collapse.
- Each card carries a `data-status` attribute (`"draft" | "published" | "archived"`) for stylesheet hooks and integration tests.
- Archived rendering:
  - Adds the utility classes `opacity-60 grayscale` to the card root (grid) or to the open-region only (list — the actions row stays at full opacity so users can navigate in to un-archive, delete, or favourite without visual ambiguity).
  - Renders a Lumia DS `<Badge variant="subtle">` with the localized `cms.content.card.archived` copy.
  - Replaces the open-region `aria-label` with the dedicated `cms.content.card.archivedAriaLabel` so screen readers announce "<title> (archived)" instead of "Open content <title>".
- Click + keyboard (`Enter` / `Space`) navigation still triggers `onOpen` for archived entries (un-archive path).

### Badge variant note

The sprint plan called for `Badge variant="muted"`. Lumia DS Badge variants are `'default' | 'outline' | 'subtle'`. We use `variant="subtle"` (the closest semantic match — a lower-weight visual treatment) rather than introduce a new variant token. If product later wants a stronger "archived" treatment, the right move is to add a dedicated `archived` token to Lumia DS, not to layer Tailwind utilities on top of the badge.

### i18n keys (en-US, en-XA)

`messages/<locale>/cms.content.json` → `cms.content.card`:
- `archived` — the badge label ("Archived" / "[AArrcchhiivveedd]").
- `archivedAriaLabel` — the open-region accessible name for archived entries ("{title} (archived)" / "[{title} ((aarrcchhiivveedd))]").

### Regression guards (per-test-file)

`CmsContentCardGrid.test.tsx` and `CmsContentCardList.test.tsx` each ship four BUG-CMS-7 regression tests covering:
1. Archived badge renders + Draft badge does NOT render + `data-status="archived"` + dim utilities applied.
2. Archived `aria-label` matches the dedicated archived hint (no "Open content …" override).
3. Click + keyboard navigation still works on archived entries (un-archive workflow preserved).
4. Published entries are NOT dimmed and carry no Archived badge (baseline-state regression guard).

`mappers.test.ts` also has two new BUG-CMS-7 cases: archived → archived (grid + list) instead of the prior archived → draft collapse.

## Content Card Owner Label (BUG-CMS-8)

CMS content cards surface a structured `creator` field threaded end-to-end from CMS Core's `cms.entry.listByDirectory` / `cms.entry.getById` action handlers. The wire DTO is documented on `WorkspaceContentEntry.creator` in `src/lib/dashboard/content-entries-client.ts`. Card components consume it through `src/components/dashboard/cms-content-card-owner.ts`, which is the single source of truth for the owner-label precedence used by both grid and list cards.

### Wire contract

| Value | Meaning | Source-of-truth |
|---|---|---|
| `null` | The entry was created by an `api_key` actor (see CMS-API-KEY-ACTOR-1 Story C). `created_by` is `NULL` in `cms.content_entries`. | `mapEntry` in `xynes-cms-core/src/actions/handlers/entry-management.handler.ts`. |
| `{ id, displayName: string }` | Real human creator. `id` is the `identity.users.id` UUID; `displayName` is from `identity.users.display_name`. | Cross-schema lookup via `listEntryCreatorsByUserIds`. |
| `{ id, displayName: null }` | Real `created_by` UUID but no matching `identity.users` row (deleted user / future cascade-less path). | Fall-through branch in `resolveCreator`. |

### Owner-label precedence

`resolveOwnerLabel` in `cms-content-card-owner.ts` picks the visible label in this order:

1. `creator === null` → `apiKeyCreator` (`"Created via API key"` in `en-US`).
2. `creator.displayName` trimmed → display name.
3. `ownerName` trimmed → legacy editor-alias on the entry `data` blob.
4. otherwise → `fallbackOwner` (`"Unknown owner"` in `en-US`).

### Security invariants (regression-guarded)

- The visible label NEVER carries `apiKeyId`, `keyPrefix`, `keyHash`, `rawKey`, or any `xynes_live_*` substring — the cms-core handler ships `creator: null` instead of a partial object, and the parser in `content-entries-client.ts` ONLY copies the two documented fields off the wire (`id` + `displayName`).
- `parseWorkspaceContentEntryCreator` fails soft to `null` on malformed payloads, so a hostile upstream can never break the list render.
- The `apiKeyCreator` i18n string is product copy only — callers MUST NOT interpolate any key id / prefix / hash into it.

### Tests

- `src/lib/dashboard/content-entries-client.test.ts` — `BUG-CMS-8 creator field parsing` block (7 tests) covers the parser's success / fail-soft / hostile-field-sweep paths.
- `src/components/dashboard/CmsContentCardGrid.test.tsx` — `BUG-CMS-8 creator precedence` block (5 tests).
- `src/components/dashboard/CmsContentCardList.test.tsx` — `BUG-CMS-8 creator precedence` block (6 tests, including the pseudo-locale assertion).
- `src/features/cms-content/mappers.test.ts` — 4 new mapper tests forwarding both null and non-null creators.

### i18n

- `messages/en-US/cms.content.json` adds `card.apiKeyCreator: "Created via API key"`.
- `messages/en-XA/cms.content.json` adds the pseudo-locale mirror `[CCrreeaatteedd vviiaa AAPPII kkeeyy]`.

## Workspace Slug Guard on `/dashboard/[workspaceSlug]/*` Routes (BUG-AUTH-9, 2026-06-01)

The CMS Console's workspace-scoped routes are protected by `CmsDashboardShell` (mounted from `app/dashboard/[workspaceSlug]/layout.tsx`). Two new guards run AFTER the existing `redirectToLogin` auth guard:

### Wrong-slug guard (cross-tenant probe)

- Trigger: `!isAuthLoading && isAuthenticated && workspaces.length > 0 && workspaceBySlug === null`. The user is signed in, has at least one workspace, but the slug in the URL does NOT match any workspace they can access.
- Action: `router.replace("/dashboard")`. The CMS Console's own dashboard resolver at `app/dashboard/page.tsx` then picks the user's `currentWorkspace` (or the first workspace) and redirects to its content section. Same-app redirect — we deliberately do NOT cross-app to the auth-app workspace selector, because staying inside the CMS Console preserves any in-flight CMS routing context.
- Render: `<main data-testid="cms-dashboard-workspace-guard-fallback" data-guard-reason="wrong-slug">` with `role="status"` and translated copy from `cms.shell.status.{wrongWorkspaceTitle,wrongWorkspaceDescription}`. The Lumia DashboardShell itself is NOT mounted — no flash of nav rendered against a `null` workspace context.

### No-workspace guard

- Trigger: `!isAuthLoading && isAuthenticated && workspaces.length === 0`. The user is signed in but has no workspaces at all.
- Action: `router.replace(buildAuthWorkspaceCreationUrl())`. This is the cross-app onboarding link the shell already uses for "Create new workspace" — already honours the WSA-FIX-2 `?redirect=<cms-landing>` semantics so the user lands back on the CMS Console once they create a workspace via the auth app.
- Render: same fallback `<main>` with `data-guard-reason="no-workspace"` and the `cms.shell.status.{noWorkspaceTitle,noWorkspaceDescription}` strings.

### Order of guards

Auth (redirect to login) runs first; workspace guards (this story) run second. Both are gated on `!isAuthLoading` so a transient empty `workspaces` array during auth bootstrap does not falsely trigger a redirect.

### BUG-CMS-9 contract preservation

The fallback `<main>` uses `min-h-screen` just like the two pre-existing pre-auth fallbacks in `CmsDashboardShell.tsx` (`Loading dashboard…` and `Redirecting to login…`). `CmsDashboardShell.tsx` already sits on the `app/dashboard-shell-contract.test.ts` allowlist for that exact reason — no allowlist change required for BUG-AUTH-9.

### Regression coverage

`src/components/dashboard/CmsDashboardShell.test.tsx > workspace guard (BUG-AUTH-9)` — 5 tests:

1. Unknown slug → `router.replace("/dashboard")` + `data-guard-reason="wrong-slug"` + no shell render.
2. Empty workspaces → `router.replace("http://localhost:3100/onboarding...")` + `data-guard-reason="no-workspace"` + no shell render.
3. Matching slug → no redirect, shell renders normally.
4. `isLoading === true` → no redirect (waits for auth bootstrap).
5. Wrong-slug fallback has `role="status"` for screen-reader announcement.

### i18n

- `messages/en-US/cms.shell.json` adds four `status.*` keys.
- `messages/en-XA/cms.shell.json` mirrors them in the existing doubled-char pseudo pattern.
- `messages.meta/cms.shell.json` documents the new keys under the existing `status` context.
