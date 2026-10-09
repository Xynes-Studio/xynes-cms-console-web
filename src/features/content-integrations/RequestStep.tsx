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
          className="rounded-sm bg-highlight px-0.5 text-highlight-foreground"
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
        data-changed-param
        className="bg-highlight text-highlight-foreground transition-opacity motion-reduce:transition-none"
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
      <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
        <Flex
          wrap="wrap"
          align="center"
          justify="between"
          gap="sm"
          className="border-b border-border bg-background p-3"
        >
          <SegmentedControl
            aria-label={t("steps.copyTitle")}
            className="max-w-full flex-wrap rounded-md"
            buttonProps={{
              className:
                "border border-transparent data-[state=active]:border-foreground",
            }}
            options={(["curl", "serverFetch", "url"] as const).map((value) => ({
              value,
              label: t(`formats.${value}`),
            }))}
            value={format}
            onChange={(value) => {
              if (
                value === "curl" ||
                value === "serverFetch" ||
                value === "url"
              )
                controller.setFormat(value);
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="disabled:bg-secondary disabled:text-muted-foreground"
            style={copyPending ? { opacity: 1 } : undefined}
            disabled={copyPending}
            aria-busy={copyPending}
            onClick={() => {
              void controller.copy();
            }}
          >
            <Icon
              name={copyStatus === "copied" ? "check" : "copy"}
              color="currentColor"
              size={16}
              aria-hidden="true"
            />
            {t(copyStatus === "copied" ? "copied" : "copy")}
          </Button>
        </Flex>
        <pre
          ref={preRef}
          tabIndex={0}
          translate="no"
          role="region"
          aria-label={t("codeAria", { format: t(`formats.${format}`) })}
          className={`whitespace-pre-wrap break-all p-4 font-mono text-sm leading-6 text-foreground${format === "serverFetch" ? " max-h-[28rem] overflow-auto" : ""}`}
        >
          <code>
            {highlightRequest(snippet ?? "", controller.changedParam)}
          </code>
        </pre>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {highlightPlaceholder(t("steps.copyHelper"))}
      </p>
      {format === "url" && (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("steps.urlHeader")}
        </p>
      )}
      <details className="text-xs leading-5 text-muted-foreground">
        <summary className="inline-flex min-h-8 cursor-pointer items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
          {t("steps.environmentTitle")}
        </summary>
        <p className="mt-2">{t("steps.environmentBody")}</p>
        <pre
          translate="no"
          className="mt-2 whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-foreground"
        >
          <code>read -rs XYNES_API_KEY; export XYNES_API_KEY</code>
        </pre>
      </details>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-h-5 text-xs leading-5 text-muted-foreground"
      >
        <span key={copyFeedbackRevision}>
          {copyPending
            ? t("copyPending")
            : copyStatus === "copied"
              ? t("copied")
              : copyStatus === "manual"
                ? t("copyFailed")
                : ""}
        </span>
      </p>
    </Flex>
  );
}
