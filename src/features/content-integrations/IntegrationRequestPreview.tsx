"use client";
import { Button, Flex, Select } from "@lumia-ui/components";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { buildExampleResponse, getResponseFields } from "./delivery-contract";
import type { ContentIntegrationController } from "./useContentIntegration";

export function IntegrationRequestPreview({
  controller,
}: {
  controller: ContentIntegrationController;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const id = useId();
  const { result, format, setFormat, snippet, copyStatus, copyPending, copy } =
    controller;
  const request = result.ok ? result.request : undefined;
  return (
    <Flex direction="col" gap="lg" className="min-w-0">
      {request && (
        <>
          <Flex direction="col" gap="xs">
            <label htmlFor={`${id}-url`} className="text-sm font-medium">
              GET · {t("preview.url")}
            </label>
            <textarea
              id={`${id}-url`}
              aria-label={t("preview.url")}
              readOnly
              value={request.url}
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-muted/30 p-3 font-mono text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            />
            <p className="text-sm font-medium">{t("preview.auth")}</p>
            <p className="text-sm text-muted-foreground">
              {t("preview.authHint")}
            </p>
          </Flex>
          <Select
            label={t("preview.format")}
            value={format}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "url" ||
                value === "curl" ||
                value === "serverFetch"
              )
                setFormat(value);
            }}
          >
            <option value="curl">{t("preview.formats.curl")}</option>
            <option value="serverFetch">
              {t("preview.formats.serverFetch")}
            </option>
            <option value="url">{t("preview.formats.url")}</option>
          </Select>
          <Flex direction="col" gap="xs">
            <label htmlFor={`${id}-code`} className="text-sm font-medium">
              {t("preview.code")}
            </label>
            <textarea
              id={`${id}-code`}
              readOnly
              value={snippet}
              rows={format === "serverFetch" ? 12 : 5}
              spellCheck={false}
              className="w-full resize-y rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            />
          </Flex>
        </>
      )}
      <Flex direction="col" align="start" gap="xs">
        <Button
          type="button"
          disabled={!request || copyPending}
          onClick={() => {
            void copy();
          }}
        >
          {t(copyStatus === "pending" ? "preview.pending" : "preview.copy")}
        </Button>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm text-muted-foreground"
        >
          {copyStatus === "copied"
            ? t("preview.copied")
            : copyStatus === "manual"
              ? t("preview.manual")
              : ""}
        </p>
      </Flex>
      {request && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="pb-2 text-left font-semibold">
                {t("preview.fields")}
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">
                    {t("preview.name")}
                  </th>
                  <th scope="col" className="p-2">
                    {t("preview.type")}
                  </th>
                  <th scope="col" className="p-2">
                    {t("preview.required")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {getResponseFields(request).map((field) => (
                  <tr key={field.name} className="border-b border-border">
                    <th scope="row" className="p-2 font-normal">
                      {t(`fields.${field.name}`)}{" "}
                      <code className="text-xs text-muted-foreground">
                        {field.name}
                      </code>
                    </th>
                    <td className="p-2 font-mono text-xs">{field.type}</td>
                    <td className="p-2">
                      {t(field.required ? "preview.yes" : "preview.no")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Flex direction="col" gap="xs">
            <h3 className="text-sm font-semibold">{t("preview.example")}</h3>
            <pre
              aria-label={t("preview.response")}
              tabIndex={0}
              className="max-h-72 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {JSON.stringify(buildExampleResponse(request).response, null, 2)}
            </pre>
          </Flex>
        </>
      )}
    </Flex>
  );
}
