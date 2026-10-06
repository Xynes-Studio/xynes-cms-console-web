import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cms-b1-generator-"));
  const sourceRoot = join(root, "source");
  const consumer = join(root, "consumer");
  mkdirSync(join(sourceRoot, "contracts"), { recursive: true });
  mkdirSync(join(consumer, "scripts"), { recursive: true });
  const source = join(sourceRoot, "contracts/cms-delivery.v1.json");
  writeFileSync(
    source,
    readFileSync("src/features/content-integrations/fixtures/cms-delivery.v1.json"),
  );
  const script = join(consumer, "scripts/generate-cms-delivery-contract.mjs");
  writeFileSync(script, readFileSync("scripts/generate-cms-delivery-contract.mjs"));
  const git = (args: string[]) => {
    const result = spawnSync("git", args, { cwd: sourceRoot, encoding: "utf8" });
    if (result.status !== 0) throw new Error("Owned Git fixture preparation failed");
    return result.stdout.trim();
  };
  git(["init", "-q"]);
  git(["add", "contracts/cms-delivery.v1.json"]);
  const tree = git(["write-tree"]);
  // Synthetic local objects only: no branch/product commit, hooks, signing or remote.
  const revision = git([
    "-c",
    "user.name=B1 fixture",
    "-c",
    "user.email=fixture@invalid",
    "-c",
    "commit.gpgsign=false",
    "commit-tree",
    tree,
    "-m",
    "fixture",
  ]);
  const run = (args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { root, source, consumer, revision, run };
}
describe("pinned contract generation", () => {
  it("reproduces all outputs and check mode is read-only", () => {
    const f = fixture();
    try {
      const args = ["--source", f.source, "--revision", f.revision];
      expect(f.run(args).status).toBe(0);
      const copy = join(
        f.consumer,
        "src/features/content-integrations/fixtures/cms-delivery.v1.json",
      );
      expect(readFileSync(copy)).toEqual(readFileSync(f.source));
      const before = readFileSync(copy);
      expect(f.run([...args, "--check"]).status).toBe(0);
      expect(readFileSync(copy)).toEqual(before);
      writeFileSync(copy, "{}\n");
      expect(f.run([...args, "--check"]).status).not.toBe(0);
      expect(readFileSync(copy, "utf8")).toBe("{}\n");
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
  it("rejects mutable source and missing/unpinned arguments without echo", () => {
    const f = fixture();
    try {
      for (const args of [
        [],
        ["--source", f.source],
        ["--source", f.source, "--revision", "develop"],
        ["--source", "--revision", f.revision],
      ]) {
        const result = f.run(args);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("ERROR: delivery mirror generation failed");
      }
      writeFileSync(f.source, '{"version":2,"secret":"must-not-echo"}');
      const result = f.run(["--source", f.source, "--revision", f.revision]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).not.toContain("must-not-echo");
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
});
