"use client";
import { Checkbox, Flex, Input, Select } from "@lumia-ui/components";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import type { IntegrationContext } from "./types";
import type { ContentIntegrationController } from "./useContentIntegration";

export function IntegrationCustomization({
  context,
  controller,
}: {
  context: IntegrationContext;
  controller: ContentIntegrationController;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const { controls, invalidFields, updateControls } = controller;
  const id = useId();
  const contract = DELIVERY_CONTRACT.operations.directory;
  const optionalFields = DELIVERY_CONTRACT.operations[
    context.target.kind
  ].fields.filter((field) => field !== "id");
  return (
    <Flex direction="col" gap="lg">
      {context.target.kind === "directory" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("controls.order")}
              value={controls.sortBy}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "publishedAt" || value === "title")
                  updateControls({ sortBy: value });
              }}
            >
              {contract.sortBy.map((value) => (
                <option key={value} value={value}>
                  {t(`fields.${value}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("controls.direction")}
              value={controls.sortDirection}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "asc" || value === "desc")
                  updateControls({ sortDirection: value });
              }}
            >
              <option value="desc">
                {t(
                  controls.sortBy === "title"
                    ? "controls.za"
                    : "controls.newest",
                )}
              </option>
              <option value="asc">
                {t(
                  controls.sortBy === "title"
                    ? "controls.az"
                    : "controls.oldest",
                )}
              </option>
            </Select>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t("controls.limit")}</span>
            <Input
              aria-label={t("controls.limit")}
              invalid={invalidFields.limit}
              aria-describedby={
                invalidFields.limit ? `${id}-limit-error` : undefined
              }
              autoComplete="off"
              type="number"
              min={contract.limit.min}
              max={contract.limit.max}
              step={1}
              hint={t("bounds.limit", contract.limit)}
              value={controls.limit}
              onChange={(event) =>
                updateControls({ limit: event.target.value })
              }
            />
            {invalidFields.limit && (
              <span
                id={`${id}-limit-error`}
                aria-live="polite"
                className="text-sm text-destructive"
              >
                {t("validation.limit", contract.limit)}
              </span>
            )}
          </label>
        </>
      )}
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-semibold">
          {t("controls.fields")}
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Checkbox label={t("controls.id")} checked disabled />
          {optionalFields.map((field) => (
            <Checkbox
              key={field}
              label={t(`fields.${field}`)}
              checked={controls.fields.includes(field)}
              onChange={(event) =>
                updateControls({
                  fields: event.target.checked
                    ? [...controls.fields, field]
                    : controls.fields.filter((value) => value !== field),
                })
              }
            />
          ))}
        </div>
      </fieldset>
      {context.target.kind === "directory" && (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            {t("controls.advanced")}
          </summary>
          <Flex direction="col" gap="md" className="pt-4">
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("controls.offset")}</span>
              <Input
                aria-label={t("controls.offset")}
                invalid={invalidFields.offset}
                aria-describedby={
                  invalidFields.offset ? `${id}-offset-error` : undefined
                }
                autoComplete="off"
                type="number"
                min={contract.offset.min}
                max={contract.offset.max}
                step={1}
                hint={t("bounds.offset", contract.offset)}
                value={controls.offset}
                onChange={(event) =>
                  updateControls({ offset: event.target.value })
                }
              />
              {invalidFields.offset && (
                <span
                  id={`${id}-offset-error`}
                  aria-live="polite"
                  className="text-sm text-destructive"
                >
                  {t("validation.offset", contract.offset)}
                </span>
              )}
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t("controls.search")}</span>
              <Input
                aria-label={t("controls.search")}
                invalid={invalidFields.search}
                aria-describedby={
                  invalidFields.search ? `${id}-search-error` : undefined
                }
                autoComplete="off"
                hint={t("bounds.search", { max: contract.searchMaxLength })}
                maxLength={contract.searchMaxLength}
                value={controls.search}
                onChange={(event) =>
                  updateControls({ search: event.target.value })
                }
              />
              {invalidFields.search && (
                <span
                  id={`${id}-search-error`}
                  aria-live="polite"
                  className="text-sm text-destructive"
                >
                  {t("validation.search", { max: contract.searchMaxLength })}
                </span>
              )}
            </label>
          </Flex>
        </details>
      )}
      <p className="text-sm text-muted-foreground">
        {t("format")}:{" "}
        <span className="font-medium text-foreground">{t("json")}</span>
      </p>
    </Flex>
  );
}
