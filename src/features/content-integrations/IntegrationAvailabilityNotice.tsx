"use client";
import { useTranslations } from "next-intl";
import type { IntegrationContext } from "./types";
export function integrationAvailability(context: IntegrationContext) {
  if (context.deliveryState === "republish_required") return "legacy";
  if (context.publicationState === "archived") return "archived";
  if (
    context.publicationState === "draft" ||
    context.publicationState === "scheduled" ||
    context.deliveryState === "unpublished"
  )
    return "unpublished";
  if (context.publicationState === "published-with-changes") return "changes";
  if (context.deliveryState === "available") return "published";
  return "unknown";
}
export function IntegrationAvailabilityNotice({
  context,
}: {
  context: IntegrationContext;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const state = integrationAvailability(context);
  const unknownChanges =
    state === "changes" &&
    (context.deliveryState === undefined ||
      context.deliveryState === "unknown");
  return (
    <p
      role="status"
      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-5 text-muted-foreground"
    >
      {t(`availability.${state}`)}
      {unknownChanges && <> {t("availability.unknown")}</>}
    </p>
  );
}
