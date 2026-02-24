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

### Dashboard Design Standardization (Auth Parity)

Reference:
- `../../infra/docs/plans/2026-02-24-fe-dashboard-design-standardization.md`

Rules:
- Treat auth dashboard visuals/behavior as the parity baseline.
- Use Lumia DS `DashboardShell` as the source of truth for shell structure.
- Do not introduce app-local re-implementations of shell internals.
- If shell internals need adjustment (for example, workspace trigger alignment), fix in `lumia-ds` and consume the updated package in apps.

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
