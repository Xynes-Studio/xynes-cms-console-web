# API access panel implementation plan

> Execute task-by-task using the supplied API access panel runbook and TDD. The
> owner's single-epic instruction replaces its separate PR/merge checkpoints.

**Goal:** deliver the complete Use via API sheet, all contextual hosts, and the
shared Lumia layering correction without changing delivery or authoring contracts.

**Architecture:** keep the existing request engine and scope/focus orchestration.
Small feature-owned status, request, options, summary, sheet, and editor-card
components share one controller. Lumia owns overlay stacking and primitives; CMS
owns presentation, locale copy, scoped in-memory preferences, and deep links.

**Tech stack:** React/TypeScript, Next.js App Router, next-intl, Lumia/Radix, pnpm,
Vitest/RTL, existing Playwright fixtures and read-only real-browser acceptance.

## 1. Preconditions and preservation

- Confirm merged PostHog work and fast-forward develop locally: complete.
- Branch both frontend repos as `feature/CMS-INT-api-access-panel-epic`: complete.
- Preserve unrelated CMS files, immutable delivery source/security tests, and
  live account/content data; fingerprint before changes and compare at completion.
- Baselines: Lumia components 317 tests / 66 files, coverage 95.72% lines,
  86.26% branches; CMS 1,056 tests / 86 files, lint/typecheck clean.
- Use no package installation/new dependency, backend edit, contract generation,
  new flag, app-local stacking override, or real-content mutation.

## 2. Lumia overlay foundation

Files in `lumia-ds/packages/components/src`: `lib/overlay-layers.ts`, Sheet,
Drawer, Dialog and their regression tests. Add a patch changeset per CONTRIBUTING.

1. Assert Sheet overlay/content and Drawer wrapper above a z-50 sibling; verify
   a nested Dialog is later in portal order and retains its current content layer.
2. Run the new tests RED with the existing implementation.
3. Extract shared z-[200]/z-[210] classes and apply them without changing Dialog
   appearance. Keep focus/escape, mounted transitions and reduced-motion behavior.
4. Verify localized Sheet close labeling using the existing Dialog convention
   if a backward-compatible Sheet prop is needed; no app-local replacement.
5. Run focused tests, package tests, full monorepo tests, lint, type-check,
   relevant builds and coverage. Verify actual editor and Auth overlays later.

## 3. CMS slices (in runbook order)

Each slice adds/rewrites its behavior tests first, runs RED, implements, and runs
GREEN. Preserve unchanged `build-request`, `snippets`, `delivery-contract`,
`generator`, and `host-context` tests.

1. **Copy:** replace en-US deck from SPEC §12; retain required errors/bounds/fields
   and host metadata keys without forbidden product copy. Generate en-XA using
   shared pseudoLocalizeMessage; metadata/ICU/catalog parity and forbidden-word tests.
2. **Status:** `ApiStatusLine.tsx` and state matrix tests. Fixed folder copy/no count;
   preserve availability rules, apply correct Alert/icon/copy, announce on mount only.
3. **Request:** `RequestStep.tsx` replaces clipped textareas/table. SegmentedControl,
   escaped wrapping pre/code, placeholder mark, primary Copy, 2-second feedback,
   manual selection/focus, invalid-field alert/action, URL header guidance.
4. **Options:** `RequestOptions.tsx` and pure `request-summary.ts`. Accordion,
   combined four-way sort, contract-backed bounds/validation, static ID copy,
   pagination/search, focus recovery, transient 1.2-second parameter highlight.
5. **Sheet/controller:** `ApiAccessSheet.tsx`, responsive breakpoint helper,
   ordered steps, key deep link, conditional publish guidance, collapsed static
   response, non-interactive roadmap. Title focus, desktop-only overlay dismiss,
   host restoreFocus and scoped session-memory options/format; no tabs. Preserve
   clipboard generation/revision and cross-host serialization protections.
6. **Hosts:** toolbar resolves/skeleton/root absence; list/grid code-icon actions,
   safe last menu item/separator and target rings. `EditorApiCard`, desktop API tab,
   direct mobile API header action. Apply `?panel=api` only after load and remove
   only that param; keep autosave/canvas/dirty guards and publish behavior intact.
7. **Removal:** delete superseded presentation files only when imports are gone;
   update exports and revise old UI tests instead of losing security/interaction proof.

## 4. Full verification and evidence

- CMS lint, typecheck, full tests, coverage (85% all global metrics; new files ≥80%),
  production build with current linked artifacts; no thresholds/timeout weakening.
- Lumia full tests, lint, type-check, coverage and relevant package builds.
- Run all three specified fixture browser suites; add true editor stacking checks,
  keyboard/title/copy focus, deep links, errors, state matrix, session memory,
  responsive layout, reduced motion and 200% zoom evidence.
- Read-only live Phase 3 walkthrough at 1280×800, 768×1024, 375×812 plus 721px and
  320px acceptance. Record each numbered requirement/row separately; screenshot
  the main content only to exclude sidebar email. Do not publish even to prove 5a;
  prove publication refresh with fixture/unit behavior and disclose that boundary.
- Do not run the provisioned B5 backend/database transport matrix unless asked.
- Update DEVELOPER, README, AGENTS where relevant and `CMS-API-ACCESS-PANEL.md` with
  exact outcomes, counts, per-file coverage, branch/commit manifest and limitations.

## 5. Epic delivery

Audit all SPEC §11 and runbook definition-of-done items against authoritative
evidence, including immutable-file hashes and unrelated-work preservation.
Only after full suites are green, create normal signed commits with hooks,
push both coordinated epic branches, and pin the exact reviewed Lumia commit in
CMS workflow/provenance definitions. Do not create incremental PRs or merge remotely.
Keep the epic active until the complete requested state is implemented and verified.

Working journals: workspace `artifacts/cms-content-integrations-ux-review-2026-10-08/impl-work/`;
original specification/runbook/review remain unmodified.
