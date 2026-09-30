# CMS API-Key Regression Checklist

**Status:** Waiting for supplied key and test inputs
**Last updated:** 2026-09-30
**Target:** Gateway-backed CMS APIs on a non-production environment

This checklist has two independent lanes:

1. **Provided-key black-box lane:** uses the single key supplied by the user and
   tests only its declared scopes. It does not create or revoke keys.
2. **Local full-matrix lane:** uses the existing infra smoke harness to mint
   disposable readonly/authoring/publisher keys, test scope boundaries, and
   revoke them during cleanup.

## Source contracts

| Contract | Source |
|---|---|
| Gateway route registry | `xynes-infra/supabase/migrations/20251229100001_seed_platform_routes.sql` and `20260427090000_seed_cms_dashboard_routes.sql` |
| Standard preset scopes | `xynes-accounts-service/src/actions/handlers/integrations/apiKeys.ts` |
| CMS payload/response behavior | `xynes-cms-core` action schemas/handlers and CMS frontend clients |
| Existing full local harness | `xynes-infra/scripts/smoke-cms-api-key.sh` |

## Required inputs for the provided-key run

- [ ] Gateway base URL, for example `http://localhost:4100`.
- [ ] Primary workspace UUID that owns the key.
- [ ] API-key preset or exact action-key scopes.
- [ ] Raw API key supplied through an approved secret mechanism.
- [ ] Secondary workspace UUID for isolation testing, if available.
- [ ] Explicit approval to create/update/publish disposable entries when the key
      is authoring/publisher-capable.
- [ ] Optional existing published `routeSegment` and slug for readonly checks.

Preferred secret handoff: place the raw key in a mode-`0600` file outside the
repository (for example `/private/tmp/xynes-cms-api-key`) and provide only the
path. The runner reads it without echoing and deletes the file after the run.

## Secret-safety rules (P0)

- [ ] Never place the raw key in this Markdown file, Git, command-line
      arguments, shell history, screenshots, URLs, reports, or issue bodies.
- [ ] Never enable `set -x`, verbose curl tracing, request-header logging, or a
      proxy that records `Authorization`.
- [ ] Use `Authorization: Bearer "$XYNES_CMS_API_KEY"` or `X-XS-API-Key`, not
      both. A conflicting pair must fail closed.
- [ ] Reports may contain only the key ID/prefix already exposed by the product;
      do not record raw key or hash.
- [ ] Redact response headers/bodies before attaching evidence.
- [ ] Do not revoke or rotate the supplied key unless the user explicitly asks.

## Standard preset scope matrix

| Preset | Included action keys |
|---|---|
| `cms_readonly` | `cms.content.listPublished`, `cms.content.getPublishedBySlug`, `cms.blog_entry.listPublished`, `cms.blog_entry.getPublishedBySlug` |
| `cms_authoring` | `cms.entry.create`, `cms.entry.update`, `cms.entry.getById`, `cms.entry.listByDirectory` |
| `cms_publisher` | All authoring scopes plus `cms.entry.publish`, `cms.entry.status.set` |

Standard CMS presets intentionally do **not** include directory management,
delete, collaborators, favourites, share-link, comments, storage, or API-key
lifecycle scopes. Those endpoints should return scope-denied responses unless
the supplied key has an explicit custom scope.

## Endpoint inventory and expected preset access

| Method and path after `/workspaces/:workspaceId` | Action key | RO | Author | Publisher |
|---|---|:---:|:---:|:---:|
| `GET /content/:routeSegment` | `cms.content.listPublished` | ✓ | — | — |
| `GET /content/:routeSegment/:slug` | `cms.content.getPublishedBySlug` | ✓ | — | — |
| `GET /blog` | `cms.blog_entry.listPublished` | ✓ | — | — |
| `GET /blog/:slug` | `cms.blog_entry.getPublishedBySlug` | ✓ | — | — |
| `GET /content/entries` | `cms.entry.listByDirectory` | — | ✓ | ✓ |
| `POST /content/entries` | `cms.entry.create` | — | ✓ | ✓ |
| `GET /content/entries/:entryId` | `cms.entry.getById` | — | ✓ | ✓ |
| `PATCH /content/entries/:entryId` | `cms.entry.update` | — | ✓ | ✓ |
| `POST /content/entries/:entryId/publish` | `cms.entry.publish` | — | — | ✓ |
| `POST /content/entries/:entryId/status` | `cms.entry.status.set` | — | — | ✓ |
| `DELETE /content/entries/:entryId` | `cms.entry.delete` | — | — | — |
| `PUT /content/entries/:entryId/collaborators` | `cms.entry.collaborators.set` | — | — | — |
| `POST /content/entries/:entryId/favorite` | `cms.entry.favorite.toggle` | — | — | — |
| `GET /content/entries/favorites` | `cms.entry.favorite.list` | — | — | — |
| `POST /content/entries/:entryId/share-link` | `cms.entry.share.generateInternalLink` | — | — | — |
| `GET/POST /content-directories` | directory list/create actions | — | — | — |
| `PATCH/DELETE /content-directories/:directoryId` | directory update/delete actions | — | — | — |

`✓` means included by the standard preset. `—` means expect HTTP 403 for a
valid key unless its actual scope list says otherwise.

# Agent-owned provided-key run

## API-00 — Safe preflight (P0)

- [ ] Read key from the approved secret source without printing it.
- [ ] Validate only in memory that it has the expected `xynes_live_` shape.
- [ ] Confirm gateway `/health` and `/ready` return HTTP 200 before API testing.
- [ ] Confirm primary workspace UUID and declared preset/scopes.
- [ ] Create a private temporary result directory with `mktemp -d`; store only
      redacted bodies and remove the directory during cleanup.
- [ ] Capture a service-log timestamp boundary for later redaction checks.

## API-01 — Authentication contract (P0)

| Case | Request | Expected | Status |
|---|---|---|---|
| API-01.1 | One in-scope request with bearer key | HTTP 200 and valid JSON envelope | [ ] |
| API-01.2 | Same request without key | Public route behavior or HTTP 401, according to route contract | [ ] |
| API-01.3 | Structurally invalid synthetic key | HTTP 401; no key fragment echoed | [ ] |
| API-01.4 | Same real key in both supported headers | Same result as bearer-only | [ ] |
| API-01.5 | Real key plus different synthetic header value | Fail closed; no repository/service action | [ ] |

Do not test revocation of the supplied key without explicit approval.

## API-02 — Readonly preset (run when applicable, P0)

- [ ] Published generic-content list returns HTTP 200 and only published data.
- [ ] Existing slug returns the expected item; unknown slug returns safe 404.
- [ ] Blog list/by-slug contracts return valid JSON without internal fields.
- [ ] Pagination/filter inputs are bounded and malformed values fail safely.
- [ ] `POST /content/entries` returns HTTP 403 scope miss and creates no row.
- [ ] No private draft, creator secret, key/hash or stack trace appears.

## API-03 — Authoring preset (run when applicable, P0)

Use `QA-CMS-API-<timestamp>` and record the returned entry ID.

- [ ] `POST /content/entries` creates one draft with `directoryId: null` and a
      valid ID; API-key actor audit fields do not impersonate a user.
- [ ] `GET /content/entries` finds the entry using bounded limit/offset/search.
- [ ] `GET /content/entries/:id` returns the same workspace-owned draft.
- [ ] `PATCH /content/entries/:id` updates allowed fields and persists.
- [ ] Invalid body, invalid UUID and unknown ID return safe 4xx envelopes.
- [ ] Publish, status-set and delete return HTTP 403 for standard authoring.
- [ ] No out-of-scope mutation occurs after any denied request.

## API-04 — Publisher preset (run when applicable, P0)

- [ ] Create/list/get/update behave as in API-03.
- [ ] Publish returns HTTP 200; subsequent get/list shows `published` with a
      publication timestamp.
- [ ] Status-set supports documented transitions and persists after reread.
- [ ] Invalid transition/status returns safe 4xx without partial mutation.
- [ ] Delete/collaborators/favourite/share/directory calls remain HTTP 403 for
      the standard publisher preset.

## API-05 — Authorization and isolation (P0)

- [ ] Use the valid key against a different workspace UUID: HTTP 403 and no
      information revealing whether target entries exist.
- [ ] Attempt an endpoint whose action key is absent from the supplied scopes:
      HTTP 403 with a generic scope error and no downstream mutation.
- [ ] Wrong-workspace path plus known primary-workspace entry ID still fails.
- [ ] Repeated denied requests do not change primary/secondary workspace data.
- [ ] Gateway/CMS Core logs identify actor type/prefix only; raw key is absent.

## API-06 — Contract, resilience and limits (P1)

- [ ] Success responses use the documented `ok`/`data` envelope.
- [ ] Errors use stable status/code/message shape without internal stack/SQL.
- [ ] `Content-Type` is JSON; unsupported methods/media types fail safely.
- [ ] Oversized request body is rejected by the gateway before CMS mutation.
- [ ] A short bounded burst stays within expected rate limit; if limited,
      response is HTTP 429 with safe retry metadata.
- [ ] Gateway/CMS Core interruption produces bounded 502/503 behavior, not a
      hang; recovery works with the same active key.
- [ ] No response or log contains raw key, key hash, JWT, cookie, database URL,
      internal service token, provider credential or signed storage URL.

## API-07 — Cleanup (P0)

Standard authoring/publisher presets cannot delete entries. Cleanup therefore
requires one explicitly approved path: a user JWT with `cms.entry.delete`, the
existing local DB cleanup owned by the smoke harness, or a release-owner cleanup
action. Never silently broaden the supplied API key.

- [ ] Every created entry ID is soft-deleted through an approved path.
- [ ] Any uploaded object is deleted and no pending upload remains.
- [ ] No key was created/revoked/modified in the provided-key lane.
- [ ] Temporary response files and secret file are securely removed.
- [ ] Final list proves no `QA-CMS-API-*` test item remains visible.

# Agent-owned local full-matrix run

Use only against the local disposable stack. This script creates three keys,
validates DB actor fields and revokes/cleans up on exit:

```bash
cd /Users/archanray/xynes-erp/xynes/xynes-infra
./scripts/smoke-cms-api-key.sh --env-file .env.localhost
```

- [ ] `cms_readonly` positive reads and write denial pass.
- [ ] `cms_authoring` CRUD subset and publish/delete denial pass.
- [ ] `cms_publisher` publish/status transitions pass.
- [ ] Cross-workspace, unknown-key and revoked-key failures pass.
- [ ] User-JWT backwards compatibility passes.
- [ ] Gateway and CMS Core raw-key redaction passes.
- [ ] Script exits 0 and cleanup trap completes.

# Human-only key lifecycle verification

- [ ] Create the intended preset in Auth / Workspace Admin and confirm the raw
      key is shown exactly once.
- [ ] Copy affordance works without exposing the key elsewhere in the page.
- [ ] List view shows prefix/metadata but never raw key or hash.
- [ ] Usage/last-used metadata updates after the agent run without revealing
      request content or secret material.
- [ ] Expiry copy/timezone is understandable and expiration fails closed.
- [ ] Revoke a disposable key and confirm subsequent request is HTTP 401.
- [ ] CMS Integrations deep links open the correct workspace and preset.

# Results

| Area | Total | Pass | Fail | Blocked | Not Run |
|---|---:|---:|---:|---:|---:|
| Provided-key auth/read | | | | | |
| Provided-key write/lifecycle | | | | | |
| Isolation/security | | | | | |
| Local full matrix | | | | | |
| Human key lifecycle | | | | | |

**Provided preset/scopes:**
**Gateway/workspace:**
**Key prefix only:**
**Created entry IDs (non-secret):**
**Cleanup result:**
**Decision:** `Pass / Fail / Blocked`
**Bug links/notes:**

```text

```

## Exit criteria

- [ ] Every applicable P0 case passes.
- [ ] Every skipped case is explained by the supplied key's declared scope.
- [ ] No cross-workspace access, scope bypass, raw-key leak or partial mutation
      is observed.
- [ ] All disposable data is cleaned up.
- [ ] Report contains no secret-bearing artifact.
