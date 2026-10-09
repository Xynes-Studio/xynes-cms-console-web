"use client";
import { useState, useSyncExternalStore } from "react";
import { Button, Flex } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
import { ApiAccessSheet } from "../../../src/features/content-integrations/ApiAccessSheet";
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
  long,
}: {
  entry: boolean;
  legacy: boolean;
  draft: boolean;
  invalid: boolean;
  long: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const t = useTranslations("cms.contentIntegrations");
  const context = {
    ...(entry ? entryContext : folderContext),
    ...(legacy ? { deliveryState: "republish_required" as const } : {}),
    ...(draft ? { publicationState: "draft" as const } : {}),
    ...(invalid ? { apiBaseUrl: "" } : {}),
    ...(long
      ? {
          target: {
            ...(entry ? entryContext.target : folderContext.target),
            label: "LongResource".repeat(100),
          },
        }
      : {}),
  };
  return (
    <Flex
      direction="col"
      gap="md"
      className="min-h-screen p-6"
      data-testid="integration-fixture"
      data-ready={ready}
    >
      <h1>{t("trigger")}</h1>
      <ApiAccessSheet
        context={context}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            type="button"
            aria-label={t("title", { title: context.target.label })}
          >
            {t("trigger")}
          </Button>
        }
      />
    </Flex>
  );
}
