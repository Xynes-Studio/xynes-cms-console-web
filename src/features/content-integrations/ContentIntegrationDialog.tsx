"use client";
import {
  Dialog,
  Flex,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@lumia-ui/components";
import type { ComponentProps, JSX } from "react";
import { useTranslations } from "next-intl";
import { IntegrationWorkbench } from "./IntegrationWorkbench";
import type { IntegrationContext } from "./types";
export type ContentIntegrationDialogProps = {
  context: IntegrationContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hosts can supply their own button; Lumia restores its focus on close. */
  trigger?: JSX.Element;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
};
export function ContentIntegrationDialog({
  context,
  open,
  onOpenChange,
  trigger,
  onCloseAutoFocus,
}: ContentIntegrationDialogProps) {
  const t = useTranslations("cms.contentIntegrations");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        closeLabel={t("close")}
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[90dvh] max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-clip p-4 sm:p-6"
      >
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Flex
          direction="col"
          className="min-h-0 min-w-0 overflow-y-auto overscroll-contain"
          role="region"
          aria-label={t("scrollRegion")}
          tabIndex={0}
        >
          <IntegrationWorkbench context={context} />
        </Flex>
      </DialogContent>
    </Dialog>
  );
}
