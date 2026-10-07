"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@lumia-ui/components";
import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { IntegrationWorkbench } from "./IntegrationWorkbench";
import type { IntegrationContext } from "./types";
export type ContentIntegrationDialogProps = {
  context: IntegrationContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hosts can supply their own button; Lumia restores its focus on close. */
  trigger?: JSX.Element;
};
export function ContentIntegrationDialog({
  context,
  open,
  onOpenChange,
  trigger,
}: ContentIntegrationDialogProps) {
  const t = useTranslations("cms.contentIntegrations");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6"
      >
        <DialogHeader className="pr-10">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <IntegrationWorkbench context={context} />
      </DialogContent>
    </Dialog>
  );
}
