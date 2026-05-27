# STORAGE-LIVE-5 — Feature-flag wiring evidence (2026-05-27, revised)

**Story:** STORAGE-LIVE-5 — First-workspace feature-flag flip for `cms_editor_storage_uploads`.
**Plan:** `xynes/xynes-infra/docs/plans/2026-05-14-storage-live-provider-rollout.md` §8.

**Architecture decision:** PostHog runs **server-side only** in `xynes-gateway`'s `FeatureFlagService` (INFRA-BE-1). The CMS Console consumes the canonical `@xynes/auth-sdk` `useFeatureFlag(flag)` hook backed by `GET /flags`. **No `posthog-js` in the browser. No `phc_*` key in the JS bundle.**

A previous attempt at this story wired client-side PostHog directly. That was ripped out and replaced with the gateway-route architecture per user direction; the rest of this runbook reflects the final state.

## Branches (NOT pushed; no PR opened per workflow)

- `xynes/xynes-gateway` → `feature/STORAGE-LIVE-5-cms-editor-storage-uploads-flag-key` @ `4fd6fae`
  - Registers `cms_editor_storage_uploads: false` in `DEFAULT_FLAGS`.
- `xynes-front-end/xynes-auth-sdk` → `feature/STORAGE-LIVE-5-cms-editor-storage-uploads-flag-key` @ `bf0fbec`
  - Registers the boolean key in `FeatureFlags` interface + `DEFAULT_FEATURE_FLAGS`.
- `xynes-front-end/lumia-ds` → `feature/STORAGE-LIVE-5-onupload-start-source-hint` @ `e7b5c96`
  - Additive optional `source` arg on `MediaUploadCallbacks.onUploadStart` (currently unconsumed; kept for a future gateway-proxied telemetry story).
- `xynes-front-end/xynes-cms-console-web` → `feature/STORAGE-LIVE-5-cms-editor-uploads-feature-flag`
  - Wires `<CmsFeatureFlagsProvider>` bridge + flag-gated `<LumiaEditor media={...}>`.
- `xynes-front-end/infra` → `feature/STORAGE-LIVE-5-env-example` @ `89895dd`
  - Adds `NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` placeholder for local-dev forcing.
- `xynes/xynes-infra` → `docs/STORAGE-LIVE-5-plan-status` @ `89a1c1b`
  - Plan §8 status block flipped to ✅ Landed.

## Acceptance gates (rollout plan §8)

| Gate | Status | Evidence |
|---|---|---|
| Feature flag `cms_editor_storage_uploads` available with default `off` | ✅ | `DEFAULT_FLAGS` in `xynes/xynes-gateway/src/featureFlags/types.ts` + `DEFAULT_FEATURE_FLAGS` in `xynes-front-end/xynes-auth-sdk/src/types/feature-flags.ts` — both `false`. |
| Code path reads flag and gates upload affordance | ✅ | `CmsEditorScreen.tsx` calls `useFeatureFlag("cms_editor_storage_uploads")` (from `@xynes/auth-sdk`); derives gated `storageMedia` memo. |
| Flag OFF silently hides upload affordance | ✅ | Lumia DS `mediaConfig?.uploadAdapter` short-circuit handles silent-hide across slash-menu / drag-drop / paste / toolbars / block-component file inputs. `mockLumiaEditor` test asserts `media.uploadAdapter === undefined` when flag OFF. |
| Flag ON wires STORAGE-11 path end-to-end | ✅ | `mockLumiaEditor` test asserts `media.uploadAdapter !== undefined` when `mockUseFeatureFlag.mockReturnValue(true)`. |
| Default `off`, no `*: on` wildcard | ✅ | Both `DEFAULT_FLAGS` constants ship `cms_editor_storage_uploads: false`. PostHog admin UI enforces per-workspace overrides (no `*: on` mechanism in code). |
| Read-path graceful degradation | ✅ | `resolveDownloadUrl` stays wired regardless of flag — existing image-block nodes with `objectId` continue to render via gateway `download-url` action. Test asserts `media.resolveDownloadUrl !== undefined` in both flag states. |

## Quality gates

### Gateway (`xynes/xynes-gateway`)

| Gate | Baseline | After STORAGE-LIVE-5 |
|---|---|---|
| `bun run lint` | exit 0 | exit 0 |
| `bun run test` | 620 / 0 fail | **620 / 0 fail** (existing `expected-keys` test gained the new flag key) |
| Files changed | — | 2 (`featureFlags/types.ts`, `featureFlags/service.test.ts`) |

### Auth SDK (`xynes-front-end/xynes-auth-sdk`)

| Gate | Baseline | After STORAGE-LIVE-5 |
|---|---|---|
| `pnpm lint` | exit 0 | exit 0 |
| `pnpm test` | 330 / 0 fail / 22 files | **330 / 0 fail / 22 files** (existing tests still pass; new flag is additive) |
| `pnpm build` | succeeds | succeeds (ESM 96.31 KB / CJS 98.37 KB / DTS 36.96 KB — unchanged sizes) |
| Files changed | — | 1 (`src/types/feature-flags.ts`) |

### CMS Console (`xynes-front-end/xynes-cms-console-web`)

| Gate | Baseline | After STORAGE-LIVE-5 |
|---|---|---|
| `pnpm lint` | exit 0 | exit 0 |
| `npx tsc --noEmit` error count | 12 | 12 (byte-identical) |
| `pnpm test` | 556 / 0 fail / 57 files | **573 / 0 fail / 59 files** (+17 net new: 5 `CmsEditorScreen` flag-gate, 7 `overrides`, 5 `CmsFeatureFlagsProvider` bridge) |
| `pnpm test:coverage` overall | 93.85% / 87.58% / 96.33% / 93.85% | **93.91% / 87.74% / 96.36% / 93.91%** |
| `pnpm build` | succeeds | succeeds |
| Files changed | — | 6 modified (`providers.{tsx,test.tsx}`, `CmsEditorScreen.{tsx,test.tsx}`, `docs/DEVELOPER.md`, evidence runbook) + 4 new (`src/lib/feature-flags/{CmsFeatureFlagsProvider.tsx, CmsFeatureFlagsProvider.test.tsx, overrides.ts, overrides.test.ts}`) |

**Per-touched-file coverage (CMS Console):**

| File | Stmts | Branches | Funcs | Lines |
|---|---|---|---|---|
| `src/lib/feature-flags/CmsFeatureFlagsProvider.tsx` | 100% | 100% | 100% | 100% |
| `src/lib/feature-flags/overrides.ts` | 100% | 100% | 100% | 100% |

All above the ADR-001 80% floor.

### Lumia DS (`xynes-front-end/lumia-ds`)

| Gate | Baseline | After STORAGE-LIVE-5 |
|---|---|---|
| `pnpm --filter @lumia-ui/editor lint` | exit 0 | exit 0 |
| `pnpm --filter @lumia-ui/editor test` | 1119 / 0 fail / 104 files | **1121 / 0 fail / 104 files** (+2 for `source` arg assertions) |
| `tsc --noEmit` error count | 146 | 146 (byte-identical) |
| `pnpm --filter @lumia-ui/editor build` | ESM 201.80 KB, DTS 15.10 KB | ESM 202.71 KB, DTS 16.01 KB |

The Lumia DS `source` arg on `MediaUploadCallbacks.onUploadStart` ships but is **currently unconsumed** in the CMS Console. It stays in the API surface for the eventual gateway-proxied telemetry story.

## Security invariants verified

1. **No `phc_*` key in the browser.** `pnpm view xynes-cms-console-web/package.json` → no `posthog-js` dependency. `pnpm-lock.yaml` unchanged from `main`.
2. **Default off enforced at both ends.** Gateway `DEFAULT_FLAGS.cms_editor_storage_uploads === false`. SDK `DEFAULT_FEATURE_FLAGS.cms_editor_storage_uploads === false`.
3. **No `*: on` wildcard.** PostHog admin UI is the operator's responsibility; code provides no mass-enable mechanism.
4. **Workspace-scoped flag evaluation.** Gateway `FeatureFlagService` evaluates with `groupProperties: { workspace: { workspaceId } }` (INFRA-BE-1 pattern). Per-workspace PostHog overrides apply automatically.
5. **JWT-authenticated `/flags` fetch.** SDK's `<FeatureFlagsProvider>` passes `Bearer ${accessToken}` from `useAuth().getAccessToken`. Unauthenticated requests get the public subset only (and `cms_editor_storage_uploads` is NOT in `PUBLIC_FLAG_KEYS`, so it stays `false` for anonymous).
6. **No client-side telemetry leak vector.** The gated `storageMedia` bridge does NOT carry a `callbacks` surface — defense in depth against accidental client-side analytics that could bypass STORAGE-9 redaction.

## Manual verification (Phase E — operator)

This story did NOT exercise the live PostHog flip path because that requires (a) the operator's PostHog admin UI access, (b) the dev gateway connected to a real `POSTHOG_API_KEY` server-side. The following remain for the operator to record evidence against:

### E.1 Flag-off (default — no override, no PostHog flip)

```bash
cd xynes-front-end/infra
# .env: leave NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE unset
./run.sh up:dev
```

Open CMS Console → editor → confirm slash-menu "Insert image" / drag-drop / paste-from-clipboard do NOT trigger upload (Lumia DS plugins short-circuit because `mediaConfig?.uploadAdapter` is undefined).

### E.2 Flag-on (env-var local override)

```bash
# Edit .env:
#   NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE={"cms_editor_storage_uploads":true}
./run.sh up:dev
```

Repeat the editor smoke. All three paths should upload end-to-end against R2 dev (re-using the STORAGE-LIVE-4 evidence path).

### E.3 Flag-on (PostHog admin override against the dev workspace)

```bash
# In PostHog admin → flag `cms_editor_storage_uploads` → set to ON for the dev workspace.
# Restart the CMS Console without the env-var override; reload editor.
```

Confirm upload affordance is enabled. Network tab: `GET ${API}/flags` response contains `flags.cms_editor_storage_uploads: true` (since the gateway evaluated PostHog with `workspace` group).

### E.4 Adblocker resilience

With an adblocker enabled that blocks `*.posthog.com`:
- `GET /flags` still succeeds (rides the first-party gateway domain).
- Flag value still applies correctly.

This is the architectural win over the previous client-side `posthog-js` design.

### E.5 Browser DOM banned-substring sweep

Same as STORAGE-LIVE-4 §5.1 / §5.2 — DevTools → Network → confirm `POST /content/entries` body does NOT contain `X-Amz-Signature` / `xynes_live_` / `AKIA` / `provider_kind` / `endpoint` / `region` / `bucket` (STORAGE-11 `stripTransientImageUrls` invariant; unrelated to STORAGE-LIVE-5 but worth re-running to confirm no regression).

## Files changed (final summary)

### Gateway (commit `4fd6fae`)

- `xynes/xynes-gateway/src/featureFlags/types.ts` — `+cms_editor_storage_uploads: false` in `DEFAULT_FLAGS`.
- `xynes/xynes-gateway/src/featureFlags/service.test.ts` — added the new key to the `expectedKeys` array.

### Auth SDK (commit `bf0fbec`)

- `xynes-front-end/xynes-auth-sdk/src/types/feature-flags.ts` — `+cms_editor_storage_uploads: boolean` in `FeatureFlags` interface + `+cms_editor_storage_uploads: false` in `DEFAULT_FEATURE_FLAGS`.

### Lumia DS (commit `e7b5c96`)

- 19 files (additive optional `source: 'file-picker' | 'drag-drop' | 'paste'` arg on `MediaUploadCallbacks.onUploadStart`; 17 call sites updated; 5 test files updated assertions; 2 new tests in `DragDropPastePlugin.test.tsx`).

### CMS Console (this branch)

- **NEW** `src/lib/feature-flags/CmsFeatureFlagsProvider.tsx` — bridge component that wires the SDK's `<FeatureFlagsProvider>` to `useAuth().getAccessToken`.
- **NEW** `src/lib/feature-flags/CmsFeatureFlagsProvider.test.tsx` — 5 tests.
- **NEW** `src/lib/feature-flags/overrides.ts` — `getCmsFeatureFlagOverrides()` JSON env-var parser.
- **NEW** `src/lib/feature-flags/overrides.test.ts` — 7 tests.
- `src/app/providers.tsx` — mount `<CmsFeatureFlagsProvider apiBaseUrl={...}>` inside `<AuthProvider>`, outside `<WorkspaceProvider>`.
- `src/app/providers.test.tsx` — mock the new bridge.
- `src/features/cms-content/CmsEditorScreen.tsx` — read `useFeatureFlag("cms_editor_storage_uploads")` from `@xynes/auth-sdk`; derive gated `storageMedia` memo.
- `src/features/cms-content/CmsEditorScreen.test.tsx` — +5 STORAGE-LIVE-5 flag-gate tests + hoisted `mockUseFeatureFlag` spy.
- `docs/DEVELOPER.md` — new "Feature Flags (STORAGE-LIVE-5)" section.
- `docs/storage-live-5-feature-flag-evidence-2026-05-27.md` — this runbook.

**NOT modified:** `src/lib/dashboard/use-storage-upload-adapter.{ts,test.ts}` — byte-identical to `main` (the earlier client-side telemetry design was reverted).

**Deleted (vs the earlier client-side draft):** entire `src/lib/posthog/` directory + `posthog-js` dependency.

### Infra (commit `89895dd`)

- `xynes-front-end/infra/.env.example` — `+NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE` placeholder (JSON-shaped local-dev override).

### xynes-infra (commit `89a1c1b`)

- `docs/plans/2026-05-14-storage-live-provider-rollout.md` — §8 status flipped to ✅ Landed.

### Workspace root (NOT tracked by git — workspace context file)

- `AGENTS.md` — STORAGE-LIVE-5 landed block.

## Out of scope (deferred follow-ups)

1. **Per-user upload telemetry.** Removed in the gateway-architecture migration. If a future story wants it, route through the gateway's existing telemetry pipeline (server-side audit log via the proxy) — NOT client-side PostHog.
2. **Server-side flag evaluation via `posthog-node` for CMS Console RSCs.** The editor is a `"use client"` boundary; no RSC needs the flag at MVP. Future RSCs should hit the gateway `/flags/:key` endpoint via a thin server helper.
3. **The `source` arg on `MediaUploadCallbacks.onUploadStart`** (Lumia DS) is currently unconsumed. Kept in the API surface for the eventual gateway-proxied telemetry story.
4. **Live PostHog evaluation evidence.** Operator must follow Phase E.1-E.3 against the dev stack with a real PostHog `POSTHOG_API_KEY` configured server-side on the gateway.
