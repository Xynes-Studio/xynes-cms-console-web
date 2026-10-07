"use client";
import { Badge, Button, Flex } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
export function ComingSoonPanel({ onRest }: { onRest: () => void }) {
  const t = useTranslations("cms.contentIntegrations.comingSoon");
  return (
    <Flex direction="col" align="start" gap="md" className="py-4">
      <Badge variant="outline">{t("title")}</Badge>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Button type="button" variant="outline" onClick={onRest}>
        {t("rest")}
      </Button>
    </Flex>
  );
}
