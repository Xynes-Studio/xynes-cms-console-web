"use client";
import { Alert, Flex } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
import { ApiStatusLine } from "./ApiStatusLine";
import { needsPublication } from "./ApiAccessSheet";
import { summarizeOptions } from "./request-summary";
import { useContentIntegration } from "./useContentIntegration";
import type { IntegrationContext } from "./types";
/** Publishing guidance; the layout supplies the shared sheet's focus-return button. */
export function EditorApiCard({ context }: { context: IntegrationContext }) {
  const t = useTranslations("cms.contentIntegrations");
  const controller = useContentIntegration(context);
  return (
    <Flex direction="col" gap="md" className="min-w-0">
      <ApiStatusLine context={context} />
      {needsPublication(context) && (
        <p className="text-sm">{t("steps.publishInEditor")}</p>
      )}
      <p className="break-words text-sm text-muted-foreground">
        {summarizeOptions(controller.controls, context.target.kind, t)}
      </p>
      {!controller.result.ok && (
        <Alert
          variant="warning"
          role="alert"
          description={t(`errors.${controller.result.error.code}`)}
        />
      )}
    </Flex>
  );
}
