# CMS integration guidance and recovery

The four content integration entry points use offline, credential-free examples. Workspace Admin owns keys; CMS provides status/counts and links with `cms_readonly` preselected. Counts describe active unexpired metadata, not the readiness of a particular key, route or published entry. A new Publisher includes published reads and draft/publish capabilities; a stored older key retains its actual scopes. Inspect its allowed actions in Workspace Admin. Recover older keys by explicit Workspace Admin replacement, verify the consumer, then revoke the old key. Keys and scheduled work remain workspace-owned after creator offboarding until explicitly revoked/cancelled.

Server `deliveryState` controls snapshot availability. Newer saved timestamps, including subsecond edits, are draft-change guidance only. Unknown delivery state never implies an available snapshot; republish-required, draft, scheduled and archived states have distinct guidance. Saving retains the last valid snapshot; republishing exposes the new revision. Moving changes published folder membership only on republish. Unpublish/archive/delete withdraw delivery. Human read_only retains current draft visibility; published API-key delivery remains snapshot-only.

Use the exact copied list/detail URL and keep credentials in private server-side configuration. For troubleshooting, replace the copied cURL `--fail` option with `--fail-with-body` so its safe error body is available:

```bash
curl --fail-with-body --silent --show-error --request GET \
  --url "$CMS_DELIVERY_URL" \
  --header "Authorization: Bearer ${XYNES_API_KEY}"
```

A missing/invalid key yields 401; conflicting API-key headers yield 400; insufficient scopes or another workspace yield 403. Protected delivery `ENTRY_NOT_FOUND` is distinct from a generic gateway route 404. Malformed upstream success is a gateway 502. Do not infer foreign/draft existence from public errors, substitute a draft endpoint, weaken scope/signature checks, stamp snapshot validity, or publish historical real content to recover a read.

Public legacy reads retain a separate compatibility contract. These examples do not check a live key or route and do not certify hosted deployment or real media providers. Full runtime acceptance uses synthetic content, real human issuance, persisted scopes and the signed gateway/service pipeline. See the infra deployment/recovery guide for scoped RBAC dry-run/apply/reversal and compatibility order.
