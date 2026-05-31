import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * BUG-CMS-9 — Dashboard shell contract regression guard.
 *
 * After BUG-LDS-1 landed (Lumia DS `DashboardShell` now owns viewport-locked
 * scroll containment), no CMS Console route that mounts inside the shell may
 * reintroduce shell-bypassing layout primitives (`fixed inset-0`,
 * `min-h-screen`, `h-screen`, document-level `overflow-hidden`). The shell's
 * right pane is the single scroll authority; panel-internal `overflow-y-auto`
 * is fine because it scopes to a bounded container inside the pane.
 *
 * This test fails the build if a new shell-bypass appears in:
 *   - `app/dashboard/[workspaceSlug]/**` (anything inside the workspace shell)
 *   - `src/components/dashboard/**` + `src/features/**` (panels rendered into
 *     the shell's right pane)
 *
 * Documented escape hatches (allowlist below):
 *   1. Editor full-screen overlay (`app/dashboard/[workspaceSlug]/content/
 *      entry/[entryId]/edit/layout.tsx`) — intentional focused-writing mode.
 *   2. Pre-auth / loading fallback `<main>` blocks inside `CmsDashboardShell`
 *      (no shell mounted there).
 *   3. Toolbar collapsible-row `overflow-hidden` (animation transition, not
 *      a viewport-scroll escape).
 *
 * If you need to add a new escape hatch, document it in
 * `docs/DEVELOPER.md` ("Dashboard shell contract (BUG-CMS-9)") and extend the
 * allowlist below in the same PR.
 */

const REPO_ROOT = resolve(__dirname, "..");

const SCAN_DIRS = [
  // Anything under `[workspaceSlug]/**` is mounted INSIDE `<CmsDashboardShell>`
  // via `app/dashboard/[workspaceSlug]/layout.tsx`. Top-level redirector pages
  // (`app/dashboard/page.tsx`, `app/dashboard/current/**`) sit OUTSIDE the
  // shell and are intentionally excluded from this scan — their
  // `min-h-screen` centering is correct.
  "app/dashboard/[workspaceSlug]",
  // Shell wrapper itself + panels rendered into the shell's right pane.
  "src/components/dashboard",
  "src/features",
];

// Patterns that, if found OUTSIDE the allowlist, indicate a shell-bypass.
const SHELL_BYPASS_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  // Fullscreen overlay escapes the shell's right pane entirely.
  { name: "fixed inset-0", regex: /\bfixed\b[^"`'\n]*\binset-0\b/ },
  // Document-grow primitives (post-BUG-LDS-1, the shell owns viewport height).
  { name: "min-h-screen", regex: /\bmin-h-screen\b/ },
  // `h-screen` uses a negative lookbehind so it doesn't double-count the
  // `h-screen` substring inside `min-h-screen` (Tailwind treats them as
  // distinct utilities; we want each to be reported on its own line at most).
  { name: "h-screen", regex: /(?<!min-)\bh-screen\b/ },
];

// Files (relative to repo root) where a bypass is intentional + documented.
// Every entry MUST have a corresponding bullet under "Documented escape hatches"
// in `docs/DEVELOPER.md` → "Dashboard shell contract (BUG-CMS-9)".
const ALLOWLIST = new Set<string>([
  // Editor full-screen overlay — documented escape hatch.
  "app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/layout.tsx",
  // Pre-auth / loading fallback blocks inside the shell wrapper (no shell
  // is mounted in these branches; `min-h-screen` is correct here).
  "src/components/dashboard/CmsDashboardShell.tsx",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      // Skip nested __tests__, .next, node_modules just in case.
      if (
        entry === "node_modules" ||
        entry === ".next" ||
        entry === "coverage"
      ) {
        continue;
      }
      walk(full, out);
      continue;
    }
    if (!stats.isFile()) continue;
    const dot = entry.lastIndexOf(".");
    if (dot < 0) continue;
    const ext = entry.slice(dot);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    // Skip test files — they often grep for these tokens in assertions.
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
    out.push(full);
  }
}

function collectShellRouteFiles(): string[] {
  const files: string[] = [];
  for (const subdir of SCAN_DIRS) {
    const absolute = join(REPO_ROOT, subdir);
    try {
      if (!statSync(absolute).isDirectory()) continue;
    } catch {
      continue;
    }
    walk(absolute, files);
  }
  return files;
}

describe("BUG-CMS-9 — Dashboard shell contract", () => {
  it("contains no shell-bypassing layout primitive outside the documented allowlist", () => {
    const offenders: Array<{
      file: string;
      pattern: string;
      line: number;
      text: string;
    }> = [];

    for (const absolutePath of collectShellRouteFiles()) {
      const relPath = relative(REPO_ROOT, absolutePath);
      if (ALLOWLIST.has(relPath)) continue;

      const source = readFileSync(absolutePath, "utf8");
      const lines = source.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { name, regex } of SHELL_BYPASS_PATTERNS) {
          if (regex.test(line)) {
            offenders.push({
              file: relPath,
              pattern: name,
              line: i + 1,
              text: line.trim(),
            });
          }
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map(
          (o) =>
            `  - ${o.file}:${o.line} → "${o.pattern}"\n      ${o.text}`,
        )
        .join("\n");
      throw new Error(
        `BUG-CMS-9 shell contract violated: shell-bypassing primitives found ` +
          `outside the documented allowlist. Either remove them, or add the ` +
          `file to ALLOWLIST + document the rationale in ` +
          `docs/DEVELOPER.md "Dashboard shell contract (BUG-CMS-9)".\n${report}`,
      );
    }

    expect(offenders).toEqual([]);
  });

  it("editor full-screen overlay (the documented escape hatch) is still in place", () => {
    // Sanity check: the allowlisted editor layout must actually contain the
    // documented full-screen wrapper. If a future refactor moves the overlay
    // elsewhere, this fails loudly so the allowlist + docs get updated.
    const editorLayoutPath = join(
      REPO_ROOT,
      "app/dashboard/[workspaceSlug]/content/entry/[entryId]/edit/layout.tsx",
    );
    const source = readFileSync(editorLayoutPath, "utf8");
    expect(source).toMatch(/\bfixed\b[^"`'\n]*\binset-0\b/);
    expect(source).toContain("z-50");
  });
});
