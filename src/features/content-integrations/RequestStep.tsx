"use client";

import { Alert, Button, Flex, SegmentedControl } from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type {
  ChangedParam,
  ContentIntegrationController,
} from "./useContentIntegration";

export type RequestOptionField = "limit" | "offset" | "search" | "fields";
function highlightPlaceholder(text: string) {
  return text
    .split(/(\$\{?XYNES_API_KEY\}?|XYNES_API_KEY)/g)
    .map((part, index) =>
      /^(\$\{?XYNES_API_KEY\}?|XYNES_API_KEY)$/.test(part) ? (
        <mark
          key={index}
          className="rounded-sm bg-warning/20 px-0.5 text-foreground"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
}

function highlightRequest(text: string, changedParam: ChangedParam | null) {
  if (!changedParam) return highlightPlaceholder(text);
  // Only literal, generated query pairs are matched; no HTML construction.
  const pattern = new RegExp(`(${changedParam}=[^&\\s'"\\x60]+)`, "g");
  return text.split(pattern).map((part, index) =>
    part.startsWith(`${changedParam}=`) ? (
      <span
        key={index}
        className="bg-warning/20 transition-opacity motion-reduce:transition-none"
      >
        {highlightPlaceholder(part)}
      </span>
    ) : (
      <span key={index}>{highlightPlaceholder(part)}</span>
    ),
  );
}

export function RequestStep({
  controller,
  onFixField,
}: {
  controller: ContentIntegrationController;
  onFixField: (field: RequestOptionField) => void;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const preRef = useRef<HTMLPreElement>(null);
  const {
    result,
    format,
    snippet,
    copyStatus,
    copyPending,
    copyFeedbackRevision,
  } = controller;
  useEffect(() => {
    const pre = preRef.current;
    if (copyStatus !== "manual" || !pre) return;
    pre.focus();
    const range = document.createRange();
    range.selectNodeContents(pre);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [copyStatus, snippet, copyFeedbackRevision]);

  if (!result.ok) {
    const optionsError = result.error.code === "INVALID_OPTIONS";
    const field: RequestOptionField = controller.invalidFields.limit
      ? "limit"
      : controller.invalidFields.offset
        ? "offset"
        : controller.invalidFields.search
          ? "search"
          : "fields";
    return (
      <Alert
        variant="warning"
        role="alert"
        description={
          optionsError
            ? t("options.fix", { field: t(`options.${field}`) })
            : t(`errors.${result.error.code}`)
        }
      >
        {optionsError && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onFixField(field)}
          >
            {t("options.goToField")}
          </Button>
        )}
      </Alert>
    );
  }
  return (
    <Flex direction="col" gap="sm" className="min-w-0">
      <SegmentedControl
        aria-label={t("steps.copyTitle")}
        options={(["curl", "serverFetch", "url"] as const).map((value) => ({
          value,
          label: t(`formats.${value}`),
        }))}
        value={format}
        onChange={(value) => {
          if (value === "curl" || value === "serverFetch" || value === "url")
            controller.setFormat(value);
        }}
      />
      <div className="relative min-w-0">
        <pre
          ref={preRef}
          tabIndex={0}
          translate="no"
          role="region"
          aria-label={t("codeAria", { format: t(`formats.${format}`) })}
          className={`whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-3 pr-20 font-mono text-xs leading-5${format === "serverFetch" ? " max-h-[28rem] overflow-auto" : ""}`}
        >
          <code>
            {highlightRequest(snippet ?? "", controller.changedParam)}
          </code>
        </pre>
        <div className="absolute right-2 top-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={copyPending}
            aria-busy={copyPending}
            onClick={() => {
              void controller.copy();
            }}
          >
            <Icon
              name={copyStatus === "copied" ? "check" : "copy"}
              size={16}
              aria-hidden="true"
            />
            {t(copyStatus === "copied" ? "copied" : "copy")}
          </Button>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {highlightPlaceholder(t("steps.copyHelper"))}
      </p>
      {format === "url" && (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("steps.urlHeader")}
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-xs leading-5 text-muted-foreground"
      >
        <span key={copyFeedbackRevision}>
          {copyStatus === "copied"
            ? t("copied")
            : copyStatus === "manual"
              ? t("copyFailed")
              : ""}
        </span>
      </p>
    </Flex>
  );
}
