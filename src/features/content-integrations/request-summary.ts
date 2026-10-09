import { DELIVERY_CONTRACT } from "./delivery-contract";
import type { IntegrationControls } from "./useContentIntegration";

type SummaryKey =
  | "options.summaryFolder"
  | "options.summaryEntry"
  | "options.summaryOffset"
  | "options.summarySearch"
  | "options.newest"
  | "options.oldest"
  | "options.titleAsc"
  | "options.titleDesc"
  | "options.itemsCount"
  | "options.fieldsCount"
  | "options.unknownItems";
type TranslateSummary = (
  key: SummaryKey,
  values?: Record<string, string | number>,
) => string;

/** Summaries use the request's normalized numeric values and always include ID. */
export function summarizeOptions(
  controls: IntegrationControls,
  kind: "directory" | "entry",
  t: TranslateSummary,
): string {
  const selected = new Set(controls.fields);
  const fields = DELIVERY_CONTRACT.operations[kind].fields.filter(
    (field) => field === "id" || selected.has(field),
  ).length;
  if (kind === "entry")
    return t("options.summaryEntry", {
      fields,
      total: DELIVERY_CONTRACT.operations.entry.fields.length,
    });
  const limit = controls.limit.trim() === "" ? NaN : Number(controls.limit);
  const sort =
    controls.sortBy === "title"
      ? t(
          controls.sortDirection === "asc"
            ? "options.titleAsc"
            : "options.titleDesc",
        )
      : t(
          controls.sortDirection === "asc"
            ? "options.oldest"
            : "options.newest",
        );
  let summary = t("options.summaryFolder", {
    items: Number.isFinite(limit)
      ? t("options.itemsCount", { count: limit })
      : t("options.unknownItems"),
    sort,
    fields: t("options.fieldsCount", { count: fields }),
  });
  const offset = Number(controls.offset);
  if (Number.isFinite(offset) && offset > 0)
    summary += t("options.summaryOffset", { offset });
  const search = controls.search.trim();
  if (search) summary += t("options.summarySearch", { search });
  return summary;
}
