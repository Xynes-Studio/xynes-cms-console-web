# CMS API access panel — bugs, design audit and implementation handoff

Date: 2026-10-09 (Asia/Kolkata). Scope: the reusable “Use via API” panel and its copied REST requests. This records the 2026-10-09 investigation and implementation brief. That audit changed no application code, database data, routes, permissions, credentials, containers or PostHog configuration. The owner subsequently authorized coordinated draft PRs and this committed handoff; the findings below remain unresolved.

## Review and release status

The existing CMS/Lumia epic is submitted for review as coordinated **draft PRs against develop**. It implements the reusable panel and overlay foundation; it does not implement the new theme/design remediation in this handoff. The unresolved API deployment/access findings and manual acceptance boundaries prohibit a claim that the entire integration is working. Keep the PostHog rollout conservative until readiness is proven.

Companion: [Lumia PR #237](https://github.com/Xynes-Studio/lumia-ds/pull/237), targeting `develop`, pinned commit `e5c1067995a4b8a99df57e68a8a8421a1b7f676b`.

Merge/release coordination: review Lumia first, retain its immutable pinned revision in all three CMS workflows/provenance, then review CMS. If Lumia code changes, rebuild locally and update those pins to the new reviewed commit before CMS CI. No package publication is needed for the existing local link workflow. Neither PR is authorization to merge or deploy.

## Findings that explain the reported failures

1. **The local gateway has no delivery routes.** Both supplied endpoint shapes return HTTP 404 with `error.code: NOT_FOUND` and `message: Not Found`, including without credentials. A read-only query of `platform.routes` returns zero rows matching either delivery paths or delivery action keys. The database has 50 enabled routes overall. Gateway health reports both database and route-table checks OK: that health check does not prove these particular endpoints are installed.
2. **The supplied key lacks both delivery scopes.** A read-only metadata query, selecting only status and permission booleans, finds an active key with neither `cms.delivery.listByDirectory` nor `cms.delivery.getById`. After routing is fixed, that key is expected to fail scope enforcement with 403; this is inferred from the gateway code, not a credentialed request performed in this audit. Existing keys must not silently gain permissions. Issue a replacement `cms_readonly` key through Workspace Admin after confirming the deployed preset, and revoke the exposed key.
3. **The supplied detail entry is a draft.** Entry `6df64a41-2c63-4338-8096-f24160c4ba38` belongs to the supplied workspace, has status `draft`, no publication time and no published snapshot. Its detail request should remain unavailable after route/access repair until it is explicitly published. The expected content-level failure is `ENTRY_NOT_FOUND`, “Published content unavailable”, HTTP 404. Do not make draft bodies public to “fix” this.
4. **The supplied folder exists, but has no metadata-qualified published candidates.** Directory `d217b0da-4e59-425e-9f6a-4923328fdf1f` belongs to workspace `64e5216c-b778-48cd-b285-cea4de004157`. The published/nondeleted/snapshot-digest predicate yields zero candidates in its published folder scope. With routing and authorization working, an empty successful feed is expected for this current data, rather than a route-level 404. No snapshot bodies were read.
5. **There is no evidence of IP blocking behind these 404s.** The local request reaches the gateway and its unmatched-route response. A focused source search found no IP allow/deny rules causing this path. IP-based rate limiting exists, but its rejection is HTTP 429 `RATE_LIMIT_EXCEEDED`. Do not disable rate limiting, JWT/key authentication, scope checks or workspace isolation. This finding is limited to the inspected localhost runtime, not every hosted proxy/firewall.

The raw key pasted in chat is deliberately absent from this report, screenshots and evidence files. It was not used in an HTTP probe. Only a prefix was used privately to locate its metadata, without reading its hash or raw value. Revocation/replacement remains an owner action; this audit did not alter credentials.

## Bug and improvement register

| ID | Priority / status | Evidence and cause | Required update / acceptance |
| --- | --- | --- | --- |
| API-01 | P1, confirmed deployment gap | Both delivery paths yield generic gateway `NOT_FOUND`; no matching DB rows. The current infra checkout is an older archive-security feature branch. The additive route migration already exists in cached `origin/develop` and the discovery worktree. | Apply the existing forward-only migration through the approved local migration workflow, then reload/restart the gateway safely. Verify exactly the two private, workspace-scoped CMS delivery routes and their canonical action keys. No DB reset or broad seed replay. |
| API-02 | P1, confirmed access gap | Supplied active key has neither delivery permission. Current accounts source does include both in the new `cms_readonly` preset. | Newly issued read-only key succeeds; old key remains denied. Never backfill privileges onto existing keys. Revoke the exposed key and create its replacement through Workspace Admin. No credentials in fixtures/logs/report. |
| API-03 | Expected behavior, not a defect | Supplied entry is draft, no snapshot. Folder has zero metadata-qualified published candidates. | Detail draft stays 404 `ENTRY_NOT_FOUND`; folder succeeds with empty `items` and valid pagination when authorized. Prove 200 detail separately with an owned published fixture. Never publish existing content merely to make a smoke test green. |
| API-04 | P2, usage/documentation gap | `${a_raw_key}` means “expand an environment variable whose name is the key”; it does not insert that key. An unset variable sends an empty Bearer credential. `curl --fail` also hides the JSON distinction between route/content errors. | Explain `${XYNES_API_KEY}` as a named shell variable, versus substituting a literal value at execution. Never recommend embedding real keys in source or shell history. Troubleshooting shows redacted JSON error codes, not status alone. Use plain URLs without Markdown link syntax. |
| UI-01 | P2, user-reported and source-confirmed | Copy/check Icon defaults to `text-foreground`; Button text is white on `#0f172a`. Light CSS fallback foreground is `#171717`, giving approximately **1.004:1** icon/background contrast. The label itself has about **17.85:1**. | Make Copy AND Copied icons inherit the button color explicitly, e.g. the existing Icon API's `color="currentColor"`. Test both states, both themes, hover/focus and pending. Do not globally change Icon defaults just for this consumer. |
| UI-02 | P2, live-confirmed dark defect | `bg-warning/20` has no warning token in CMS globals. Live `<mark>` background is browser-default `rgb(255,255,0)`, with `rgb(237,237,237)` text: **1.09:1**. Both code and helper placeholders are affected. | Define a real semantic highlight surface/text pair, or use an existing appropriate token. Verify generated CSS and computed colors; no UA-yellow fallback. Preserve exact request bytes and text-only rendering. |
| UI-03 | P2, live-confirmed dark defect | Status Alert uses pale blue surfaces. Its icon resolves to `#ededed` despite intended variant color classes; light foreground on blue-100 is about **1.04:1** using the source color. Alert passes both default `text-foreground` and a competing text class to Icon. | Repair explicit semantic icon color ownership in Lumia Alert, cover all four variants, and give alerts theme-aware surfaces/text. Do not depend on class-string order to resolve conflicting Tailwind text colors. Regression-check other Alert consumers. |
| UI-04 | P2, live-confirmed theme/hierarchy weakness | In dark mode, helper and muted text compute to the same `#ededed` as primary text. Borders remain light `#e2e8f0`; muted background falls back to panel background. Only background/foreground get dark fallbacks. | Complete semantic light/dark token pairs using the established Lumia theme contract. Distinguish canvas, request surface, dividers, primary/secondary text and focus states. Fix shared ownership once; avoid panel-only hardcoded color patches. |
| UX-01 | P2, visual audit | Broad pale status banner dominates dark panel; key setup occupies substantial space before the primary task; title, instructions, helper and controls lack a strong hierarchy. | Use compact status + concise meaning, a clearly subordinate key prerequisite, a visually dominant request card, and quieter advanced options/preview. Keep workspace and folder/entry context visible. Avoid a stack of equally emphasized cards. |
| UX-02 | P2, visual audit | Absolute Copy reserves `pr-20` throughout the pre, narrowing every line. `break-all` and 12px code make a long URL look like an unstructured block. | Put Copy in a request-card toolbar alongside the format selector, with code using available width beneath. Use an intentional type/spacing scale, readable code size/line height and tested wrapping. Keep the current three formats. Update geometry tests to match the revised design, retaining focus, copy-byte and responsive guarantees. |
| UX-03 | P2, guidance ambiguity | The status says publishing “starts working”, although content metadata cannot prove route deployment or key scope. Helper says “replace with your key”, which encouraged incorrect shell interpolation. | State the publication rule clearly without promising endpoint readiness. Give one short shell-variable setup example in progressive help. Explain URL-only requests still need authentication; JavaScript example is server-side. No key entry/storage form in CMS. |
| QA-01 | P1, validation gap | Earlier browser coverage checks dark native links, geometry and clipboard behavior, but not light Copy icon, all alert icons or placeholder colors. Previous exact copied-request backend proof used an isolated harness; the current local registry is missing routes. | Add both-theme component/real-browser computed-style checks plus screenshot review and a dedicated current-environment route/scope smoke. A healthy gateway, mocked response or passing isolated harness is not evidence this deployment works. |

## Sources and reproduction

Independent repository roots:

- CMS: `/Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web` — branch `feature/CMS-INT-api-access-panel-epic`, HEAD `da0e915` at audit start.
- Lumia: `/Users/archanray/xynes-erp/xynes-front-end/lumia-ds` — existing companion epic branch; preserve its work.
- Infra: `/Users/archanray/xynes-erp/xynes/xynes-infra` — branch `feature/XYN-SEC-002-archive-inspection`, HEAD `ce8515c`; dirty smoke scripts/tests are unrelated and must be preserved. Cached `origin/develop` is `a6d1fe4`, contains the delivery route migration.
- Gateway: `/Users/archanray/xynes-erp/xynes/xynes-gateway` — develop `866a3c4`, clean.
- CMS core: `/Users/archanray/xynes-erp/xynes/xynes-cms-core` — detached `314d84e`, clean. Docker bind mount uses this checkout.
- Accounts: `/Users/archanray/xynes-erp/xynes/xynes-accounts-service` — develop `650239b`, clean; current source has the new read-only scopes.
- Platform config: current develop checkout is behind cached origin by five commits; inspect latest base in a clean checkout before running a seeder. These cached refs were inspected without fetching or switching any branch.

Relevant code:

- `src/features/content-integrations/RequestStep.tsx` (CMS): placeholder styling line20, code block/Copy placement, Icon line146. `ApiAccessSheet.tsx`, `ApiStatusLine.tsx`, `RequestOptions.tsx`, `EditorApiCard.tsx`: reusable panel composition.
- `app/globals.css` (CMS): lines23–33 semantic fallbacks, lines48–52 dark overrides. No `--color-warning` definition.
- `packages/icons/src/icon/Icon.tsx` and `colorUtils.ts` (Lumia): default `text-foreground`; custom `currentColor` is already supported.
- `packages/components/src/button/button.tsx` (Lumia): primary label uses `--color-on-primary`, white fallback.
- `packages/components/src/alert/alert.tsx` (Lumia): fixed pale surfaces, competing variant icon text classes.
- `src/router/dynamicRouter.ts` (gateway): terminal unmatched-route `NOT_FOUND` branch; `src/middleware/rateLimit.ts`: 429, not 404, for rate-limit denial.
- `src/actions/handlers/content-delivery.handler.ts` (CMS core): detail unavailable -> `ENTRY_NOT_FOUND` 404; list returns items/page, including empty success.
- Existing migration: `/Users/archanray/xynes-erp/.worktrees/cms-content-integrations-discovery/supabase/migrations/20261005090000_seed_cms_delivery_routes.sql`. Read from a fresh merged develop before applying; do not create duplicate migration SQL. It registers both GET paths with `is_public=false`, `workspace_scoped=true`, `enabled=true`, target `/internal/cms-actions`, service `cms-core`.
- Existing isolated proof and recovery guidance: `/Users/archanray/xynes-erp/.worktrees/cms-content-integrations-discovery/docs/verification/2026-10-01-cms-content-integrations-api.md`.

Read-only local probes performed:

```sh
curl --silent --show-error --include 'http://localhost:4100/workspaces/64e5216c-b778-48cd-b285-cea4de004157/delivery/entries?directoryId=d217b0da-4e59-425e-9f6a-4923328fdf1f&limit=20'
curl --silent --show-error --include 'http://localhost:4100/workspaces/64e5216c-b778-48cd-b285-cea4de004157/delivery/entries/6df64a41-2c63-4338-8096-f24160c4ba38?fields=id%2Ctitle%2Cbody'
```

Both return the generic gateway 404. Route SQL was run inside `BEGIN READ ONLY`:

```sql
SELECT method, path_pattern, action_key, enabled
FROM platform.routes
WHERE path_pattern LIKE '%delivery%' OR action_key LIKE 'cms.delivery%';
-- 0 rows
```

Docker inventory: frontend apps, gateway, CMS core, accounts, authz, doc, telemetry, storage, Supabase and ClamAV containers are up. Actual health probes returned HTTP200 for gateway, CMS core, accounts and authz. Accounts reports its optional authz health probe as `skipped`, not `ok`. Other services were inventoried, not individually smoke-tested here. Container liveness does not imply functional delivery readiness.

Evidence in this directory:

- `live-dark-panel-600.jpg` — actual panel at 600×777, no sidebar/email or real key. Shows pale status banner/icon and unreadable yellow placeholders.
- `live-dark-metrics.json` — computed panel, icon, mark, helper and typography values.
- `contrast-ratios.json` — calculated ratios; light icon ratio is explicitly **code-derived**, not a live light screenshot. Alert ratio uses the source blue-100 hex approximation; actual browser computes modern Lab colors.
- `light-attempt-still-dark-metrics.json` — native appearance was temporarily switched from Auto to Light, but IAB continued reporting dark media, even after reload. Original Auto appearance was restored. The unchanged screenshot was discarded; do not present it as light-mode proof.

No real light screenshot, hover/focus theme matrix, native 200% zoom or screen-reader audio proof is claimed in this audit. Previous epic manual zoom/audio acceptance also remains outstanding. No automated code tests were rerun during the audit itself. The subsequent PR-creation pass reran existing CMS/Lumia checks and the 20 browser cases; see the fresh verification appendix in `CMS-API-ACCESS-PANEL.md`. Passing those existing tests does not resolve the newly identified defects.

## Design direction and skills

Use a restrained developer utility within the existing CMS/Lumia visual language: clear context, a primary request surface, short prerequisites, subordinate customization, and honest publication guidance. Improve hierarchy and task completion, not merely WCAG scores. Keep current fonts, established icon family, localization and shared components; do not install new fonts, animation libraries, icon packs or theme dependencies to satisfy generic skill suggestions.

Installed skills reviewed:

| Skill / source | Use for the follow-up |
| --- | --- |
| [redesign-existing-projects](/Users/archanray/.agents/skills/redesign-existing-projects/SKILL.md) | Scan existing composition, diagnose hierarchy, surfaces, spacing, states, then target improvements in the current stack. Reject irrelevant marketing-page effects and global font swaps. |
| [ui-ux-pro-max](/Users/archanray/.agents/skills/ui-ux-pro-max/SKILL.md) | Color/typography/layout/interaction checklist; test both themes and readable responsive controls. Its advertised `scripts/search.py` is missing in this installation, so no generated design-system result is claimed. Use the available guidelines; no installation was performed. |
| [frontend-design](/Users/archanray/.codex/skills/frontend-design/SKILL.md) | Intentional visual direction, primary/secondary hierarchy and precise spatial composition. Apply to this compact utility, not a marketing redesign. |
| [test-driven-development](/Users/archanray/.codex/skills/test-driven-development/SKILL.md) and [verification-before-completion](/Users/archanray/.codex/skills/verification-before-completion/SKILL.md) | Required implementation workflow: reproduce defects first and verify actual results before claiming completion. |

External benchmarks: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) supports 4.5:1 for normal text; [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) supports 3:1 for required visual cues/states. These are minimum checks, not a definition of good design. A redundant icon with a readable text label is not automatically a WCAG failure; it is still a confirmed visual defect worth fixing. The [skills directory](https://www.skills.sh/) was checked, but no unverified external package was installed or recommended over the existing skills.

Proposed panel hierarchy:

1. Fixed header: “Use via API”, target title/path, workspace; obvious Close.
2. Compact publication status with one sentence about published-version behavior.
3. Short read-only key prerequisite with existing native Workspace Admin link; experienced users can scan past it.
4. Request card: format selector and visible labeled Copy in a toolbar; full-width readable code beneath; short environment-variable helper and copy outcome.
5. Request summary + “Adjust” disclosure, then static example response; roadmap remains quiet text.

Improve normal, hover, focus, selected, pending, copied, manual-copy, invalid-options and unavailable states together. Reserve space for feedback. Use differentiated surfaces and spacing rather than arbitrary gradients/shadows. Mobile should feel deliberately composed, with ample touch targets and one understandable main scroller. Keep all functionality accessible without hover.

## Ready-to-use prompt for the implementation agent

> Work in `/Users/archanray/xynes-erp`, a meta-folder of independent repositories. Pursue the goal of making the reusable CMS “Use via API” panel visually clear in light/dark modes and making its copied requests work against the intended local deployment, while preserving publication and authorization safety. Read this entire findings file, root/repository instructions, the prior API panel runbook/SPEC and current validation report before editing. Reconcile the proposed request toolbar with older Copy-overlay assertions; preserve the owner's Copy-within-four-Tabs requirement and Close-after-content order. This report is the new improvement brief, not permission to remove existing guards.
>
> First inspect current branch/worktrees, dirty files, actual Docker source mounts and latest develop. Preserve all existing work. Use appropriate feature branches/managed worktrees; do not switch or reset dirty checkouts. Separate Lumia component/theme ownership from CMS composition and infra deployment repair. Do not refactor unrelated repositories. No new dependency installation or automatic privilege expansion. Do not commit, push, publish, deploy to hosted environments or create PRs without current-chat authorization.
>
> Start with failing tests for UI-01, UI-02 and UI-03. Fix icon inheritance through explicit semantic colors; verify both Copy and Copied. Fix placeholder/background token resolution and theme-consistent Alert styles in the proper owner. Test all affected shared variants/consumers. Then implement the restrained hierarchy above: compact context/status, concise key prerequisite, primary request toolbar/card, readable code, quiet options/preview and complete interaction states. Keep the request engine, contract, authentication placeholder, exact copy serialization/race protections, workspace/target reset guards, offline request generation, safe text rendering, feature flag and localization intact. No CMS key lifecycle forms. Do not add unsupported draft-reading controls.
>
> Address API-01 using the already merged additive route migration from fresh develop, not a duplicate seed or database reset. Before applying it, follow the current migration/auth instructions and obtain any required approval for this local environment. Verify CMS snapshot schema/handlers and new-key preset readiness; preserve per-service signing/trust mounts when restarting the gateway. Do not disable rate limiting or security to fix 404s. Ask the owner to revoke the exposed key and create a fresh read-only replacement. Never embed its raw value in source, process arguments, transcripts or reports; use the existing secret-safe fixture/harness pattern. Do not expand old key scopes.
>
> Prove both operations with exact generated URL/query/header structure and harmless owned published fixtures: successful list/detail, empty folder, draft detail 404 with `ENTRY_NOT_FOUND`, missing auth 401, old/wrong scope 403, revoked/expired/cross-workspace denial, projection and published-version retention. Execute fixture mutations only in an isolated database or expressly owned disposable environment; never publish, unpublish or delete existing user content. Current data's draft detail 404 and empty folder are not release failures when semantics are correct. Record generic route `NOT_FOUND` separately from content unavailability. Health-only success is insufficient.
>
> Run relevant tests, lint, typecheck/build, deployment/route contract validation, configured coverage gates and per-file evidence for changed production code. Browser proof must include real light and dark modes, 320/375/768/1280 widths, long titles and pseudo-locale, all publication/error states, normal/selected/focus/copied/manual-copy/pending behavior, complete clipboard bytes and focus restoration for all four hosts. Add computed-style contrast assertions for icons, placeholder marks, alerts, text, control states and necessary boundaries; verify actual compiled CSS, not class-name strings alone. Save labeled light/dark screenshots and visually review hierarchy. Prove native 200% zoom and screen-reader audio manually if automation cannot do them; never relabel CSS reflow/ARIA semantics as those checks. Disclose blockers honestly.
>
> Deliver an implementation/validation report mapping every API/UI/UX/QA finding to its fix, test and current-environment evidence; list remaining deployment limits and exact recovery steps. Do not mark the goal complete merely because unit tests or coverage pass.

## Completion checklist for the follow-up

- [ ] API-01: two intended route rows installed; gateway reload proven; unrelated routes/data intact.
- [ ] API-02: newly issued safe read-only credential authorized; legacy key still denied; exposed key revoked by owner.
- [ ] API-03: owned published fixture 200, empty feed200, supplied draft intentionally unavailable.
- [ ] API-04 / UX-03: shell-variable instructions unambiguous, error-code diagnosis available without leaking credentials.
- [ ] UI-01–04: light/dark semantic colors, Copy/check, highlights and all Alert variants visibly correct with computed-style proof.
- [ ] UX-01–02: primary request task visually clear; readable code and restrained hierarchy reviewed at desktop/mobile.
- [ ] QA-01: configured gates/per-file coverage, real-browser themes and current-deployment API smoke all evidenced.
- [ ] Native zoom/audio acceptance completed or an explicit owner scope decision recorded.
- [ ] No unrelated edits, data destruction, public draft exposure, permission weakening, raw credential artifacts or unapproved publication.
