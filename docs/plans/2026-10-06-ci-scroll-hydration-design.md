# CMS browser verification hydration readiness

October 6, 2026. Scoped repair for the new sibling-pin PR #54 hosted check.

The initial hosted combined quality run [37475533143](https://github.com/Xynes-Studio/xynes-cms-console-web/actions/runs/37475533143) passed both 891-test runs, coverage, lint/types and production build, but one of 32 browser tests failed on all three attempts. Its retained trace shows the results region already at scrollTop 24 while the secondary toolbar shell has no inline height. Five seconds later the shell has its client-measured 70px height, but the row is still visible. The synthetic pre-hydration scroll events were not replayed to the React onScroll handler. Visibility of server-rendered HTML does not establish interactive readiness.

Use the existing hook's positive inline max-height measurement as the readiness condition before the failing test records the primary row position and emits scroll events. The measurement is set by useLayoutEffect after the client mounts and event handlers attach. Retain the original 20/24 downward and 20 upward sequence, hide/reopen, pinned position and independent sidebar scrolling assertions.

Alternatives: increasing timeouts/retrying the unchanged test cannot recover lost events; adding a runtime hydration flag would modify production/fixture code unnecessarily. Polling the existing client-only measured style provides a specific observable readiness condition with the existing assertion timeout. No new sleeps, retries, timeout changes, runtime behavior or dependency changes.

Validate the targeted browser scenario repeatedly without retries, then all 32 browser cases, native lint and TypeScript. Retain the failed hosted log/trace and rerun all published exact-head gates after the scoped test fix. Test-only changes add no instrumented runtime coverage; existing coverage gates remain unchanged.

## Local reviewer outcome

The repair changes only the existing browser test's readiness condition. The original hide/reopen, scroll sequence, pinned position and sidebar overflow assertions remain unchanged. On Node 22.22.0/pnpm 10.33.0, native `pnpm exec eslint .` and `pnpm exec tsc --noEmit` pass. `pnpm exec playwright test e2e/cms-dashboard-scroll-layout.spec.ts --grep "keeps the primary toolbar pinned" --repeat-each 5 --retries 0` passes 5/5 in 26.8 seconds; full `pnpm exec playwright test` passes 32/32 in 54.0 seconds on inert local fixtures. The owned port-3200 server stopped after the suite. No runtime source, threshold, test assertion, timeout or retry policy was relaxed. Logs/results and the original failed hosted trace are retained under `/private/tmp/xynes-security-goal/post-merge-pins/publication/`. New exact-head hosted checks must pass after publication.
