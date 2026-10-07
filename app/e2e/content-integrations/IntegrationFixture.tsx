"use client";
import { useState, useSyncExternalStore } from "react";
import { Button, Flex } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
import { ContentIntegrationDialog } from "../../../src/features/content-integrations/ContentIntegrationDialog";
import {
  folderContext,
  entryContext,
} from "../../../src/features/content-integrations/workbench-test-fixtures";

const subscribe = () => () => {};

export function IntegrationFixture({
  entry,
  legacy,
  draft,
  invalid,
}: {
  entry: boolean;
  legacy: boolean;
  draft: boolean;
  invalid: boolean;
}) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const t = useTranslations("cms.contentIntegrations");
  const context = {
    ...(entry ? entryContext : folderContext),
    ...(legacy ? { deliveryState: "republish_required" as const } : {}),
    ...(draft ? { publicationState: "draft" as const } : {}),
    ...(invalid ? { apiBaseUrl: "" } : {}),
  };
  return (
    <Flex direction="col" gap="md" className="min-h-screen p-6" data-testid="integration-fixture" data-ready={ready}>
      <h1>{t("title")}</h1>
      <ContentIntegrationDialog
        context={context}
        open={open}
        onOpenChange={setOpen}
        trigger={<Button type="button">{t("title")}</Button>}
      />
    </Flex>
  );
}
