import { z } from "zod";
import { GENERATED_DELIVERY_CONTRACT } from "./delivery-contract.generated";
import examples from "./fixtures/delivery-examples.v1.json";
import type {
  DeliveryField,
  ExampleEntry,
  ExampleResponse,
  IntegrationRequest,
  JsonValue,
  ResponseField,
} from "./types";

function freezeContract<T extends object>(value: T): Readonly<T> {
  for (const child of Object.values(value))
    if (child !== null && typeof child === "object") freezeContract(child);
  return Object.freeze(value);
}
export const DELIVERY_CONTRACT = freezeContract(GENERATED_DELIVERY_CONTRACT);
const directory = DELIVERY_CONTRACT.operations.directory;
const entry = DELIVERY_CONTRACT.operations.entry;
const bounds = (value: { readonly min: number; readonly max: number; readonly default: number }) =>
  z.strictObject({
    min: z.literal(value.min),
    max: z.literal(value.max),
    default: z.literal(value.default),
  });
const ContractSchema = z.strictObject({
  version: z.literal(DELIVERY_CONTRACT.version),
  operations: z.strictObject({
    directory: z.strictObject({
      method: z.literal(directory.method),
      path: z.literal(directory.path),
      actionKey: z.literal(directory.actionKey),
      requiredQuery: z.array(z.literal("directoryId")).length(1),
      fields: z.array(z.enum(directory.fields)).length(directory.fields.length),
      sortBy: z.array(z.enum(directory.sortBy)).length(directory.sortBy.length),
      sortDirection: z
        .array(z.enum(directory.sortDirection))
        .length(directory.sortDirection.length),
      defaultSortBy: z.literal(directory.defaultSortBy),
      defaultSortDirection: z.literal(directory.defaultSortDirection),
      limit: bounds(directory.limit),
      offset: bounds(directory.offset),
      searchMaxLength: z.literal(directory.searchMaxLength),
      scope: z.literal(directory.scope),
      ordering: z.strictObject({
        publishedAt: z.array(z.enum(entry.fields)),
        title: z.array(z.enum(entry.fields)),
      }),
    }),
    entry: z.strictObject({
      method: z.literal(entry.method),
      path: z.literal(entry.path),
      actionKey: z.literal(entry.actionKey),
      fields: z.array(z.enum(entry.fields)).length(entry.fields.length),
    }),
  }),
  route: z.strictObject({
    serviceKey: z.literal(DELIVERY_CONTRACT.route.serviceKey),
    targetPath: z.literal(DELIVERY_CONTRACT.route.targetPath),
    workspaceScoped: z.literal(true),
    isPublic: z.literal(false),
  }),
  auth: z.literal(DELIVERY_CONTRACT.auth),
  publication: z.literal(DELIVERY_CONTRACT.publication),
  requiredField: z.literal(DELIVERY_CONTRACT.requiredField),
  fieldsEncoding: z.literal(DELIVERY_CONTRACT.fieldsEncoding),
  fieldsMaxLength: z.literal(DELIVERY_CONTRACT.fieldsMaxLength),
  summaryBounds: z.strictObject({
    title: z.strictObject({
      min: z.literal(DELIVERY_CONTRACT.summaryBounds.title.min),
      max: z.literal(DELIVERY_CONTRACT.summaryBounds.title.max),
    }),
    descriptionMaxLength: z.literal(DELIVERY_CONTRACT.summaryBounds.descriptionMaxLength),
    tags: z.strictObject({
      maxItems: z.literal(DELIVERY_CONTRACT.summaryBounds.tags.maxItems),
      minLength: z.literal(DELIVERY_CONTRACT.summaryBounds.tags.minLength),
      maxLength: z.literal(DELIVERY_CONTRACT.summaryBounds.tags.maxLength),
    }),
  }),
  bodyFormat: z.literal(DELIVERY_CONTRACT.bodyFormat),
  snapshotMaxBytes: z.literal(DELIVERY_CONTRACT.snapshotMaxBytes),
  deliveryStates: z
    .array(z.enum(DELIVERY_CONTRACT.deliveryStates))
    .length(DELIVERY_CONTRACT.deliveryStates.length),
  errors: z.strictObject({
    unavailable: z.strictObject({
      status: z.literal(DELIVERY_CONTRACT.errors.unavailable.status),
      code: z.literal(DELIVERY_CONTRACT.errors.unavailable.code),
      message: z.literal(DELIVERY_CONTRACT.errors.unavailable.message),
    }),
    invalidInput: z.strictObject({
      status: z.literal(DELIVERY_CONTRACT.errors.invalidInput.status),
      code: z.literal(DELIVERY_CONTRACT.errors.invalidInput.code),
    }),
  }),
});
export function parseDeliveryContract(value: unknown) {
  return ContractSchema.refine(
    (parsed) => JSON.stringify(parsed) === JSON.stringify(DELIVERY_CONTRACT),
  ).safeParse(value);
}
const JsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ]),
);
const BodySchema = z.record(z.string(), JsonSchema).nullable();
const SampleSchema = z.strictObject({
  id: z.string().uuid(),
  title: z
    .string()
    .min(DELIVERY_CONTRACT.summaryBounds.title.min)
    .max(DELIVERY_CONTRACT.summaryBounds.title.max),
  description: z.string().max(DELIVERY_CONTRACT.summaryBounds.descriptionMaxLength),
  tags: z
    .array(z.string().min(1).max(DELIVERY_CONTRACT.summaryBounds.tags.maxLength))
    .max(DELIVERY_CONTRACT.summaryBounds.tags.maxItems),
  publishedAt: z.iso.datetime(),
  body: BodySchema,
});
const samples = z
  .strictObject({
    version: z.literal(1),
    fields: z.strictObject({
      id: z.literal("string"),
      title: z.literal("string"),
      description: z.literal("string"),
      tags: z.literal("string[]"),
      publishedAt: z.literal("string"),
      body: z.literal("object|null"),
    }),
    entries: z.array(SampleSchema).min(1),
  })
  .parse(examples);
function project(
  sample: z.infer<typeof SampleSchema>,
  fields: readonly DeliveryField[],
): ExampleEntry {
  const selected = new Set(fields);
  return {
    id: sample.id,
    ...(selected.has("title") ? { title: sample.title } : {}),
    ...(selected.has("description") ? { description: sample.description } : {}),
    ...(selected.has("tags") ? { tags: [...sample.tags] } : {}),
    ...(selected.has("publishedAt") ? { publishedAt: sample.publishedAt } : {}),
    ...(selected.has("body") ? { body: BodySchema.parse(sample.body) } : {}),
  };
}
export function buildExampleResponse(request: IntegrationRequest): ExampleResponse {
  const data =
    request.kind === "entry"
      ? { entry: project(samples.entries[0], request.fields) }
      : {
          items: samples.entries
            .slice(0, request.options.limit)
            .map((sample) => project(sample, request.fields)),
          page: {
            limit: request.options.limit,
            offset: request.options.offset,
            hasMore: false as const,
          },
        };
  return { kind: "static-example", response: { ok: true, data } };
}
export function getResponseFields(request: IntegrationRequest): readonly ResponseField[] {
  return request.fields.map((name) => ({
    name,
    type: samples.fields[name],
    required: name === DELIVERY_CONTRACT.requiredField,
  }));
}
