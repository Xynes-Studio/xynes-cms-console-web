"use client";
import {
  Alert,
  Flex,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@lumia-ui/components";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { IntegrationKeyLink } from "./IntegrationKeyLink";
import { IntegrationAvailabilityNotice } from "./IntegrationAvailabilityNotice";
import { ComingSoonPanel } from "./ComingSoonPanel";
import { IntegrationCustomization } from "./IntegrationCustomization";
import { IntegrationRequestPreview } from "./IntegrationRequestPreview";
import { useContentIntegration } from "./useContentIntegration";
import type { IntegrationContext } from "./types";

export function IntegrationWorkbench({
  context,
}: {
  context: IntegrationContext;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const controller = useContentIntegration(context);
  // Inline field errors own announcements while their customization tab is active.
  const hasInlineOptionError =
    !controller.result.ok &&
    controller.result.error.code === "INVALID_OPTIONS" &&
    controller.tab === "customize" &&
    Object.values(controller.invalidFields).some(Boolean);
  const restTrigger = useRef<HTMLButtonElement>(null);
  const openRest = () => {
    controller.setTab("rest");
    restTrigger.current?.focus();
  };
  return (
    <Flex direction="col" gap="md" className="min-w-0">
      <Flex direction="col" gap="xs" className="min-w-0">
        <p className="[overflow-wrap:anywhere] text-sm text-muted-foreground">
          {t("workspace")}:{" "}
          <span className="font-medium text-foreground">
            {context.workspaceSlug}
          </span>
        </p>
        <p className="[overflow-wrap:anywhere] font-semibold">
          {context.target.label}
        </p>
        {context.target.kind === "directory" && (
          <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">
            {context.target.breadcrumb}
          </p>
        )}
      </Flex>
      <IntegrationAvailabilityNotice context={context} />
      {!controller.result.ok && (
        <Alert
          role={hasInlineOptionError ? "note" : "status"}
          aria-live={hasInlineOptionError ? "off" : "polite"}
          variant="warning"
          description={t(`errors.${controller.result.error.code}`)}
        />
      )}
      <Tabs
        variant="underline"
        value={controller.tab}
        onValueChange={controller.setTab}
      >
        <TabsList
          aria-label={t("title")}
          className="grid grid-cols-2 sm:grid-cols-4"
        >
          {(["customize", "rest", "scripts", "sdk"] as const).map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              ref={value === "rest" ? restTrigger : undefined}
              className="min-w-0 whitespace-normal [overflow-wrap:anywhere] px-2"
            >
              <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                {t(`tabs.${value}`)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="customize">
          <IntegrationCustomization context={context} controller={controller} />
        </TabsContent>
        <TabsContent value="rest">
          <IntegrationRequestPreview controller={controller} />
        </TabsContent>
        <TabsContent value="scripts">
          <ComingSoonPanel onRest={openRest} />
        </TabsContent>
        <TabsContent value="sdk">
          <ComingSoonPanel onRest={openRest} />
        </TabsContent>
      </Tabs>
      <IntegrationKeyLink workspaceSlug={context.workspaceSlug} />
    </Flex>
  );
}
