# CMS-INT-B5 Browser Acceptance Implementation Plan

**Goal:** Prove that exact requests copied from the real folder/card/editor integration controls read only the expected published snapshots through production gateway/CMS code.

**Architecture:** Reuse the existing Lumia hosts and contract builder. A strictly opt-in, production-denied browser fixture supplies harmless owned resource context; an owned loopback service harness runs the merged CMS app, real gateway route/key repositories and actual accounts issuer against a new PostgreSQL cluster. Test-only owner authoring controls use actual CMS publication repositories and are documented separately from delivery auth. No shared stack/database resets, API/auth fallbacks, credentials in browser state or shell execution of snippets.

**Tech Stack:** Existing pnpm/Vitest/Playwright/Next.js frontend; Bun runtime for existing backend modules; Python stdlib and local PostgreSQL tooling for owned lifecycle. No new package dependencies.

## 1. Source and isolation baseline

- Confirm B4/companion merges, branch from CMS develop and preserve primary user changes.
- Read A5 fixture/runtime safety patterns and immutable backend source inputs.
- Create fresh owned PostgreSQL cluster and schema; retain evidence with secret-free source revisions.

## 2. Fixture policy and test runtime (TDD)

- Add failing tests for production/disabled/malformed/remote context denial and bounded authoring/execute controls.
- Add only the small typed fixture context/control boundary required by the acceptance tests.
- Provision actual routes, issuer-generated read-only/old/revoked/expired keys, signed internal identity, direct/child/sibling/foreign folders, drafts and legacy publications.
- Fail explicitly enabled missing prerequisites before DB writes; no optional success fallback.

## 3. Browser producer/consumer join (TDD)

- Add `e2e/cms-content-integrations.spec.ts` and opt-in live harness configuration.
- Capture actual clipboard content and visible code/URL; verify equality and execute the captured structure, never regenerate or shell-evaluate it.
- Cover folder/list/grid/editor parity, fields/sort/search/empty/direct scope/read-only auth and key recovery links.
- Edit A to B in actual editor, save B, read A, republish, read B; include draft title/folder moves, archive/unpublish and legacy republish.
- Keep existing mobile/focus/pseudo/copy-denial/script/SDK/autosave/storage regressions in the full browser gate.

## 4. Verification and evidence

- Run narrow tests/browser flows first, then lint/typecheck/build/full configured coverage and complete browser suite with fixture-only env.
- Record actual per-file coverage, HTTP/publication assertions and browser screenshots in `docs/manual-verification/CMS-CONTENT-INTEGRATIONS.md`.
- Inspect production fixture denial and source/security/type debt; keep rollout disabled.
- Stop only owned resources and retain redacted evidence. No commit, push, merge, PR or deployment for this story.
