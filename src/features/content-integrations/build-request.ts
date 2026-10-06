import { z } from "zod";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import { parseGatewayBase } from "./gateway-origin";
import {
  adaptDirectoryResource,
  adaptEntryResource,
  DirectoryOptionsSchema,
  EntryOptionsSchema,
} from "./resource-adapters";
import type {
  IntegrationRequest,
  IntegrationRequestErrorCode,
  IntegrationRequestResult,
} from "./types";
const label = z.string().max(2000);
const ContextSchema = z.strictObject({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(1).max(200),
  apiBaseUrl: z.string(),
  target: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("directory"),
      directoryId: z.string().uuid(),
      label,
      breadcrumb: label,
    }),
    z.strictObject({ kind: z.literal("entry"), entryId: z.string().uuid(), label }),
  ]),
  publicationState: z
    .enum(["draft", "scheduled", "published", "published-with-changes", "archived"])
    .optional(),
  deliveryState: z.enum([...DELIVERY_CONTRACT.deliveryStates, "unknown"]).optional(),
});
function plainObject(value: unknown): value is object {
  return (
    value !== null &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function failure(code: IntegrationRequestErrorCode): IntegrationRequestResult {
  return { ok: false, error: { code } };
}
function withUrl(base: URL, path: string, query: URLSearchParams) {
  base.pathname = base.pathname.replace(/\/+$/, "") + path;
  base.search = query.toString();
  return base.href;
}
/** Input boundary: returns only safe error codes; never reads keys/env/browser state. */
export function buildIntegrationRequest(
  input: unknown,
  inputOptions: unknown = {},
): IntegrationRequestResult {
  if (!plainObject(input)) return failure("INVALID_CONTEXT");
  if (!Object.hasOwn(input, "target")) return failure("INVALID_CONTEXT");
  const rawTarget: unknown = Reflect.get(input, "target");
  if (!plainObject(rawTarget)) return failure("INVALID_CONTEXT");
  const context = ContextSchema.safeParse(input);
  if (!context.success) return failure("INVALID_CONTEXT");
  if (!plainObject(inputOptions)) return failure("INVALID_OPTIONS");
  const base = parseGatewayBase(context.data.apiBaseUrl);
  if (!base) return failure("INVALID_API_BASE_URL");
  const { workspaceId, target } = context.data;
  const headers = Object.freeze({ Authorization: "Bearer ${XYNES_API_KEY}" as const });
  let request: IntegrationRequest;
  if (target.kind === "directory") {
    const parsed = DirectoryOptionsSchema.safeParse(inputOptions);
    if (!parsed.success) return failure("INVALID_OPTIONS");
    const resource = adaptDirectoryResource(workspaceId, target.directoryId, parsed.data);
    request = {
      kind: "directory",
      method: DELIVERY_CONTRACT.operations.directory.method,
      url: withUrl(base, resource.path, resource.query),
      contextKey: `${workspaceId}:directory:${target.directoryId}`,
      headers,
      fields: resource.fields,
      options: resource.options,
    };
  } else {
    const parsed = EntryOptionsSchema.safeParse(inputOptions);
    if (!parsed.success) return failure("INVALID_OPTIONS");
    const resource = adaptEntryResource(workspaceId, target.entryId, parsed.data);
    request = {
      kind: "entry",
      method: DELIVERY_CONTRACT.operations.entry.method,
      url: withUrl(base, resource.path, resource.query),
      contextKey: `${workspaceId}:entry:${target.entryId}`,
      headers,
      fields: resource.fields,
      options: resource.options,
    };
  }
  return { ok: true, request: Object.freeze(request) };
}
