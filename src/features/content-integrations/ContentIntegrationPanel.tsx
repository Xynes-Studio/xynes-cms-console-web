"use client";
import { Alert, Flex } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
import { IntegrationKeyLink } from "./IntegrationKeyLink";
import { IntegrationAvailabilityNotice } from "./IntegrationAvailabilityNotice";
import { IntegrationRequestPreview } from "./IntegrationRequestPreview";
import { useContentIntegration } from "./useContentIntegration";
import type { IntegrationContext } from "./types";
export function ContentIntegrationPanel({
  context,
}: {
  context: IntegrationContext;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const controller = useContentIntegration(context);
  return (
    <Flex direction="col" gap="md" className="min-w-0">
      <p className="break-words font-medium">{context.target.label}</p>
      <p className="text-sm text-muted-foreground">{t("hosts.panelSummary")}</p>
      <IntegrationAvailabilityNotice context={context} />
      {!controller.result.ok && (
        <Alert
          variant="warning"
          description={t(`errors.${controller.result.error.code}`)}
        />
      )}
      <IntegrationRequestPreview controller={controller} compact />
      <IntegrationKeyLink workspaceSlug={context.workspaceSlug} />
    </Flex>
  );
}
