import { z } from "zod";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import type {
  DeliveryField,
  DirectoryField,
  DirectoryRequestOptions,
  EntryRequestOptions,
} from "./types";
const directory = DELIVERY_CONTRACT.operations.directory;
const entry = DELIVERY_CONTRACT.operations.entry;
const unique = (fields: readonly string[]) => new Set(fields).size === fields.length;
export const DirectoryOptionsSchema = z.strictObject({
  sortBy: z.enum(directory.sortBy).default(directory.defaultSortBy),
  sortDirection: z.enum(directory.sortDirection).default(directory.defaultSortDirection),
  limit: z
    .number()
    .int()
    .min(directory.limit.min)
    .max(directory.limit.max)
    .default(directory.limit.default),
  offset: z
    .number()
    .int()
    .min(directory.offset.min)
    .max(directory.offset.max)
    .default(directory.offset.default),
  search: z.string().trim().min(1).max(directory.searchMaxLength).optional(),
  fields: z
    .array(z.enum(directory.fields))
    .max(directory.fields.length)
    .refine(unique)
    .default(() => [...directory.fields]),
});
export const EntryOptionsSchema = z.strictObject({
  fields: z
    .array(z.enum(entry.fields))
    .max(entry.fields.length)
    .refine(unique)
    .default(() => [...entry.fields]),
});
function selectedFields<Field extends DeliveryField>(
  allowed: readonly Field[],
  selected: readonly Field[],
): readonly Field[] {
  const names = new Set<string>([DELIVERY_CONTRACT.requiredField, ...selected]);
  return Object.freeze(allowed.filter((name) => names.has(name)));
}
export function adaptDirectoryResource(
  workspaceId: string,
  directoryId: string,
  parsed: z.output<typeof DirectoryOptionsSchema>,
) {
  const fields: readonly DirectoryField[] = selectedFields(directory.fields, parsed.fields);
  const options: Readonly<DirectoryRequestOptions> = Object.freeze({ ...parsed, fields });
  const query = new URLSearchParams({
    directoryId,
    sortBy: options.sortBy,
    sortDirection: options.sortDirection,
    limit: String(options.limit),
    offset: String(options.offset),
    fields: fields.join(","),
  });
  if (options.search !== undefined) query.set("search", options.search);
  return {
    path: directory.path.replace(":workspaceId", encodeURIComponent(workspaceId)),
    query,
    fields,
    options,
  };
}
export function adaptEntryResource(
  workspaceId: string,
  entryId: string,
  parsed: z.output<typeof EntryOptionsSchema>,
) {
  const fields = selectedFields(entry.fields, parsed.fields);
  const options: Readonly<EntryRequestOptions> = Object.freeze({ fields });
  return {
    path: entry.path
      .replace(":workspaceId", encodeURIComponent(workspaceId))
      .replace(":entryId", encodeURIComponent(entryId)),
    query: new URLSearchParams({ fields: fields.join(",") }),
    fields,
    options,
  };
}
