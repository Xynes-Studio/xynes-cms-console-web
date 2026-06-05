## Summary
<!-- One-paragraph description of what this PR does and why. -->

## Linked work
- Plan / issue: <!-- link -->
- Related repos: <!-- link any PRs that depend on or are depended on by this one -->

## Quality gates
- [ ] `lint` passes locally
- [ ] `test` passes locally
- [ ] Coverage ≥ ADR-001 80% floor (or justified exception below)
- [ ] `typecheck` / `build` passes (where applicable)
- [ ] Docs updated (`README.md`, `DEVELOPER.md`, `AGENTS.md`, repo memory)
- [ ] Migration added (if schema change) — forward-only, expand/contract
- [ ] QA PII scrub updated (if migration adds PII)
- [ ] Release doc set updated (if release contract changed)

## Security
- [ ] No secrets in code, logs, error messages, or test fixtures
- [ ] No raw API keys forwarded to downstream services
- [ ] No PII added to telemetry or access logs

## Deployment notes
<!-- e.g. "Requires migration run before service rollout", "Requires xynes-platform-contracts vX.Y.Z first". -->

## Rollback plan
<!-- For risky changes only. -->

---

## Repo-specific items (xynes-cms-console-web)

This is the **Next.js CMS dashboard + content editor**. Runs on host port `3000`. Use `pnpm`, never `npm`.

- [ ] Lint: `pnpm lint` (eslint via the FE infra env loader)
- [ ] Tests: `pnpm test` (vitest run via the FE infra env loader)
- [ ] Coverage: `pnpm test:coverage` — overall must stay at or above the **ADR-001 80% lines + branches floor**
- [ ] Typecheck: `pnpm typecheck` (= `tsc --noEmit`)
- [ ] Build: `pnpm build` — Next.js production build MUST succeed cleanly
- [ ] **E2E (when touching editor / upload flows):** `pnpm test:e2e` (Playwright). Manual smoke recordings are accepted for sprint plans that defer E2E authoring.
- [ ] **Lumia DS link-deps refresh.** When `lumia-ds` or `xynes-auth-sdk` is updated upstream, run `pnpm install` to refresh the linked dist BEFORE re-running tests / build. This repo links `@lumia-ui/components`, `@lumia-ui/editor`, `@lumia-ui/icons`, `@lumia-ui/layout`, `@lumia-ui/marketing` from the sibling `lumia-ds` repo.
- [ ] **Directory-first CMS contract (2026-03-02 baseline, AGENTS.md "CMS directory-first contract").** Dashboard create/update/list flows MUST NOT require `contentTypeId`. The primary authoring contract is `cms.entry.*`; `routeSegment` / `contentTypeId` (`cms.content.*`, `cms.blog_entry.*`) are legacy compatibility for public/template-style reads. PRs that re-introduce content-type-first behaviour to dashboard routes are rejected — update docs first if they suggest otherwise.
- [ ] **CMS is a contextual consumer of Workspace Admin** (Workspace Admin integrations epic 2026-04-24). This app MUST NOT host verified-domain, API-key lifecycle, or future webhook lifecycle forms. Reuse verified domains for CMS publishing/delivery via deep links to the auth dashboard; provide CMS-specific helper views (presets, docs, status badges) only.
- [ ] **Feature-flag gating contract (STORAGE-LIVE-5 + BUG-CMS-5).** Flag-gated affordances MUST follow the gateway-architecture pattern: `<CmsFeatureFlagsProvider>` mounts inside `<WorkspaceProvider>` (NOT outside) so `useWorkspace()` resolves; it forwards `currentWorkspace?.id` to `@xynes/auth-sdk`'s `<FeatureFlagsProvider workspaceId={...}>`. **NO `posthog-js` in the browser; NO `phc_*` key in any FE bundle.** Plugins (`InsertFilePlugin`, `DragDropPastePlugin`, every `*ToolbarButton` / `*BlockComponent`) short-circuit on `mediaConfig?.uploadAdapter` truthy.
- [ ] **Editor body persistence rules (STORAGE-10 / STORAGE-11 / STORAGE-LIVE-4).** Image-block / file-block nodes carry `objectId` only — `stripTransientImageUrls(body)` runs in `saveDraftFn` before `updateWorkspaceContentEntry`, clearing `src` on any node with an `objectId`. Signed delivery URLs MUST NEVER persist in the entry body. Fresh URLs are re-minted on mount via `resolveDownloadUrl(objectId)`. Memo identity stability for the `media` prop is mandatory (BUG-LDS-1 / STORAGE-LIVE-4 render-loop fix).
- [ ] **Dashboard shell parity (AGENTS.md §7 rule 9 + BUG-CMS-9).** Any layout / shell-internals fix MUST land in `lumia-ds` first; app-level CSS overrides of `DashboardShell` internals (sidebar trigger, nav active selectors, scroll containment) are FORBIDDEN. The CMS Console's `CmsDashboardShell` is a thin wrapper around the Lumia DS primitive — keep it thin.
- [ ] **Closed-set API-key actor surface (CMS-API-KEY-ACTOR-1).** When persisting content from an api_key actor, `created_by` / `updated_by` flow through as NULL (CMS Core enforces this server-side via `getOptionalUserId(ctx)`). FE display MUST show "Created via API key" without leaking the key id / prefix into user-visible copy.
- [ ] **No raw credentials anywhere.** No `xynes_live_*` / `AKIA*` / `re_*` / `phc_*` / Supabase service-role JWT in any source, test fixture, story, or `.env*`. STORAGE-10's `storage-client.ts` documented-keys-only allowlist + the gateway redaction are defense in depth, not the only line.
