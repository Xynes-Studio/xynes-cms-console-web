# CMS-INT-B1 Reusable Request Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce correct, safe delivery URLs/snippets and static projected examples from the frozen A1 contract, for reuse by folder/card/editor hosts and A5 verification.

**Architecture:** One pure validated request model drives two metadata-backed resource adapters and output formatting. A reproducible source generator copies the actual pinned JSON artifact and emits literal TypeScript metadata. Runtime modules use existing Zod/URL APIs, never Node, network, browser state or credentials. B2/B3 own UI, Lumia/i18n/focus and rollout.

**Tech Stack:** Next.js16/TypeScript strict, existing Zod4, pnpm10, Vitest4/V8, Node stdlib for generation only.

---

## Scope and protection

- Target repo: CMS console. New branch feature/CMS-INT-B1-request-engine, base develop5d34eb4, isolated worktree; original dirty docs/planning files untouched.
- A1 source: platform-contracts141e32a21deccfbb6711c2cbc770bffaf983b791, contracts/cms-delivery.v1.json. No backend/contracts/DS changes.
- No UI routes/components, auth/key lifecycle, feature flag enabling, database changes, deployment, commit, push or PR.
- Existing Next guide confirms pure modules need no client directive; both server and client hosts can consume them.

## Task 1: baseline and contract tests

Infer package scripts and coverage gate85%. Run actual pnpm test/lint/typecheck with non-secret CI settings. Inspect Next/DS/i18n/feature conventions. Add failing delivery-contract tests for actual mirror/digest/version, deep immutability, runtime contract parsing, static response shape and projected example semantics. Add an explicit generator using Node builtins and pinned source-byte verification; generated constants/types are not hand-maintained duplicates.

## Task 2: request engine TDD

Create types.ts, resource-adapters.ts and build-request.ts under src/features/content-integrations. Add failing cases before implementation for default directory/detail, options/bounds/fields, ID inclusion, exact query/path encoding, legitimate gateway prefix, missing/unsafe/credentialed origin and malicious reserved/prototype values. Reject invalid supplied filters instead of dropping them. Keep errors as stable localization-ready codes with no input echo.

Context carries public origin, validated workspace/resource IDs and presentation labels; accepts no key/JWT. Unknown or inappropriate entry options fail. HTTP is restricted to documented exact loopback hosts; hosted origins use HTTPS and exclude private/service hosts. Domain validation is lexical; no DNS/network lookup.

## Task 3: snippet and example TDD

Create snippets.ts and index.ts. Generate URL, shell-safe cURL with ${XYNES_API_KEY} Authorization placeholder and labelled server-side fetch with process.env.XYNES_API_KEY plus HTTP/envelope error checks. No evaluation of code, scripts, SDKs or live secrets. Test quotes/newlines in labels cannot affect URLs/code. Static examples/field table use checked-in contract fixtures; their wrapper explicitly labels them static and matches the selected projection. No editor data is copied into examples.

## Task 4: verification, docs and A5 handoff

Run focused tests, full suite, configured85% coverage, per-file branch evidence, lint, strict typecheck and actual production build. No browser visual gate is needed because B1 adds no rendered UI. Review security/types; document remaining baseline debt if any. Provide exact exported APIs/model/mirror path/digest for A5. B1 remains uncommitted until authorized; A5's final immutable revision proof waits for the actual B commit/PR. Preserve A5's in-progress work.

## Execution notes

- Baseline:788 tests, lint/typecheck pass. Env-loader symlink invocation initially
  executed no command; the owned support directory now copies the unchanged loader
  so actual repo scripts run. No primary infra code/env was modified.
- Failing implementation/import tests preceded engine work. Further regressions
  caught missing cURL header name, inherited target acceptance, metadata-array
  drift and malformed-success acceptance; each was corrected and rerun.
- Independent review found no blockers. Nonblocking URL-policy notes were
  tightened with eight failing/passing tests: raw HTTP aliases, empty userinfo
  and special IPv6 forms. All documented public gateways remain supported.
- Generator test exposed macOS /var versus /private/var alias mismatch; canonical
  source paths fixed it. Generator tests use synthetic owned Git objects only.
- Final focused suite:100 tests (four files); full suite888/888 pass. Configured
  85% coverage gate, lint, strict typecheck and production build pass after all changes. No UI/browser, DB, commit, push, PR or deployment in this story.

- Final independent follow-up: no blockers. A5 handoff and measured frontend report saved. Source remains uncommitted; no remote publication or rollout.
