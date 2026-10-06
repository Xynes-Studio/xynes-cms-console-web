import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function required(flag) {
  const index = args.indexOf(flag);
  const value = index < 0 ? undefined : args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Required ${flag}`);
  return value;
}
try {
  const source = realpathSync(required("--source"));
  const revision = required("--revision");
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Use a full immutable source revision");
  const sourceRoot = execFileSync(
    "git",
    ["-C", path.dirname(source), "rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  ).trim();
  const relative = path.relative(sourceRoot, source).split(path.sep).join("/");
  if (relative !== "contracts/cms-delivery.v1.json")
    throw new Error("Unsupported source artifact path");
  const bytes = readFileSync(source);
  const pinned = execFileSync("git", ["-C", sourceRoot, "show", `${revision}:${relative}`]);
  if (!bytes.equals(pinned)) throw new Error("Source differs from pinned artifact");
  const contract = JSON.parse(bytes.toString("utf8"));
  if (contract.version !== 1) throw new Error("Unsupported delivery contract version");
  const metadata = {
    version: contract.version,
    repository: "Xynes-Studio/xynes-platform-contracts",
    revision,
    path: relative,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const outputs = {
    "fixtures/cms-delivery.v1.json": bytes,
    "fixtures/cms-delivery.v1.source.json": JSON.stringify(metadata, null, 2) + "\n",
    "delivery-contract.generated.ts":
      "// Generated from the pinned A1 artifact. Do not edit by hand.\nexport const GENERATED_DELIVERY_CONTRACT = " +
      JSON.stringify(contract, null, 2) +
      " as const;\n",
  };
  const folder = path.join(root, "src/features/content-integrations");
  for (const [relativePath, contents] of Object.entries(outputs)) {
    const file = path.join(folder, relativePath);
    if (args.includes("--check")) {
      if (!readFileSync(file).equals(Buffer.from(contents)))
        throw new Error("Generated delivery mirror is stale");
    } else {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, contents);
    }
  }
  console.log(
    args.includes("--check")
      ? "PASS: delivery mirror matches pinned source"
      : "Generated delivery mirror from pinned source",
  );
} catch {
  console.error(
    "ERROR: delivery mirror generation failed; verify source path, immutable revision and generated files",
  );
  process.exitCode = 1;
}
