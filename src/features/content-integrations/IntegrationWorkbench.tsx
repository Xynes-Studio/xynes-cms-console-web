"use client";
import {
  Alert,
  Flex,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buttonStyles,
} from "@lumia-ui/components";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { buildWorkspaceAdminIntegrationUrl } from "../integrations/workspace-admin-links";
import { ComingSoonPanel } from "./ComingSoonPanel";
import { IntegrationCustomization } from "./IntegrationCustomization";
import { IntegrationRequestPreview } from "./IntegrationRequestPreview";
import { useContentIntegration } from "./useContentIntegration";
import type { IntegrationContext } from "./types";

function availability(context: IntegrationContext) {
  if (context.deliveryState === "republish_required") return "legacy";
  if (context.publicationState === "archived") return "archived";
  if (
    context.publicationState === "draft" ||
    context.publicationState === "scheduled" ||
    context.deliveryState === "unpublished"
  )
    return "unpublished";
  if (context.publicationState === "published-with-changes") return "changes";
  if (
    context.publicationState === "published" ||
    context.deliveryState === "available"
  )
    return "published";
  return "unknown";
}
export function IntegrationWorkbench({
  context,
}: {
  context: IntegrationContext;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const controller = useContentIntegration(context);
  const restTrigger = useRef<HTMLButtonElement>(null);
  const openRest = () => {
    controller.setTab("rest");
    restTrigger.current?.focus();
  };
  const href = buildWorkspaceAdminIntegrationUrl(
    "cms_readonly_key",
    context.workspaceSlug,
  );
  const external = href.startsWith("http://") || href.startsWith("https://");
  return (
    <Flex direction="col" gap="md" className="min-w-0">
      <Flex direction="col" gap="xs" className="min-w-0">
        <p className="break-words text-sm text-muted-foreground">
          {t("workspace")}:{" "}
          <span className="font-medium text-foreground">
            {context.workspaceSlug}
          </span>
        </p>
        <p className="break-words font-semibold">{context.target.label}</p>
        {context.target.kind === "directory" && (
          <p className="break-words text-xs text-muted-foreground">
            {context.target.breadcrumb}
          </p>
        )}
      </Flex>
      <p
        role="status"
        className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-5 text-muted-foreground"
      >
        {t(`availability.${availability(context)}`)}
      </p>
      {!controller.result.ok && (
        <Alert
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
              className="min-w-0 whitespace-normal break-words px-2"
            >
              {t(`tabs.${value}`)}
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
      <a
        href={href}
        className={[
          buttonStyles.base,
          buttonStyles.variants.outline,
          buttonStyles.sizes.sm,
          "self-start h-auto whitespace-normal text-left",
        ].join(" ")}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {t("adminLink")}
        {external && <span className="sr-only"> {t("externalHint")}</span>}
      </a>
    </Flex>
  );
}
