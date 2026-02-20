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
- Use SDK redirect/config primitives; do not hand-roll auth redirect URLs in app routes/components.

## Auth Routing Standards (S1-006/S1-007)

- CMS follows protect-all by default through `middleware.ts`.
- Middleware matcher is UI-focused and excludes `/api/*` and Next static/image internals.
- Public allowlist must stay explicit and minimal:
  - `/` (landing)
  - `/logout` (delegates to auth-app logout even when local cookie is absent)
  - `/_next/*`, `/favicon.ico`, `/api/*`
- Protected route redirects must use auth-sdk URL helpers and preserve safe return URLs.
- Never pass unvalidated external redirect values directly into auth/logout URLs.
- Logout authority is `xynes-auth-app`; CMS must not clear Supabase auth cookies directly.

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

- Use `next lint` as the canonical lint entrypoint in this repo.
- Keep shared Next.js lint rules in root `.eslintrc.json`.
- Ensure lint can run in local and CI without mutating runtime/test settings.
