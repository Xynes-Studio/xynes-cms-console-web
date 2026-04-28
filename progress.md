# Progress — CMS Workspace Admin Contextual UI

## 2026-04-27 — Initial implementation

- Confirmed scope from
  `xynes/xynes-infra/docs/plans/2026-04-24-workspace-admin-integrations-cms-contextual-ui.md`
  and the Workspace Admin epic.
- Confirmed backend prerequisites: gateway healthy on `http://localhost:4100`;
  workspace integration routes seeded and live.
- Branch `feat/cms-workspace-admin-contextual-ui` confirmed checked out.
- TDD task 1 — `workspace-admin-links.ts`: 11 failing tests → implemented
  builder with `URL.origin` allowlist for `http(s)` and relative-path
  fallback for everything else → 11 pass.
- TDD task 2 — `workspace-integrations-client.ts`: 11 failing tests →
  implemented client reusing `gateway-client-utils`, fails closed on every
  error path, never returns raw key material → 11 pass.
- TDD task 3 — `CmsIntegrationsPanel.tsx`: 13 failing tests → implemented
  panel with Lumia DS primitives → 13 pass.
- TDD task 4 — replaced placeholder route → 2 pass.
- Initial pass: 37/37 task tests, 402/402 full repo, lint clean,
  coverage ≥ 92% lines on every new file.

## 2026-04-27 — Revalidation pass

- Re-read every new file against the user's revalidation checklist:
  segregation, redundancy, future tech debt, ADR-001 coverage, security,
  a11y, Lumia-DS conformance, lint.
- Issues found and fixed:
  1. **Redundancy:** `UNAVAILABLE_STATUS` was duplicated in the panel and
     the client. → Exported a single canonical
     `UNAVAILABLE_CMS_WORKSPACE_INTEGRATION_STATUS` from the client and
     `Object.freeze`d it; the panel imports it.
  2. **A11y / HTML validity:** the panel was rendering deep links as
     `<Button asChild={false}><a>...</a></Button>`. Lumia `Button` is a real
     `<button>` element with no `asChild` prop, so the `<a>` was nested
     inside `<button>` (invalid interactive nesting). → Replaced with a
     native `<a>` styled with Lumia's exported `buttonStyles`. Added a
     test that asserts `tagName === "A"` and `closest("button") === null`.
  3. **A11y "opens in new tab" parity:** external links had only a visible
     `↗` glyph. → Added a sr-only "(opens in new tab)" span; assertion
     uses `toHaveAccessibleName(/opens in new tab/i)`.
  4. **A11y test fidelity:** the Alert mock returned `role="status"`, but
     real Lumia maps `variant="warning"` → `role="alert"`. → Updated mock
     to mirror the real role mapping; added a `getByRole("alert")` test.
  5. **Active-context UX / dead prop:** `_props.workspaceSlug; void _...`
     was a tech-debt smell. → Surfaced the slug in the page header
     (test id `cms-integrations-workspace-slug`).
  6. **Dead field:** `tone: "warn"` on the metric type was never read.
     → Removed.
  7. **JSX duplication:** four near-identical IntegrationCard call sites.
     → Extracted pure `buildIntegrationCards({ status })` helper.
  8. **Route doc:** the route page had no JSDoc explaining the contract.
     → Added JSDoc explaining ownership and the "thin orchestrator" rule.
  9. **Vacuous "no leak" test:** the original test stringified an object
     we built ourselves. → Added a stronger test that injects hostile
     fields (`rawKey`, `keyHash`, `internalAuditNote`) into the upstream
     gateway payload and asserts the returned object's keys are exactly
     the documented contract.
- Final results:
  - 44 task tests pass (`pnpm vitest run` on the four task files)
  - 409/409 full repo tests pass (`pnpm test`)
  - `pnpm lint`: clean
  - Coverage (`pnpm test:coverage`): overall lines **92.2%**, branches
    **85.78%**, funcs **94.9%**, statements **92.2%**; new files all
    above the ADR-001 80% floor (`workspace-admin-links.ts` at 100%
    across the board)
- Documentation refreshed:
  - `docs/DEVELOPER.md` "Workspace Admin Integrations (CMS Contextual
    Consumer)" — added canonical-sentinel rule, native-anchor rule,
    accessibility contract, and updated test ownership.
  - Workspace `AGENTS.md` — updated landing note with revalidated
    numbers and rules.
  - Implementation plan checklist — appended a 2026-04-27 verification
    section with the new test counts and the redundancy/tech-debt
    cleanup list.
- Manual browser smoke remains the only outstanding gate (route is
  auth-gated; visual confirmation must be done in a logged-in session).
