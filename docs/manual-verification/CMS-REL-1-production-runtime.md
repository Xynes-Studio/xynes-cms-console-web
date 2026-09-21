# CMS-REL-1 Production Runtime — Manual Verification

## Verification target

| Item | Value |
|---|---|
| Story | `CMS-REL-1` |
| Branch | `feature/cms-release-runtime-hardening` |
| Validated implementation commit | `79dd3a44c0d37033330a72dfe7882f2cee4439ae` |
| Local image | `xynesplatform/xynes-cms-console-web:local-test` |
| Image ID | `sha256:3357484c3db8df110c1339ab6ab5a619cc426362f823868b15b5260447f3665c` |
| Image size | 183,080,546 bytes |
| Scan tool | Trivy 0.66.0 |
| Recommendation | **READY FOR COMBINED LOCAL RELEASE VALIDATION** |

The implementation commit above is the immutable code revision used for the
recorded unit, coverage, production-build, image, security, and runtime checks.
This evidence document is committed afterward so it can cite that SHA exactly.
No deployment, image push, Git push, pull request, or merge was performed.

## Prerequisites

- Docker Desktop with BuildKit/buildx.
- Node.js 20-compatible tooling and Corepack.
- Chrome installed for the optional Playwright regression check.
- The sibling repositories under `/Users/archanray/xynes-erp/xynes-front-end/`
  at the revisions used by the branch.
- Run image builds from the `xynes-front-end/` parent directory because the CMS
  app consumes linked Auth SDK, i18n, and Lumia packages.
- Use only non-secret fixture values below. Never pass service tokens,
  service-role keys, raw API keys, or real credentials as build arguments.

## Automated evidence summary

| Gate | Fresh result |
|---|---|
| Lint | PASS — zero errors or warnings introduced |
| Strict TypeScript | PASS — zero errors |
| Unit/integration tests | PASS — 66/66 files, 762/762 tests |
| Coverage | PASS — statements 94.23%, branches 88.00%, functions 96.08%, lines 94.23% |
| Health modules | PASS — 100% statements, branches, functions, and lines |
| Focused health tests | PASS — 20/20 |
| Static runtime-contract tests | PASS — 7/7 |
| Host production build | PASS — standalone server emitted |
| Clean Docker production build | PASS |
| Runtime trace | PASS — zero dangling symlinks |
| Healthy runtime | PASS — HTTP 200 and Docker `healthy` |
| Degraded runtime | PASS — HTTP 503; Docker `unhealthy` after three accelerated local checks |
| Runtime hardening | PASS — UID/GID 1001, read-only root, writable `/tmp`, no-new-privileges |
| Trivy image scan | PASS — 0 HIGH, 0 CRITICAL, 0 secrets; no waiver required |
| Trivy source-context scan | PASS — no secret issues detected |
| Protected route | PASS — unauthenticated dashboard request returned 307 to the auth app |
| Optional Playwright read-only check | FOLLOW-UP — 18/19 in the full run; unchanged scroll case passed 3/5 isolated repetitions |

The Playwright item is not a CMS-REL-1 release-runtime failure: this story
explicitly assigns `playwright.config.ts`, `e2e/*`, the scroll implementation,
and final browser certification to CMS-REL-2. It is recorded below as a binding
combined-release follow-up and was not hidden with retries or out-of-scope edits.

## Build the exact local image

```bash
cd /Users/archanray/xynes-erp/xynes-front-end

docker buildx build \
  -f xynes-cms-console-web/Dockerfile \
  --target prod \
  --load \
  --build-arg XYNES_BUILD_VERSION=sha-local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://fixtures.supabase.local \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
  --build-arg NEXT_PUBLIC_API_URL=http://127.0.0.1:4100 \
  --build-arg NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  --build-arg NEXT_PUBLIC_AUTH_APP_URL=http://127.0.0.1:3100 \
  --build-arg NEXT_PUBLIC_ALLOWED_REDIRECT_DOMAINS=127.0.0.1:3000,127.0.0.1:3100 \
  -t xynesplatform/xynes-cms-console-web:local-test \
  .
```

Expected: the build completes, `next build` lists `/api/health`, and the final
stage is tagged locally. Omitting any required public build argument or
`XYNES_BUILD_VERSION` must fail before dependency installation.

Inspect the result:

```bash
docker image inspect xynesplatform/xynes-cms-console-web:local-test \
  --format 'id={{.Id}} size={{.Size}} user={{.Config.User}} health={{json .Config.Healthcheck}}'

docker run --rm --entrypoint find \
  xynesplatform/xynes-cms-console-web:local-test \
  -L /app -type l -print
```

Expected:

- user is `nextjs`;
- health timing is 30-second interval, 5-second timeout, 15-second start period,
  and three retries;
- the health command calls `http://127.0.0.1:3000/api/health`;
- the dangling-link command prints nothing.

## Healthy runtime verification

Create an isolated network and a deterministic one-hop gateway stub:

```bash
docker network create cms-rel-1-test

docker run -d \
  --name cms-rel-1-gateway \
  --network cms-rel-1-test \
  node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 \
  node -e 'require("http").createServer((req,res)=>{if(req.url==="/health"){res.writeHead(200,{"Content-Type":"application/json"});res.end("{\"ok\":true}");return}res.writeHead(404);res.end()}).listen(4100,"0.0.0.0")'

docker run -d \
  --name cms-rel-1-console \
  --network cms-rel-1-test \
  -p 127.0.0.1:3300:3000 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --security-opt no-new-privileges:true \
  -e NEXT_API_URL=http://cms-rel-1-gateway:4100 \
  xynesplatform/xynes-cms-console-web:local-test
```

Check health and Docker state:

```bash
curl -i http://127.0.0.1:3300/api/health

docker inspect cms-rel-1-console \
  --format 'status={{.State.Status}} health={{.State.Health.Status}} readonly={{.HostConfig.ReadonlyRootfs}} user={{.Config.User}} security={{json .HostConfig.SecurityOpt}}'
```

Expected response (uptime varies):

```http
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{"ok":true,"service":"xynes-cms-console-web","version":"sha-local","uptime_seconds":42,"checks":{"gateway":"ok"}}
```

Expected Docker state: `running`, `healthy`, `readonly=true`, user `nextjs`,
and `no-new-privileges:true`.

## Public, static, and protected-route checks

```bash
curl -o /dev/null -w 'landing=%{http_code}\n' http://127.0.0.1:3300/
curl -o /dev/null -w 'security=%{http_code}\n' http://127.0.0.1:3300/SECURITY.md
curl -o /dev/null -D - http://127.0.0.1:3300/dashboard/xynes-studio-llp/content

docker exec cms-rel-1-console sh -c \
  'asset=$(find .next/static/chunks -type f -name "*.js" | head -n 1); wget -qO- "http://127.0.0.1:3000/_next/static/chunks/${asset##*/}" >/dev/null; echo static_chunk=200'
```

Expected:

- landing: 200;
- `SECURITY.md`: 200;
- a generated JavaScript chunk: 200;
- unauthenticated dashboard: 307 redirect to the configured auth app.

## Non-root and read-only checks

```bash
docker exec cms-rel-1-console sh -c \
  'id; if touch /app/should-fail 2>/dev/null; then echo app_write=unexpected-success; else echo app_write=rejected; fi; touch /tmp/write-ok; test -f /tmp/write-ok; echo tmp_write=ok'
```

Expected:

```text
uid=1001(nextjs) gid=1001(nodejs) groups=1001(nodejs)
app_write=rejected
tmp_write=ok
```

## Degraded runtime and failure-cache checks

```bash
docker stop cms-rel-1-gateway

curl -sS -o /tmp/cms-health-first.json \
  -w 'status=%{http_code} seconds=%{time_total}\n' \
  http://127.0.0.1:3300/api/health

curl -sS -o /tmp/cms-health-cached.json \
  -w 'status=%{http_code} seconds=%{time_total}\n' \
  http://127.0.0.1:3300/api/health
```

Expected body (uptime varies and no infrastructure detail is allowed):

```json
{"ok":false,"service":"xynes-cms-console-web","version":"sha-local","uptime_seconds":63,"checks":{"gateway":"fail"}}
```

Both calls must return 503. The second call should be materially faster because
the failed result is cached for 30 seconds. The recorded final-image run was
50 ms for the first call and 18 ms for the cached call.

To prove Docker reaches `unhealthy` without waiting for the binding production
interval, recreate only the local test container with an accelerated override:

```bash
docker rm -f cms-rel-1-console

docker run -d \
  --name cms-rel-1-console \
  --network cms-rel-1-test \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --security-opt no-new-privileges:true \
  --health-interval=1s \
  --health-timeout=1s \
  --health-start-period=1s \
  --health-retries=3 \
  -e NEXT_API_URL=http://cms-rel-1-gateway:4100 \
  xynesplatform/xynes-cms-console-web:local-test

docker inspect cms-rel-1-console \
  --format 'health={{.State.Health.Status}} failing_streak={{.State.Health.FailingStreak}}'
```

Expected after several seconds: `health=unhealthy` and a failing streak of at
least three. This runtime-only override does not change the baked image timing.

## Vulnerability and secret scan

The recorded verification used the pinned Trivy 0.66.0 image and its cached
database:

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v trivy-cache:/root/.cache \
  aquasec/trivy:0.66.0 image \
  --skip-db-update \
  --scanners vuln,secret \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  xynesplatform/xynes-cms-console-web:local-test
```

Recorded result: Alpine packages 0 HIGH/CRITICAL; Node packages 0
HIGH/CRITICAL; 0 secret findings; exit code 0. There are no waivers and no
`CVE-WAIVERS.md` because every reported HIGH issue was fixed in the image.

The source context was also scanned read-only, excluding dependency and
generated-output directories:

```bash
docker run --rm \
  -v /Users/archanray/xynes-erp/xynes-front-end/xynes-cms-console-web:/workspace:ro \
  -v trivy-cache:/root/.cache \
  aquasec/trivy:0.66.0 fs \
  --skip-db-update \
  --scanners secret \
  --skip-dirs node_modules \
  --skip-dirs .next \
  --skip-dirs coverage \
  --skip-dirs test-results \
  --exit-code 1 \
  /workspace
```

Recorded source result: `No issues detected`, exit code 0.

## Acceptance matrix

| ID | Acceptance criterion | Evidence | Result |
|---|---|---|---|
| H-01 | Public `/api/health`, no auth/cookie required | Direct unauthenticated curl | PASS |
| H-02 | Healthy 200 and JSON UTF-8 | Final-image headers/body | PASS |
| H-03 | Degraded 503, same schema | Gateway-stop runtime check | PASS |
| H-04 | Exact top-level body keys | Unit schema assertions | PASS |
| H-05 | Exact service name | Unit and runtime body | PASS |
| H-06 | Build version with development-only fallback | Unit tests and production fail-closed tests | PASS |
| H-07 | Non-negative integer uptime | Unit tests and runtime body | PASS |
| H-08 | Only `checks.gateway=ok|fail` | Closed type and exact-key tests | PASS |
| H-09 | Probe only `${NEXT_API_URL}/health` | Fetch-spy assertion and gateway stub | PASS |
| H-10 | One-second timeout and 30-second failure cache | Fake-timer/cache tests; 50 ms then 18 ms runtime | PASS |
| H-11 | `Cache-Control: no-store` | Route test and final-image headers | PASS |
| H-12 | No URL/token/env/error/path/request/upstream leak | Hostile-error and exact-key tests | PASS |
| H-13 | At least eight focused assertions | 20 focused health tests | PASS |
| I-01 | Next standalone output | `next.config.ts`; successful host/container builds | PASS |
| I-02 | Sibling trace without unrelated runtime data | frontend tracing root; final `/app` inspection | PASS |
| I-03 | Runnable standalone server | `.next/standalone/xynes-cms-console-web/server.js` exists | PASS |
| I-04 | Public and static copied | Both returned 200 from final image | PASS |
| I-05 | Parent context and local Dockerfile | Clean canonical build succeeded | PASS |
| I-06 | Ignore Git/env/dependencies/tests/coverage/caches | Static contract test and context filter | PASS |
| I-07 | Pinned package manager and frozen lockfiles | Static contract test and clean build log | PASS |
| I-08 | Port 3000 on `0.0.0.0` | Image config and live runtime | PASS |
| I-09 | Standalone server runs non-root | UID/GID 1001 check | PASS |
| I-10 | Exact 30s/5s/15s/3 Docker healthcheck | Image inspection | PASS |
| I-11 | Healthy/unhealthy dependency behavior | Gateway-up/down checks | PASS |
| I-12 | Read-only root, writable `/tmp`, no-new-privileges | Live write and inspect checks | PASS |
| I-13 | No dangling runtime symlinks | `find -L /app -type l` returned empty | PASS |
| I-14 | Zero unwaived HIGH/CRITICAL findings and clean secret scans | Trivy 0.66.0 image/source exit 0; no waivers | PASS |
| R-01 | Existing functional unit suites remain green | 66/66 files, 762/762 tests | PASS |
| R-02 | Strict TypeScript | `corepack pnpm exec tsc --noEmit` | PASS |
| R-03 | Overall coverage at least 80% on every axis | 94.23/88.00/96.08/94.23% | PASS |
| R-04 | Touched modules at least 80%; health target 100% | Health modules 100% on every axis | PASS |
| R-05 | README contains complete runtime runbook | Production image and health section | PASS |
| R-06 | No deploy, rollout, push, PR, or merge | Local branch and local image only | PASS |

## Human pass/fail checklist

- [ ] Confirm the branch and validated implementation SHA match the table.
- [ ] Build with only the documented non-secret fixture values.
- [ ] Confirm missing required build arguments fail closed.
- [ ] Confirm image user, size, command, and health timing.
- [ ] Confirm no dangling symlinks are printed.
- [ ] Start the gateway stub and hardened CMS container.
- [ ] Confirm `/api/health` is 200 with the exact five-key schema.
- [ ] Confirm the response exposes no internal URL, error, token, or stack.
- [ ] Confirm landing, public static file, and generated chunk return 200.
- [ ] Confirm a protected dashboard route redirects to the auth app.
- [ ] Confirm UID/GID 1001 and read-only `/app` behavior.
- [ ] Stop the gateway and confirm fast 503 plus cached second response.
- [ ] Confirm the accelerated local health schedule reaches `unhealthy`.
- [ ] Run Trivy and confirm zero HIGH, CRITICAL, and secret findings.
- [ ] Complete CMS-REL-2 browser/CI certification, including the scroll flake
      below, before any release decision.
- [ ] Clean up only the disposable verification resources.

## Cleanup and rollback

Remove only the named disposable resources:

```bash
docker rm -f cms-rel-1-console cms-rel-1-gateway
docker network rm cms-rel-1-test
```

Optionally remove only the local test tag after verification:

```bash
docker image rm xynesplatform/xynes-cms-console-web:local-test
```

No database migration or data mutation was part of this story. A pre-work
custom-format local backup remains outside Git at:

```text
/private/tmp/xynes-cms-rel-1-prework-20260921.dump
SHA-256: fdaa77c1846931d307d1c5a3338cca0ea4836b0dd8dd3740339498c733846dbb
```

Its restore was rehearsed into isolated database
`cms_rel_1_restore_verify_20260921` using the matching PostgreSQL 17.4 tooling
and `supabase_admin`; source and restored counts matched at 77 user tables and
17 Supabase migration records. The rehearsal database was removed. Retain the
backup until combined local release validation is accepted.

To leave this work without deleting it:

```bash
git switch develop
```

Do not reset or delete the feature branch until the combined validation owner
has accepted the implementation and this evidence.

## Known limitations and follow-ups

1. Deployment, Compose rollout, image push, hosted smoke, PR, and merge are
   intentionally deferred.
2. CMS-REL-2 must finish CI quality gates, proxy migration, and browser
   certification.
3. CMS-REL-2 must stabilize or correct the existing scroll-layout browser
   case at `e2e/cms-dashboard-scroll-layout.spec.ts:75`. Final evidence:
   full suite 18/19; exact isolated case 3/5. It intermittently fails because
   the secondary toolbar never receives `aria-hidden="true"` after the two
   synthetic scroll events. Do not mask it with blind retries.
4. The Next.js middleware deprecation warning is pre-existing and is explicitly
   owned by the CMS-REL-2 proxy-migration slice.

## Final recommendation

**READY FOR COMBINED LOCAL RELEASE VALIDATION.** CMS-REL-1's production runtime,
health contract, container hardening, security scan, tests, coverage, and local
manual checks are complete. The application is not yet release-certified until
CMS-REL-2 completes its independent CI/browser work and resolves the documented
Playwright scroll flake. No deployment should occur from this story alone.
