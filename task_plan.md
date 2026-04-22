# Task Plan

Goal: implement `CMS-UI-008` in `xynes-cms-console-web` with test-first
changes that preserve existing editor behavior while tightening autosave,
publish sequencing, and unsaved-change guard semantics.

1. Re-read the approved `CMS-UI-008` spec and current editor/autosave tests.
2. Add failing tests for deterministic autosave flush semantics.
3. Add failing editor-screen tests for save-before-publish and guarded back
   navigation.
4. Implement the smallest hook and screen changes needed to satisfy the new
   tests without reshaping route or layout ownership.
5. Re-run targeted tests, then run coverage and lint for verification.
6. Summarize final behavior, coverage, and any residual risks.
