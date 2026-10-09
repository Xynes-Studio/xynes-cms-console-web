# CMS API access acceptance — 2026-10-09

The request panel now uses a format/Copy toolbar above full-width code, readable
semantic highlights, inherited Copy/check icon colors, and a subordinate key
prerequisite. Publication guidance describes published content separately from
gateway and key readiness. Examples remain credential-free and JavaScript is
server-side. The feature flag remains default OFF.

Lumia owns the shared semantic stylesheet, Alert colors and Sheet repair. Changing
overlay dismissal at a responsive breakpoint previously remounted the scrim above
existing content. The stable overlay tree now preserves its paint order, including
when an already-open panel crosses a breakpoint at native browser zoom.

## Verification

| Check | Result |
| --- | --- |
| CMS coverage | 1,098 tests / 92 files passed; S/B/F/L 93.22/87.63/97.43/93.72%, above the configured 85% gates. |
| CMS lint, typecheck, production build | Passed with rebuilt sibling libraries. |
| Ordinary browser suite | 76 passed; three provisioned tests skipped in this configuration. |
| Provisioned B5 browser/backend suite | All three passed separately against both an isolated backend and the actual local port-4100 gateway. |
| Lumia full suite | 2,030 passed, two existing skips. |
| Lumia components coverage | 332 tests / 66 files passed; S/B/F/L 95.81/86.50/84.47/95.81%, above configured 80% gates. |
| Lumia lint, type-check, full coverage sweep, all package/docs builds and Storybook build | Passed. |
| Lumia browser/visual regression | 36 passed across Chromium, Firefox and WebKit using existing browser executables through a temporary configuration; CI's bundled browser versions were not locally installed. |
| Contract checks | 48 schema checks passed; consumer mirror checked without regeneration; infra delivery/content safety checks passed. |
| Native browser 200% zoom | Actual Chrome UI zoom passed for folder and editor hosts, fixed header/Close, internal scroll and focus restoration. |

Changed production-file coverage (S/B/F/L): ApiAccessSheet
100/93.10/85.71/100; RequestStep 100/95.56/100/100; Lumia Alert
98.54/84.62/100/98.54; Lumia Sheet 98.04/80/100/98.04.

Browser assertions inspect compiled colors in both themes at 320/375/768/1280px,
including normal, hover, keyboard focus, selected, copied, pending and error
states. Text meets 4.5:1 and required icon cues meet 3:1. All four entry points,
seven publication states, long labels, pseudo-locale, exact clipboard bytes,
manual-copy/race recovery, responsive resizing and nested overlays are covered.
Screenshots and computed-color records are generated through portable Playwright
output paths. Existing request-engine and contract files are unchanged.

## Local delivery proof and limits

Synthetic fixtures and a fresh canonical `cms_readonly` key were generated on the
destination machine. Issuance uses the real accounts handler with an isolated
permission seam restricted to the synthetic principal; this does not certify a
human Workspace Admin login. Raw keys remain in ignored private files and never
enter browser state, screenshots, transcripts or committed examples.

The browser compares the clipboard to displayed cURL bytes, parses the producer's
fixed representation and executes that exact URL/header through a private bridge.
The final real-gateway run made 32 requests: 23 returned 200, two 403, three 401 and
four 404. List/detail, empty feed, projection, sorting, pagination, search bounds,
workspace/folder isolation, missing/wrong/revoked/expired credentials and old-scope
denial passed. Save retains published A until republish; moving folders requires
republish; archive/unpublish withdraw delivery; legacy content requires republish.
Draft/foreign detail returns `ENTRY_NOT_FOUND`, distinct from generic route 404.

Local readiness used the existing additive delivery-route migration, CMS migration
0009 and canonical CMS signing/trust mounts. Original content and routes were
preserved; no reset, broad seed replay or existing-content publication occurred.
These local operations require no new backend source PR. They certify API-key
delivery, not hosted deployment or other services' human-authoring trust setup.

The owner explicitly deferred audio/video proof on 2026-10-09: “skip this audio
video thing for now and continue with the rest.” VoiceOver/NVDA audio and video
proof are therefore not claimed. Revocation of the older exposed key remains its
owner's follow-up in the original environment; it was absent from this database.

The CMS workflows and release source record pin Lumia commit
`595d99261b1b325ac3806290dba63ba5808de9ad`, containing `semantic.css` and the
Alert/Sheet fixes from [Lumia PR #238](https://github.com/Xynes-Studio/lumia-ds/pull/238). Merge Lumia first.
Package publication and hosted rollout are separate operations.

## PR review follow-up

Lumia PR #238 identified that Tailwind preset consumers lacked the singular
`--color-on-primary` variable used by Button and `buttonStyles`. The shared
stylesheet now aliases it to `--colors-on-primary` in every theme scope. Two
browser regressions first reproduced the white-on-pale dark-theme defect; all
12 new checks pass across Chromium, Firefox and WebKit, including system,
explicit/nested themes, theme switching, standalone fallback and inline override
compatibility. The complete Lumia browser suite passes 36 tests; lint, workspace
type-check, components coverage and build also pass. All CMS workflow/source-record
pins above now consume the reviewed fix.
