# Use via API epic validation

Validated locally on 2026-10-08–09 (Asia/Kolkata). This report distinguishes
automated proof, real-app observations and checks that still require a person.

## Delivery and scope

Both repositories use `feature/CMS-INT-api-access-panel-epic`, targeting `develop`.
The owner's coordinated-epic instruction replaces the runbook's incremental PR
and merge checkpoints. No remote merge or package publication is performed.

| Repository | Base | Dependency revision |
| --- | --- | --- |
| `lumia-ds` | `3e8eaa1ff07d96563f858b874474cdf0b34a5d30` | `e5c1067995a4b8a99df57e68a8a8421a1b7f676b` |
| `xynes-cms-console-web` | `d265a5da399e516350b25203c463fb691660d4c8` | Commit containing this report |

All three CMS workflow checkouts and the release provenance record pin that
immutable Lumia revision. Local consumption uses the existing `link:` package,
built before the browser walkthrough. The final push manifest is saved outside
Git in the workspace review artifact directory.

The existing PostHog flag is `cms_content_integrations`; its default remains OFF.
No backend, API, delivery-contract, dependency or live-content changes are included.
API key lifecycle remains in Workspace Admin. Examples contain placeholders only.
Request preferences are scoped browser-memory state, not content mutations.

## Commands and quality gates

Run from the corresponding repository; no installation is needed for this change.

```sh
# Lumia
pnpm lint
pnpm type-check
pnpm test
pnpm --filter @lumia-ui/components build

# CMS
pnpm lint
pnpm typecheck
pnpm test:coverage --maxWorkers=2
pnpm build
PLAYWRIGHT_E2E_PORT=3207 pnpm test:e2e e2e/content-integration-hosts.spec.ts e2e/content-integration-accessibility.spec.ts e2e/content-integrations.spec.ts
```

| Gate | Baseline | Final observed result |
| --- | --- | --- |
| Lumia full suite | 2,023 pass, 2 existing skips | 2,024 pass, 2 existing skips; zero failures |
| Lumia components | 317 pass / 66 files | 326 pass / 66 files |
| Lumia lint / type-check / component build | Green | Green |
| CMS full suite | 1,056 pass / 86 files | 1,095 pass / 92 files; zero failures |
| CMS lint / typecheck / production build | Green | Green |
| CMS coverage gate | Configured 85% for every global metric | 93.22% statements, 87.61% branches, 97.43% functions, 93.72% lines |
| Three fixture browser suites | Old presentation | 20 cases pass, including responsive Copy geometry and dark action-link contrast |

The final logs are local scratch artifacts, not committed runtime output:
`/private/tmp/api-access-lumia-{lint,typecheck,full-2}.log`,
`/private/tmp/api-access-{lint,typecheck,coverage,build}-focus-final.log`, and
`/private/tmp/api-access-browser-focus-final.log`.

The relevant RED/GREEN evidence includes overlay layering, translated close labels,
status/copy/options/sheet/host behavior, session and clipboard timers, publish-status
refresh, checkbox hit areas, numeric spinner hit areas, and Copy geometry. The Copy
regression failed because its bottom was 808px while the code ended at 764px;
an absolute wrapper now positions Lumia's relatively positioned Button inside the
code block. Dark native-link contrast failed at 1.11:1; links now use the existing
foreground token, and the browser test requires at least 4.5:1. No coverage
threshold, timeout or assertion was weakened.

### Per-file coverage

Percentages from final Istanbul/V8 coverage data; S/B/F/L means statements,
branches, functions and lines. Empty executable denominators count as 100%.
Every changed production module exceeds the ADR-001 80% floor in all metrics.

| CMS file | S | B | F | L |
| --- | ---: | ---: | ---: | ---: |
| `ApiAccessSheet.tsx` | 100.00 | 93.10 | 85.71 | 100.00 |
| `ApiStatusLine.tsx` | 100.00 | 95.24 | 100.00 | 100.00 |
| `EditorApiCard.tsx` | 100.00 | 100.00 | 100.00 | 100.00 |
| `RequestStep.tsx` | 100.00 | 95.12 | 100.00 | 100.00 |
| `RequestOptions.tsx` | 97.96 | 97.37 | 94.12 | 97.83 |
| `request-summary.ts` | 100.00 | 100.00 | 100.00 | 100.00 |
| `useApiDesktop.ts` | 100.00 | 100.00 | 100.00 | 100.00 |
| `useContentIntegration.ts` | 100.00 | 95.77 | 100.00 | 100.00 |
| `CmsContentCardGrid.tsx` | 95.65 | 93.55 | 100.00 | 95.65 |
| `CmsContentCardList.tsx` | 97.30 | 88.37 | 100.00 | 97.30 |
| `CmsContentToolbar.tsx` | 100.00 | 90.48 | 100.00 | 100.00 |
| `CmsEditorLayout.tsx` | 87.65 | 87.10 | 92.68 | 89.74 |
| `CmsContentListPanel.tsx` | 92.86 | 80.43 | 94.83 | 94.12 |
| `CmsEditorScreen.tsx` | 92.68 | 82.42 | 100.00 | 93.39 |

The feature files live under `src/features/content-integrations`, host components
under `src/components/dashboard`, and orchestration under `src/features/cms-content`.
`index.ts` is export-only. E2E fixtures are outside the unit instrumentation scope
and exercised by the three real-browser suites; deleted presentation modules no
longer execute.

| Lumia components file | S | B | F | L |
| --- | ---: | ---: | ---: | ---: |
| `sheet/sheet.tsx` | 98.03 | 84.21 | 100 | 98.03 |
| `drawer/drawer.tsx` | 90.48 | 87.91 | 100 | 90.48 |
| `dialog/dialog.tsx` | 97.44 | 88 | 100 | 97.44 |
| `accordion/accordion.tsx` | 100 | 80 | 100 | 100 |
| `lib/overlay-layers.ts` | 100 | 100 | 100 | 100 |

## SPEC section 11 audit

| Item | Evidence and outcome |
| --- | --- |
| 1 | Title initial focus and four Tabs to Copy pass in fixtures at 375/721/768/1280 and live desktop. Live copied text equals displayed code, including Authorization. ARIA description/status and polite copy feedback pass DOM tests. Screen-reader audio remains untested. |
| 2 | Full Authorization line and no inner cURL scroll pass at 375/768/1280, with 721 added. Code wraps inside the body scroller. |
| 3 | Placeholder marks in all three formats and helper copy pass RequestStep tests; live cURL mark observed. |
| 4 | All seven entry states plus fixed folder copy pass ApiStatusLine tests. Draft, legacy published and empty-folder states are observed live. Missing real states use harmless fixtures. |
| 5 | Publication guidance matrix and editor plain text pass sheet tests. Live list/grid link selects desktop API tab or opens mobile sheet; `panel` is stripped after load. Other query parameters are retained in editor tests. |
| 5a | Editor test publishes a fixture and asserts refreshed API status without canvas remount/reload. Real content was never published to prove this. |
| 6 | Summary, four combined sorts, fields, search and pagination round-trip in unit/browser tests. Live limit 25 updates both summary and cURL. |
| 7 | Live limit 500 removes Copy, names Items per page, and Go to field focuses that input. Correcting to 25 restores Copy. Unsafe-origin and malformed-option paths remain covered. |
| 8 | No panel tabs; static SDK/scripts roadmap verified in component and browser tests. Editor host retains its separate Details/API tabs. |
| 9 | Live root has no toolbar trigger/helper; entry rows retain actions. Resolved folder names its action; loading Skeleton and root absence pass host tests. |
| 10 | Live grid menu order: Delete, Share, Favourite, separator, Use via API. Trigger restores focus after Escape. |
| 11 | Live centre hit-tests resolve inside API sheet above editor at 375/721/1280; fixture host tests cover the same widths. Mobile metadata Drawer also passes at 375/721. Escape focus restoration passes for folder/list/grid/editor. |
| 12 | Browser geometry tests assert all buttons, links, checkbox labels and spinner buttons are at least 32px. English and pseudo long-content fixtures have no horizontal overflow at 320; live API sheet also has no page overflow at 320. |
| 13 | Same-target options/format memory and different-target defaults pass controller/browser tests. Live folder retains limit 25 after closing/reopening at tablet size. |
| 14 | Catalog and panel tests reject forbidden presentation terms; the real legacy status uses plain republish guidance. Security error identifiers remain internal contract values. |

Owner decision: Copy within four Tabs takes precedence over the contradictory
Close-first order in SPEC section 6. Close follows the content in Lumia's DOM order.

## Phase 3 real-app walkthrough

Signed-in local workspace `xynes`, PostHog flag enabled by the owner. No Save,
Publish, Schedule, Delete, Share, upload or Create key action was executed.
Only navigation, panel request preferences and placeholder Copy were exercised.

| Row | Result | Actual viewport / observation |
| --- | --- | --- |
| 1 | PASS | 1280×800 root: toolbar absent; six entry actions remain. |
| 2 | PASS | 1280×800 `check test` folder: named trigger, right sheet 480px, title focus, list visible behind overlay. 768×1024 sheet is 420px. |
| 3 | PASS | Folder cURL includes full Authorization, marked placeholder, Copy feedback and exact clipboard equality; no real credential used. |
| 4 | PASS | Folder limit 500 / Go to field / fix to 25 flow as above. |
| 5 | PASS | Empty folder shows fixed published-entry explanation without count. |
| 6 | PASS | Upload Check draft list/grid action: Not live yet; editor link selects desktop API tab and opens mobile sheet at 375×812; parameter removed. |
| 7 | PASS | Publish now? entry: published-before-API-delivery guidance, no forbidden jargon. |
| 8 | PASS | Real grid menu order and separator inspected; direct API item clicked without destructive navigation. |
| 9 | PASS | 375×812 and 721×793 editor: direct API header button; centre hit-test inside full-height bottom sheet; Escape returns API focus. |
| 10 | PASS | 1280×800 editor: API tab selected; status/summary/Open API panel card; sheet width 480px above editor. |
| 11 | PASS | Folder returns named toolbar trigger, list returns row trigger, grid returns Actions trigger, editor returns Open API panel/API header. |
| 12 | PASS | All four live API hosts (folder/list/grid/editor) at 320×812 have no page overflow. English/pseudo long-content fixtures also pass. |

Evidence images remain outside Git under workspace
`artifacts/cms-content-integrations-ux-review-2026-10-08/impl-verification/`.
The extended real-app matrix is saved as `live-viewport-matrix.json` and covers
root/list/grid/legacy/folder/clipboard/invalid recovery/editor at all three required
viewports. Mobile deep-link Escape initially returned BODY; a shared header-trigger
ref now restores API focus. The canonical-env Screen/Layout suites pass 77 cases,
and the live mobile regression passes after waiting for parameter removal.

The final corrected visual capture is `live-api-editor-final-320.png`. Other inspected final captures include `phase3-04-invalid-1280.png`,
`phase3-09-mobile-editor-375.png`, `phase3-11-restored-api-focus-375.png`,
`phase3-12-no-overflow-320.png`, and `fixture-api-{375,721,768,1280}.png`. Capture excludes sidebar email.
The in-app capture API sometimes reloads the page or captures loading state;
those images are not treated as behavioral proof. Viewport control initially
failed, then worked after a reset; actual DOM dimensions were checked each time.

### Inspected Phase 3 image index

Files are outside Git in the workspace `impl-verification` directory. Native
captures retain original pixels; only the requested sidebar-excluding region is
cropped, using the preinstalled bundled image runtime. Raw temporary captures
are deleted after cropping. No dependencies were installed or image content altered.

| Row | Image |
| --- | --- |
| 1 | `native-root-1280.jpg` |
| 2 | `native-folder-1280.jpg` |
| 3 | `native-copied-1280.jpg` |
| 4 | `phase3-04-invalid-1280.png` |
| 5 | `native-folder-1280.jpg` (same capture also proves the fixed status copy) |
| 6 | `native-draft-1280.jpg`, `native-draft-guidance-1280.jpg` |
| 7 | `native-legacy-1280.jpg` |
| 8 | `native-grid-menu-1280.jpg` |
| 9 | `phase3-09-mobile-editor-375.png` |
| 10 | `native-editor-card-1280.jpg` |
| 11 | `phase3-11-restored-api-focus-375.png` |
| 12 | `phase3-12-no-overflow-320.png` |

Earlier foundation smoke: the Auth app's mobile navigation Drawer is above its
shell and restores Open menu focus on Escape. The runbook's `/dashboard` route
was stale; visible navigation led to the working `/dashboard/apps` route.

## Remaining validation boundaries

- Native browser 200% zoom is **not proven**: the available in-app zoom shortcut
  had no measurable effect. The automated 640×450 CSS reflow check passes and
  verifies Close visibility/body scrolling, but is not claimed as native zoom.
- Screen-reader **audio** has not been listened to. DOM accessibility, title focus,
  description association, ordered steps, mount-only status and copy live-region
  semantics are tested; a VoiceOver/NVDA pass remains a manual acceptance check.
- The provisioned B5 live-key/backend delivery matrix was **not run**, as the
  runbook reserves it for an explicit request. Existing contract/security tests
  pass unchanged; this epic does not claim renewed backend transport acceptance.
- Root/list/grid/folder/editor checks were repeated at 375×812, 768×1024 and
  1280×800; the safe boolean/focus-name results are in `live-viewport-matrix.json`.
  The native `Tab.getAXStateAndScreenshot` capture path subsequently recovered the
  desktop evidence. Every Phase 3 row now has an inspected screenshot reference
  below; the matrix record supplies the actual DOM/keyboard/clipboard observations.

These boundaries keep the runbook's exhaustive live definition of done open;
green automated gates alone are not a claim that all manual acceptance is finished.

## Local runtime and preservation

Build the linked component package, then recreate only CMS if Next retains an old
linked artifact. Standard dev startup installs packages; this task instead used
a temporary Compose override whose service command is:

```sh
sh -c 'cd /app && exec node /app/infra/scripts/with-env.mjs next dev'
```

The override is outside Git at `/private/tmp/api-access-no-install-compose.json`.
Existing dependency volumes and account/content data are retained. No database
reset or migration is needed. Both app health probes and the local backend health
smoke were green during the walkthrough.

SHA-256 preservation checks cover six unrelated dirty CMS files and fifteen frozen
engine/contract/security files. They match their preflight values. Unrelated files
remain unstaged. The original runbook/SPEC/review artifacts are not modified.
Lumia owns overlay layers; no CMS stacking override was added. Commits use normal
hooks and GPG signing; no hook bypass is used.

### Manual acceptance still needed

1. In a browser with native zoom controls, set 200% zoom and open both a folder and
   editor API panel. Verify Close stays visible, the body can scroll, wrapping
   requests remain readable, and the page has no horizontal overflow. Restore 100%.
2. With VoiceOver or NVDA, open the panel by keyboard. Listen for its title,
   description and status; confirm Copy is reachable within four Tabs and Copied
   is announced. Changing options should not repeatedly announce the entry status.

Do not publish, save content, create a key or run the provisioned B5 matrix for
these checks. Report these results before treating exhaustive acceptance as done.
