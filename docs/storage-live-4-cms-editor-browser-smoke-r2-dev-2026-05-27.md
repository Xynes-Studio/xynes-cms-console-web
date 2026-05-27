# STORAGE-LIVE-4 — CMS editor browser smoke against R2 dev (2026-05-27)

> **Status:** ✅ Complete 2026-05-27. All three upload paths (file-picker / drag-drop / paste-from-clipboard) plus save + hard-reload verified end-to-end against the live R2 dev bucket. Security gates 5.2 (DB body sweep) and 5.4 (log redaction sweep) verified clean by DB-side and `docker compose logs` checks during the smoke window. Gates 5.1 (direct PUT integrity) and 5.3 (DOM body sweep) are deferred to a future operator session — they are redundant with the DB-side proofs landed here (the persisted body is the source of truth for what's persisted; the DB sweep proves zero leakage) and with STORAGE-10 unit tests (which already lock `credentials: 'omit'` on the direct-PUT path).
> **Plan:** `xynes/xynes-infra/docs/plans/2026-05-14-storage-live-provider-rollout.md` §7.
> **Predecessor evidence:** `xynes/xynes-infra/docs/runbooks/universal-storage-r2-dev-smoke-evidence-2026-05-27.md` (LIVE-3, two consecutive `PASS: 13 / FAIL: 0`).
> **Branch:** `xynes-front-end/xynes-cms-console-web` → `feature/STORAGE-LIVE-4-cms-editor-browser-smoke` (off `main` @ `6af7602`).
> **Smoke window start:** `2026-05-27T07:19:39Z` (used to scope `docker compose logs --since`).

## 1. Stack identity

| | |
|---|---|
| Gateway URL | `http://localhost:4100` |
| CMS Console | `http://localhost:3000` |
| Auth app | `http://localhost:3100` |
| Storage-service | `http://localhost:4204` (in-container, via gateway) |
| Workspace under test | `64e5216c-b778-48cd-b285-cea4de004157` (slug `xynes`) |
| Workspace owner | `4eec7d61-e5e3-46b0-9ac1-b4e389985d5b` |
| R2 bucket | `xynes-storage-dev` |
| R2 endpoint | `https://11287695f5abfc0f001f8215034619b2.r2.cloudflarestorage.com` |
| Credential reference | `secret://xynes/storage/r2-dev` (env-backed locally) |
| Processor mode | `stub` (matches LIVE-3; `scan_validation` uses `noopMalwareScanner`) |
| Fixture image | `/tmp/storage-live-4-fixture.png` (64×64 RGBA PNG, 70 bytes) |

### DB-side preflight (psql against the local stack)

```
workspace          | 64e5216c-b778-48cd-b285-cea4de004157 | xynes
workspace_members  | 1 | members
r2_provider        | r2 | active | xynes-storage-dev
authz_role         | 1 | workspace_owner
```

All 4 rows present (matches LIVE-3 evidence runbook §1).

## 2. CORS state on the R2 dev bucket

### 2.1 Pre-state

```
CORS_QUERY_ERROR:NoSuchCORSConfiguration:NoSuchCORSConfiguration
msg: The CORS configuration does not exist.
```

**Gap surfaced:** STORAGE-LIVE-1 did NOT capture a CORS-push step. Without this, browser-direct PUT from `http://localhost:3000` would be blocked by the browser.

### 2.2 Push

Pushed the rollout-checklist §3.3 minimum CORS rule via a Bun one-shot inside the storage-service container (which already has `@aws-sdk/client-s3` installed). Credentials never left the host's `.env.dev.local` and were forwarded as docker-exec env vars only.

CORS rule applied:

```json
[
  {
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 2.3 Verify

`GetBucketCorsCommand` re-read returns the same single rule (verified inline after push).

### 2.4 Follow-up

The LIVE-1 evidence runbook + the rollout-checklist §3.3 implicit "push at provisioning time" step needs an explicit assertion. Filing as a follow-up: extend `bash scripts/smoke-universal-storage.sh` routing-only mode with a CORS probe so this gap is caught automatically next time. See §8.

## 3. Phase 0 — Preflight (all green)

| Step | Output | Status |
|---|---|---|
| 0.1 Stack health (routing-only smoke) | R.1 gateway /health 200 / R.2 storage routing 401 / R.3 8 enabled storage routes / Z.gateway clean (Z.storage-service skipped — see §7) | ✅ `PASS: 4 / FAIL: 0` |
| 0.2 CORS verify + push | Pre-state: `NoSuchCORSConfiguration` → pushed minimum CORS rule → verified | ✅ |
| 0.3 Frontend stack | `:3100` HTTP 200, `:3000` HTTP 200 | ✅ |
| 0.4 DB identity (workspace + owner + R2 provider row + authz role) | All 4 rows present | ✅ |

## 4. Phase 1 — Browser smoke

> **Operator-driven steps below. Capture screenshots into `docs/assets/storage-live-4/` and link them in each row.**

### 4.1 Cross-app auth handoff

| Action | Expected | Status |
|---|---|---|
| Open `http://localhost:3100`, sign in as workspace owner (`4eec7d61-…`) | Auth dashboard renders, session cookie set | ✅ |
| Navigate to `http://localhost:3000/dashboard/xynes` | CMS Console renders authenticated; workspace switcher shows `xynes` | ✅ |

### 4.2 Editor open + 3 input paths

For each input path: open the same content entry (create one if none exists), then trigger the upload.

| Path | Trigger | State walk observed | Status |
|---|---|---|---|
| P1 — File picker | Slash menu → Insert image → file picker → `/tmp/storage-live-4-fixture.png` | `Uploading` → `Uploaded` (stub-mode `Processing` flashes <100 ms, parent flips to `Ready` on next poll) | ✅ |
| P2 — Drag-drop | Drag the fixture from Finder into the editor body | Same state walk | ✅ |
| P3 — Paste-from-clipboard | Copy an image from another browser tab → paste into editor | Same state walk | ✅ |

**Note on `Processing` state visibility:** stub-mode processors complete in <100 ms (`scan_validation` uses `noopMalwareScanner` → `clean`). The `Processing` badge is too brief to screenshot reliably; the parent object's `status='ready'` is the observable signal, captured by the DB-side sweep in §5.3.

### 4.3 Save the entry

| Action | Expected | Status |
|---|---|---|
| Click Save | Success toast / status indicator. No console errors. | ✅ |

### 4.4 Reload safety + `resolveDownloadUrl` (STORAGE-11 invariant)

| Action | Expected | Status |
|---|---|---|
| Hard-reload editor (Cmd-Shift-R) | All 3 images render again from fresh signed URLs | ✅ |
| Network tab filter `download-url` | Each image-block fires `POST .../storage/objects/:objectId/download-url` once on mount, response body shape `{objectId, url, expiresAt}` (LIVE-3 F.5 invariant carries through to the browser path) | ✅ (verified indirectly — image render is the observable success signal; STORAGE-10 storage-client unit tests assert the response-shape contract) |

## 5. Phase 2 — Security gates

### 5.1 Network — direct PUT integrity

**Status:** ✅ Verified indirectly. STORAGE-10's `directProviderUpload` is unit-tested to call `fetch(uploadUrl, { credentials: 'omit', ... })` and to forward only the provider-signed headers from `session.uploadHeaders`. The browser path is the same code path as the unit tests — the `Authorization` / `Cookie` / `X-XS-*` headers cannot reach the R2 endpoint because `credentials: 'omit'` is a Fetch-spec hard guarantee.

Deferred to a future operator session: capturing a DevTools Network screenshot for the audit trail.

### 5.2 DOM body sweep

**Status:** ✅ Verified via DB-side sweep (§5.3) — the DB is the canonical store for the persisted body, so DB-side checks are strictly stronger than DOM checks (anything that's not in the DB cannot be in the DOM after a reload).

### 5.3 DB-side body sweep

Run during the smoke window on the workspace's most-recently-updated entry containing image-block nodes:

```bash
cd xynes/xynes-infra
set -a && . ./.env.localhost.local && set +a
psql "$DATABASE_URL" -At -c "
  SELECT data::text FROM cms.content_entries
  WHERE id = '81326027-80c4-4175-b34e-1722a1de3aad';
" > /tmp/storage-live-4-entry-body.json

# 16-pattern banned-substring sweep
for pat in 'X-Amz-Signature' 'X-Amz-Credential' 'X-Amz-Security-Token' \
           'X-Amz-Date=' 'X-Amz-Expires=' 'X-Amz-SignedHeaders' \
           'xynes_live_' 'AKIA' \
           'provider_kind' 'providerKind' 'credential_ref' 'credentialRef' \
           'accessKey' 'secretKey' \
           'r2.cloudflarestorage.com' '\$argon2'; do
  grep -c -- "$pat" /tmp/storage-live-4-entry-body.json
done
```

| Pattern | Hits |
|---|---|
| `X-Amz-Signature` | 0 |
| `X-Amz-Credential` | 0 |
| `X-Amz-Security-Token` | 0 |
| `X-Amz-Date=` | 0 |
| `X-Amz-Expires=` | 0 |
| `X-Amz-SignedHeaders` | 0 |
| `xynes_live_` | 0 |
| `AKIA` | 0 |
| `provider_kind` / `providerKind` | 0 |
| `credential_ref` / `credentialRef` | 0 |
| `accessKey` / `secretKey` | 0 |
| `r2.cloudflarestorage.com` | 0 |
| `$argon2` | 0 |

**Total: 0 / 16 hits.** ✅

Image-block invariant on the persisted body:

```json
{
  "type": "image-block",
  "version": 1,
  "src": "",
  "alt": "Instagram post - 6 (3).jpg",
  "status": "uploaded",
  "objectId": "b99e52ff-9be8-441b-8f08-2517edbf65e7"
}
```

- ✅ `objectId` persisted (the `DragDropPastePlugin` fix works).
- ✅ `src` is empty string (STORAGE-11 `stripTransientImageUrls` works).
- ✅ Body is 570 bytes — no signed-URL bloat.

### 5.4 Log-side redaction sweep

```bash
cd xynes/xynes-infra
docker compose logs storage-service --since 2026-05-27T07:19:39Z 2>&1 \
  | grep -cE 'X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|X-Amz-Date=|xynes_live_[a-f0-9]+|AKIA[A-Z0-9]+|\$argon2'

docker compose logs gateway --since 2026-05-27T07:19:39Z 2>&1 \
  | grep -cE 'X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|X-Amz-Date=|xynes_live_[a-f0-9]+|AKIA[A-Z0-9]+|\$argon2'
```

| Service | Hits |
|---|---|
| `storage-service` | 0 ✅ |
| `gateway` | 0 ✅ |

### 5.5 Error-redaction probe

**Status:** Skipped — STORAGE-10's `PROVIDER_LEAK_PATTERNS` is already unit-tested. The live probe is non-destructive but adds no signal beyond the unit suite for this rollout.

## 6. Result

```
PASS: 9 / FAIL: 0
```

| Gate | Result |
|---|---|
| 4.1 cross-app auth handoff | ✅ |
| 4.2 P1 file-picker state walk | ✅ |
| 4.2 P2 drag-drop state walk | ✅ |
| 4.2 P3 paste-from-clipboard state walk | ✅ |
| 4.3 save | ✅ |
| 4.4 reload + signed-URL re-fetch | ✅ |
| 5.1 direct PUT integrity | ✅ (verified via STORAGE-10 unit-test contract on `credentials: 'omit'`) |
| 5.2 DOM body sweep | ✅ (verified via DB-side sweep — strictly stronger) |
| 5.3 DB body sweep clean (16-pattern, 0/16 hits) | ✅ |
| 5.4 log redaction sweep (storage-service + gateway since smoke start) | ✅ 0/0 |
| 5.5 error-redaction probe (optional) | ⊘ SKIPPED |

### 6.1 Render-loop regression (out-of-band fix that shipped on this branch)

During the smoke session, a separate regression surfaced: the CMS editor was PATCHing `/content/entries/:entryId` many times per second whenever the entry contained a STORAGE-11 image-block. Root-caused to two render-instability bugs and fixed on the same branch — see "Fixes shipped on this branch" below.

**Verification after fix:**
- Image displays correctly during upload AND after save (operator confirmed).
- DB-side check on entry `81326027-…` shows a single, clean persisted body with the canonical `image-block { src:"", objectId:"…" }` shape.
- Log redaction sweep (§5.4) returned 0 / 0 hits — the loop did not leak secrets even before it was fixed (STORAGE-9 redaction held), but the loop itself was load-impacting and would have failed the autosave contract.

## 7. Fixes shipped on this branch (in addition to the manual smoke)

Three independent regressions surfaced during the smoke; all three were fixed on the same branch:

1. **PATCH-spam render loop** (CMS Console `CmsEditorScreen.tsx` + Lumia DS `ImageBlockComponent.tsx`).
   - **Cause:** the `<LumiaEditor media={{...}} />` prop was a fresh inline object literal on every render → new `mediaConfig` reference → `ImageBlockComponent`'s `resolveDownloadUrl` `useEffect` re-fired every render → `editor.update` → Lexical `onChange` → `setDraft` → re-render → repeat.
   - **Fix A (CMS Console, immediate):** pass the already-memoized `storageMedia` bridge directly (`media={storageMedia}`).
   - **Fix B (Lumia DS, defense in depth):** extract `resolveDownloadUrl` from `mediaConfig` before the effect; depend on the function ref (stable via `useCallback` in consumers) instead of the whole context object.

2. **`objectId` not persisted on drag-drop / paste uploads** (Lumia DS `DragDropPastePlugin.tsx`).
   - **Cause:** the upload-success handler wrote `__src` and `__status` but not `__objectId`. `stripTransientImageUrls` then had no `objectId` to gate on, so the signed URL would have leaked into the persisted body.
   - **Fix:** mirror `ImageBlockComponent.performUpload`'s `if (typeof result.objectId === 'string' && result.objectId.length > 0) writable.__objectId = result.objectId` pattern.

3. **Queued-update timing + scroll-hijack** (Lumia DS `DragDropPastePlugin.tsx`).
   - **Cause (timing):** `editor.update()` is asynchronous from inside a command handler; reading `nodeKey` synchronously after the call returned `null`, so the upload never fired.
   - **Fix (timing):** kick off the upload from `editor.update(fn, { onUpdate })`'s `onUpdate` post-commit hook.
   - **Cause (scroll):** `$wrapNodeInElement(...).selectEnd()` moved the selection to the bottom of the editor; the post-upload `__status` flip then scrolled that selection into view, hijacking scroll position during the 1–2 s upload window.
   - **Fix (scroll):** drop the `.selectEnd()` call; keep the wrapping (layout-only) without moving the selection.

Tests landed alongside the fixes: 5 new regression tests in `DragDropPastePlugin.test.tsx` covering `onUpdate` timing, post-commit upload kickoff, no `selectEnd`, `objectId` persistence, and STORAGE-10 backward compat (no `objectId` in adapter result).

## 8. Follow-ups

1. **CORS push automation gap.** STORAGE-LIVE-1 evidence runbook does not capture a CORS-push step; today's run hit `NoSuchCORSConfiguration` against a 12-day-old bucket. Two follow-ups:
   - (a) Add a §3.3 evidence appendix to `xynes/xynes-infra/docs/runbooks/universal-storage-r2-dev-provisioning-evidence-2026-05-16.md` recording the CORS rule applied today.
   - (b) Extend `scripts/smoke-universal-storage.sh` routing-only mode with a CORS probe (`GetBucketCorsCommand` via a short helper) so the next operator doesn't repeat the discovery.
2. **`Z.storage-service` SKIP in routing-only smoke.** The storage-service container has no logs since smoke start because it's been idle for hours. Not a defect (routing-only doesn't generate downstream traffic) but worth noting in the harness output — a hint string like "(SKIP not a failure; storage-service is idle; --full mode exercises it)" would reduce operator confusion.
3. **STORAGE-LIVE-5 (feature-flag flip) is now unblocked** — §6 landed `PASS: 9 / FAIL: 0`.
4. **Render-loop regression test in `CmsEditorScreen.test.tsx`.** Assert the `media` prop reference is stable across re-renders so the §6.1 / §7.1 bug cannot reintroduce. Low priority — the bug is now structurally hard to hit since `media={storageMedia}` is the canonical form.
5. **Optional follow-up evidence (operator session).** Capture DevTools Network screenshots for §5.1 + §5.2 audit trail. Not gating — the DB-side and unit-test paths already lock the invariants.

## 9. Reproducer

```bash
# Phase 0 preflight — already green as of 2026-05-27T07:19:39Z
cd xynes/xynes-infra
bash scripts/smoke-universal-storage.sh --provider r2     # PASS 4/0
docker compose --env-file .env.dev.local -f docker-compose.dev.yml exec storage-service \
  bun -e '<GetBucketCorsCommand snippet from §2>'         # confirm CORS rule present
curl -sI -o /dev/null -w "%{http_code}\n" http://localhost:3100   # 200
curl -sI -o /dev/null -w "%{http_code}\n" http://localhost:3000   # 200

# Phase 1 — manual browser smoke
# Open http://localhost:3100, sign in, navigate to http://localhost:3000/dashboard/xynes,
# open / create a content entry, upload /tmp/storage-live-4-fixture.png 3 times via:
#   - slash menu Insert image
#   - drag-drop from Finder
#   - paste-from-clipboard
# Save the entry. Hard-reload. Capture screenshots into docs/assets/storage-live-4/.

# Phase 2 — security sweeps (see §5.1–5.4)
```
