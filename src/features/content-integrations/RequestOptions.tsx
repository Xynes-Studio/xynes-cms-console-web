"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  Button,
  Checkbox,
  Flex,
  Input,
  NumberInput,
  Select,
} from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";
import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { DELIVERY_CONTRACT } from "./delivery-contract";
import { summarizeOptions } from "./request-summary";
import type { ContentIntegrationController } from "./useContentIntegration";
import type { IntegrationContext } from "./types";
import type { RequestOptionField } from "./RequestStep";

export type RequestOptionsHandle = {
  expand: () => void;
  focusField: (field: RequestOptionField) => void;
};
const numberValue = (value: string) =>
  value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;

export const RequestOptions = forwardRef<
  RequestOptionsHandle,
  {
    context: IntegrationContext;
    controller: ContentIntegrationController;
  }
>(function RequestOptions({ context, controller }, ref) {
  const t = useTranslations("cms.contentIntegrations");
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const pendingFocus = useRef<RequestOptionField | null>(null);
  const limitRef = useRef<HTMLInputElement>(null);
  const offsetRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fieldsRef = useRef<HTMLInputElement>(null);
  const refs = {
    limit: limitRef,
    offset: offsetRef,
    search: searchRef,
    fields: fieldsRef,
  };
  const bindField =
    (field: RequestOptionField) => (node: HTMLInputElement | null) => {
      refs[field].current = node;
      if (node && pendingFocus.current === field) {
        node.focus();
        pendingFocus.current = null;
      }
    };
  useImperativeHandle(ref, () => ({
    expand: () => setExpanded(true),
    focusField: (field) => {
      pendingFocus.current = field;
      setExpanded(true);
      const node = refs[field].current;
      if (node) {
        node.focus();
        pendingFocus.current = null;
      }
    },
  }));
  const { controls, invalidFields, updateControls } = controller;
  const directory = DELIVERY_CONTRACT.operations.directory;
  const optionalFields = DELIVERY_CONTRACT.operations[
    context.target.kind
  ].fields.filter((field) => field !== "id");
  return (
    <Flex direction="col" gap="sm" className="min-w-0">
      <Flex align="center" justify="between" gap="sm">
        <p className="min-w-0 break-words text-sm text-muted-foreground">
          {summarizeOptions(controls, context.target.kind, t)}
        </p>
        <Button
          id={`${id}-adjust`}
          variant="ghost"
          size="sm"
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-options`}
          onClick={() => setExpanded((value) => !value)}
        >
          <Icon name="settings" size={16} aria-hidden="true" />
          {t("options.adjust")}
        </Button>
      </Flex>
      <Accordion
        type="single"
        value={expanded ? "options" : ""}
        className="border-0 bg-transparent"
      >
        <AccordionItem value="options">
          <AccordionContent
            id={`${id}-options`}
            aria-labelledby={`${id}-adjust`}
            className="px-0"
          >
            <Flex direction="col" gap="md" className="min-w-0">
              {context.target.kind === "directory" && (
                <>
                  <Select
                    label={t("options.sort")}
                    value={`${controls.sortBy}:${controls.sortDirection}`}
                    onChange={(event) => {
                      switch (event.target.value) {
                        case "publishedAt:desc":
                          updateControls({
                            sortBy: "publishedAt",
                            sortDirection: "desc",
                          });
                          break;
                        case "publishedAt:asc":
                          updateControls({
                            sortBy: "publishedAt",
                            sortDirection: "asc",
                          });
                          break;
                        case "title:asc":
                          updateControls({
                            sortBy: "title",
                            sortDirection: "asc",
                          });
                          break;
                        case "title:desc":
                          updateControls({
                            sortBy: "title",
                            sortDirection: "desc",
                          });
                          break;
                      }
                    }}
                  >
                    <option value="publishedAt:desc">
                      {t("options.newest")}
                    </option>
                    <option value="publishedAt:asc">
                      {t("options.oldest")}
                    </option>
                    <option value="title:asc">{t("options.titleAsc")}</option>
                    <option value="title:desc">{t("options.titleDesc")}</option>
                  </Select>
                  <div className="grid gap-2 text-sm font-medium">
                    <label htmlFor={`${id}-limit`}>{t("options.limit")}</label>
                    <NumberInput
                      id={`${id}-limit`}
                      ref={bindField("limit")}
                      aria-label={t("options.limit")}
                      value={numberValue(controls.limit)}
                      onChange={(value) =>
                        updateControls({
                          limit: value === undefined ? "" : String(value),
                        })
                      }
                      aria-valuemin={directory.limit.min}
                      aria-valuemax={directory.limit.max}
                      invalid={invalidFields.limit}
                      hint={t("bounds.limit", directory.limit)}
                      aria-describedby={
                        invalidFields.limit ? `${id}-limit-error` : undefined
                      }
                      className="min-h-[68px] [&_button]:min-h-8"
                    />
                    {invalidFields.limit && (
                      <span
                        id={`${id}-limit-error`}
                        aria-live="polite"
                        className="text-sm text-destructive"
                      >
                        {t("validation.limit", directory.limit)}
                      </span>
                    )}
                  </div>
                </>
              )}
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium">
                  {t("options.fields")}
                </legend>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("options.idAlways")}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&_label]:min-h-8 [&_label]:items-center [&_label]:py-1.5">
                  {optionalFields.map((field, index) => (
                    <Checkbox
                      key={field}
                      ref={index === 0 ? bindField("fields") : undefined}
                      label={t(`fields.${field}`)}
                      checked={controls.fields.includes(field)}
                      onChange={(event) =>
                        updateControls({
                          fields: event.target.checked
                            ? [...controls.fields, field]
                            : controls.fields.filter(
                                (value) => value !== field,
                              ),
                        })
                      }
                    />
                  ))}
                </div>
              </fieldset>
              {context.target.kind === "directory" && (
                <>
                  <fieldset className="min-w-0">
                    <legend className="mb-2 text-sm font-medium">
                      {t("options.pagination")}
                    </legend>
                    <label className="grid gap-2 text-sm font-medium">
                      <span>{t("options.offset")}</span>
                      <Input
                        ref={bindField("offset")}
                        type="number"
                        step="1"
                        aria-label={t("options.offset")}
                        value={controls.offset}
                        onChange={(event) =>
                          updateControls({ offset: event.target.value })
                        }
                        invalid={invalidFields.offset}
                        hint={t("bounds.offset", directory.offset)}
                        aria-describedby={`${id}-offset-help${invalidFields.offset ? ` ${id}-offset-error` : ""}`}
                      />
                      <span
                        id={`${id}-offset-help`}
                        className="text-xs leading-5 text-muted-foreground"
                      >
                        {t("options.offsetHelp")}
                      </span>
                      {invalidFields.offset && (
                        <span
                          id={`${id}-offset-error`}
                          aria-live="polite"
                          className="text-sm text-destructive"
                        >
                          {t("validation.offset", directory.offset)}
                        </span>
                      )}
                    </label>
                  </fieldset>
                  <div className="grid gap-2 text-sm font-medium">
                    <label htmlFor={`${id}-search`}>
                      {t("options.search")}
                    </label>
                    <Input
                      id={`${id}-search`}
                      ref={bindField("search")}
                      placeholder={t("options.searchPlaceholder")}
                      value={controls.search}
                      onChange={(event) =>
                        updateControls({ search: event.target.value })
                      }
                      invalid={invalidFields.search}
                      hint={t("bounds.search", {
                        max: directory.searchMaxLength,
                      })}
                      aria-describedby={
                        invalidFields.search ? `${id}-search-error` : undefined
                      }
                    />
                    {invalidFields.search && (
                      <span
                        id={`${id}-search-error`}
                        aria-live="polite"
                        className="text-sm text-destructive"
                      >
                        {t("validation.search", {
                          max: directory.searchMaxLength,
                        })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </Flex>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Flex>
  );
});
