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
pnpm test         # run Vitest once
pnpm test:watch   # run Vitest in watch mode
pnpm test:coverage # run with coverage report (target: ≥80% statements + branches)
```

## Folder Structure

```text
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
| 3 | E2E / Playwright | `e2e/*.spec.ts` | smoke |

**Coverage gate**: ≥ 80% statements and ≥ 80% branches per touched module.

`app/e2e/*` fixture routes are test-only. They must stay disabled by default and are enabled only by the Playwright web-server env flag.

### Running Tests

```bash
pnpm test:coverage
pnpm test:e2e
```

Targeted `CMS-UI-005` revalidation:

```bash
node ../infra/scripts/with-env.mjs vitest run \
  'src/features/cms-content/CmsContentListPanel.test.tsx' \
  'src/features/cms-content/CmsContentActions.test.ts' \
  'src/lib/dashboard/content-entries-client.test.ts' \
  'src/features/cms-content/mappers.test.ts' \
  'src/components/dashboard/CmsContentCardList.test.tsx'
```

Tests live co-located next to their source files (`CmsEditorScreen.test.tsx` next to `CmsEditorScreen.tsx`).

### Mocking Conventions

- `next/navigation` → mock `useRouter` / `usePathname`
- `@xynes/auth-sdk` → mock `useAuth` / `useWorkspace`
- API clients → mock at module level with `vi.mock`
- Autosave hook → mock `useCmsEntryAutosave` return value

## CMS Content Feature Module

The `src/features/cms-content/` module implements CMS-UI-001 through CMS-UI-008 from the [FE CMS Dashboard UI Plan](../infra/docs/plans/2026-02-27-fe-cms-dashboard-ui-integration-stories.md).

### CMS-UI-005 action contract

`CMS-UI-005` is intentionally split to keep orchestration, pure helpers, and
presentational rendering separate:

- `src/features/cms-content/CmsContentListPanel.tsx`
  - owns row-scoped action state, Lumia toast feedback, and the controlled
    delete confirmation dialog
- `src/features/cms-content/CmsContentActions.ts`
  - owns pure route/share URL construction and action-specific helper logic
- `src/components/dashboard/CmsContentCardList.tsx`
  - renders controls and delegates callbacks without owning mutation logic

Validated end-to-end card actions:

- `Open`: navigates to the canonical editor route
- `Delete`: Lumia confirm dialog, row-scoped pending state, success/error toasts
- `Share`: copies the canonical internal edit URL and shows success/error toasts
- `Favorite`: optimistic toggle with rollback on failure and error toast

### Key flows

**Create → Edit**
1. User clicks Create in `CmsContentToolbar`
2. `CmsContentListPanel.onCreate` → `createDraftEntryAndResolveEditPath`
3. Gateway `POST /workspaces/:id/content/entries` → entry created
4. `router.push` to `/dashboard/[slug]/content/entry/[id]/edit`
5. `CmsEditorScreen` loads entry via `getWorkspaceContentEntryById`
6. `useCmsEntryAutosave` debounces PATCH saves every 2 s

**Edit → Autosave → Publish**
1. User edits metadata or body in `CmsEditorScreen`
2. `useCmsEntryAutosave` debounces the workspace entry PATCH call and caches a recovery snapshot locally
3. `Publish` calls `autosave.flush()` first to persist the latest draft deterministically
4. Only after the save succeeds does `CmsEditorScreen` call `publishWorkspaceContentEntry`
5. If the pre-publish save fails, publish is aborted and the editor remains on the current draft state
6. If the editor has unsaved changes, the Back action confirms before leaving the route

**Debug logging**
Set `localStorage["cms.debug"] = "1"` in browser console to enable verbose `[CMS][create]` logs. Clear with `localStorage.removeItem("cms.debug")`.

## Related

- [infra/ENV_GUIDE](../infra/README.md) — frontend stack environment guide
- [Auth SDK](../xynes-auth-sdk/README.md)
- [Lumia DS](../lumia-ds/README.md)
