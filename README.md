# xynes-cms-console-web

Next.js 16 dashboard application for the Xynes CMS console. Provides the authenticated workspace UI for content management: directory tree, entry list, editor, and related actions.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime**: React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 via `@lumia-ui/tokens`
- **UI Components**: `@lumia-ui/components`, `@lumia-ui/icons`, `@lumia-ui/forms`
- **Auth / Workspace**: `@xynes/auth-sdk`
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint (Next.js config + `@typescript-eslint`)

## Getting Started

```bash
# From workspace root — uses shared env loader
cd xynes-front-end/infra
./run.sh up:dev       # starts CMS console on port 3000

# Or run locally (requires xynes-front-end/infra/.env)
cd xynes-front-end/xynes-cms-console-web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Environment is loaded via `xynes-front-end/infra/scripts/with-env.mjs`. Required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Gateway base URL (e.g. `http://localhost:4100`) |
| `NEXT_PUBLIC_AUTH_APP_URL` | Auth app origin for cross-app handoff |
| `NEXT_PUBLIC_CMS_DEBUG` | Set to `1` to enable verbose `[CMS]` console logs |

## Run Scripts

```bash
pnpm dev          # development server
pnpm build        # production build
pnpm lint         # ESLint check
pnpm test         # run Vitest in watch mode
pnpm test:run     # run Vitest once
pnpm test:coverage # run with coverage report (target: ≥80% statements + branches)
```

## Folder Structure

```
app/
  dashboard/
    [workspaceSlug]/
      layout.tsx                   # CmsDashboardShell wrapper
      content/
        page.tsx                   # → CmsContentListPanel
        [...segments]/page.tsx     # → CmsContentListPanel (nested)
        entry/
          [entryId]/
            edit/
              layout.tsx           # Full-screen overlay (escapes dashboard shell)
              page.tsx             # → CmsEditorScreen
      access-control/
      integrations/
      plugins/
      settings/

src/
  features/
    cms-content/                   # Orchestration layer (CMS-UI feature module)
      CmsContentListPanel.tsx      # Main list route container
      CmsContentListState.tsx      # Pure state resolver + renderable states
      CmsContentActions.ts         # Create/build-path/error-message logic
      CmsEditorScreen.tsx          # Editor route container
      mappers.ts                   # Entry → card prop mappers

  components/
    dashboard/                     # Pure/presentational UI components
      CmsContentToolbar.tsx
      CmsContentCardGrid.tsx
      CmsContentCardList.tsx
      CmsEditorLayout.tsx
      CmsDashboardShell.tsx
      DashboardComingSoonPanel.tsx

  lib/
    dashboard/                     # API clients + hooks
      content-entries-client.ts    # Gateway REST client for entries
      use-cms-content-entries.ts   # SWR-style hook for entry list
      use-cms-entry-autosave.ts    # Debounced autosave hook
      use-cms-content-query-state.ts # URL query param state manager
      workspace-route.ts           # Slug validation + path builder
      gateway-client-utils.ts      # Shared fetch utilities
    auth/
      ...
```

## Testing Standards

Follows [ADR-001](../lumia-ds/docs/ADR-001-testing-standards.md) — three-tier testing architecture:

| Tier | Scope | Pattern | Target |
|---|---|---|---|
| 1 | Pure functions | `*.test.ts` | 100% |
| 2 | Components / hooks | `*.test.tsx` | ≥80% |
| 3 | E2E / Playwright | (future) | smoke |

**Coverage gate**: ≥ 80% statements and ≥ 80% branches per touched module.

### Running Tests

```bash
pnpm test:coverage
```

Tests live co-located next to their source files (`CmsEditorScreen.test.tsx` next to `CmsEditorScreen.tsx`).

### Mocking Conventions

- `next/navigation` → mock `useRouter` / `usePathname`
- `@xynes/auth-sdk` → mock `useAuth` / `useWorkspace`
- API clients → mock at module level with `vi.mock`
- Autosave hook → mock `useCmsEntryAutosave` return value

## CMS Content Feature Module

The `src/features/cms-content/` module implements CMS-UI-001 through CMS-UI-008 from the [FE CMS Dashboard UI Plan](../infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md).

### Key flows

**Create → Edit**
1. User clicks Create in `CmsContentToolbar`
2. `CmsContentListPanel.onCreate` → `createDraftEntryAndResolveEditPath`
3. Gateway `POST /workspaces/:id/content/entries` → entry created
4. `router.push` to `/dashboard/[slug]/content/entry/[id]/edit`
5. `CmsEditorScreen` loads entry via `getWorkspaceContentEntryById`
6. `useCmsEntryAutosave` debounces PATCH saves every 2 s

**Debug logging**
Set `localStorage["cms.debug"] = "1"` in browser console to enable verbose `[CMS][create]` logs. Clear with `localStorage.removeItem("cms.debug")`.

## Related

- [infra/ENV_GUIDE](../infra/README.md) — frontend stack environment guide
- [Auth SDK](../xynes-auth-sdk/README.md)
- [Lumia DS](../lumia-ds/README.md)

