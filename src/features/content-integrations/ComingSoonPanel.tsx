"use client";
import { Badge, Button, Flex } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
export function ComingSoonPanel({ onRest }: { onRest: () => void }) {
  const t = useTranslations("cms.contentIntegrations.comingSoon");
  return (
    <Flex direction="col" align="start" gap="md" className="py-4">
      <p role="status" aria-live="polite" aria-atomic="true">
        <Badge variant="outline">{t("title")}</Badge>
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Button
        className="h-auto whitespace-normal text-left"
        type="button"
        variant="outline"
        onClick={onRest}
      >
        {t("rest")}
      </Button>
    </Flex>
  );
}
