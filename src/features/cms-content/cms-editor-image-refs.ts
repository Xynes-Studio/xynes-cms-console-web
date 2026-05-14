/**
 * STORAGE-11 — editor body image normalisation.
 *
 * Owner plan: `xynes/xynes-infra/docs/plans/2026-05-10-universal-object-storage-file-upload-api.md`
 *
 * What this module owns
 * ─────────────────────
 *   - `stripTransientImageUrls(body)` walks the Lumia editor body, finds
 *     `image-block` nodes that carry a stable `objectId`, and clears the
 *     transient `src` field before persistence. The runtime resolver
 *     (`useStorageUploadAdapter().resolveDownloadUrl`) refills `src` on the
 *     next mount.
 *   - `collectMediaObjectIds(body)` returns the set of storage object ids
 *     referenced by image-block nodes in the body. Used by the editor for
 *     telemetry / future cross-references but not strictly required for
 *     persistence.
 *
 * Security invariants
 * ───────────────────
 *   - The normaliser never persists signed download URLs, blob URLs, or
 *     provider URLs into the body when an `objectId` is present.
 *   - Image-block nodes WITHOUT an `objectId` (e.g. legacy image-from-URL
 *     entries) keep their `src` byte-for-byte — we do not blank a URL that
 *     has no replacement contract.
 *   - The walker is depth-bounded and does not mutate its input. Output is
 *     a fresh JSON-cloned tree so the caller can safely persist without
 *     accidentally aliasing editor state.
 */

const MAX_WALK_DEPTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageBlockNode(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    value.type === "image-block"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Walk a Lumia editor body tree and apply `visit` to every node. The
 * walker is depth-bounded so a hostile editor state (deep cycle, runaway
 * recursion) can't pin the CPU. Returns a deep-cloned tree.
 */
function transformBody(
  value: unknown,
  visit: (node: Record<string, unknown>) => Record<string, unknown>,
  depth: number,
): unknown {
  if (depth > MAX_WALK_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => transformBody(item, visit, depth + 1));
  }
  if (isRecord(value)) {
    const transformed = visit(value);
    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(transformed)) {
      const child = transformed[key];
      cloned[key] = transformBody(child, visit, depth + 1);
    }
    return cloned;
  }
  return value;
}

/**
 * Walk a Lumia editor body tree and collect every node matching `match`.
 * Read-only — does not clone.
 */
function walkBody(
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
  depth: number,
): void {
  if (depth > MAX_WALK_DEPTH) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      walkBody(item, visit, depth + 1);
    }
    return;
  }
  if (isRecord(value)) {
    visit(value);
    for (const key of Object.keys(value)) {
      walkBody(value[key], visit, depth + 1);
    }
  }
}

/**
 * Returns a deep-cloned copy of `body` where every image-block node that
 * carries an `objectId` has its `src` cleared to an empty string. Nodes
 * without an `objectId` are left byte-for-byte (legacy image-from-URL
 * entries continue to carry their public URL).
 *
 * STORAGE-11 invariant: the persisted entry body MUST NOT carry signed
 * delivery URLs. The runtime resolver re-mints a fresh URL on next load.
 *
 * The return type is the same shape as the input: a `Record<string, unknown>`
 * editor body (the common case). Non-record inputs (rare) are passed through
 * untouched but typed as `unknown` for the caller to handle.
 */
export function stripTransientImageUrls<T>(body: T): T {
  return transformBody(
    body,
    (node) => {
      if (!isImageBlockNode(node)) return node;
      const objectId = node.objectId;
      if (!isNonEmptyString(objectId)) return node;
      // Replace the transient src with an empty string. We deliberately
      // keep the `src` key present (instead of deleting it) so the
      // Lumia editor's importJSON contract — which expects `src: string`
      // — stays satisfied for storage-backed images.
      return { ...node, src: "" };
    },
    0,
  ) as T;
}

/**
 * Collect every `objectId` referenced by image-block nodes in the body.
 * Returns a deduplicated array preserving first-seen order.
 */
export function collectMediaObjectIds(body: unknown): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  walkBody(
    body,
    (node) => {
      if (!isImageBlockNode(node)) return;
      const objectId = node.objectId;
      if (!isNonEmptyString(objectId)) return;
      if (seen.has(objectId)) return;
      seen.add(objectId);
      out.push(objectId);
    },
    0,
  );
  return out;
}
