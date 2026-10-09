"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Flex,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";
import { useRef, type ComponentProps, type JSX } from "react";
import { useTranslations } from "next-intl";
import { buildWorkspaceAdminIntegrationUrl } from "../integrations/workspace-admin-links";
import { ApiStatusLine, integrationAvailability } from "./ApiStatusLine";
import { buildExampleResponse } from "./delivery-contract";
import { RequestOptions, type RequestOptionsHandle } from "./RequestOptions";
import { RequestStep } from "./RequestStep";
import { useApiDesktop } from "./useApiDesktop";
import { useContentIntegration } from "./useContentIntegration";
import type { IntegrationContext } from "./types";
export type ApiAccessSheetProps = {
  context: IntegrationContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: JSX.Element;
  host?: "list" | "editor";
  onCloseAutoFocus?: ComponentProps<typeof SheetContent>["onCloseAutoFocus"];
};
export function needsPublication(context: IntegrationContext) {
  return (
    context.target.kind === "entry" &&
    ["unpublished", "changes", "legacy", "archived"].includes(
      integrationAvailability(context),
    )
  );
}
export function ApiAccessContent({
  context,
  host = "list",
  onNavigate = () => {},
}: {
  context: IntegrationContext;
  host?: "list" | "editor";
  onNavigate?: () => void;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const controller = useContentIntegration(context);
  const optionsRef = useRef<RequestOptionsHandle>(null);
  const keyHref = buildWorkspaceAdminIntegrationUrl(
    "cms_readonly_key",
    context.workspaceSlug,
  );
  return (
    <Flex direction="col" gap="lg" className="min-w-0">
      <ApiStatusLine context={context} />
      <ol className="grid min-w-0 gap-6 list-none">
        <li className="grid min-w-0 gap-2">
          <h3 className="font-semibold">
            <span aria-hidden="true">1. </span>
            {t("steps.keyTitle")}
          </h3>
          <p className="text-sm leading-5">
            {t("steps.keyBody", { workspace: context.workspaceSlug })}
          </p>
          <a
            href={keyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center self-start text-sm font-medium text-foreground underline underline-offset-4"
          >
            {t("steps.keyAction")}
            <Icon
              name="external-link"
              size={14}
              aria-hidden="true"
              className="ml-1"
            />
            <span className="sr-only"> {t("externalHint")}</span>
          </a>
          <p className="text-xs text-muted-foreground">{t("steps.keySkip")}</p>
        </li>
        <li className="grid min-w-0 gap-2">
          <h3 className="font-semibold">
            <span aria-hidden="true">2. </span>
            {t("steps.copyTitle")}
          </h3>
          <RequestStep
            controller={controller}
            onFixField={(field) => optionsRef.current?.focusField(field)}
          />
        </li>
        {needsPublication(context) && (
          <li className="grid min-w-0 gap-2">
            <h3 className="font-semibold">
              <span aria-hidden="true">3. </span>
              {t("steps.publishTitle")}
            </h3>
            <p className="text-sm">{t("steps.publishBody")}</p>
            {host === "editor" ? (
              <p className="text-sm">{t("steps.publishInEditor")}</p>
            ) : (
              context.target.kind === "entry" && (
                <a
                  href={`/dashboard/${encodeURIComponent(context.workspaceSlug)}/content/entry/${encodeURIComponent(context.target.entryId)}/edit?panel=api`}
                  onClick={onNavigate}
                  className="inline-flex min-h-8 items-center text-sm font-medium text-foreground underline underline-offset-4"
                >
                  {t("steps.publishAction")}
                </a>
              )
            )}
          </li>
        )}
      </ol>
      <RequestOptions
        ref={optionsRef}
        context={context}
        controller={controller}
      />
      {controller.result.ok && (
        <Accordion type="single" collapsible className="min-w-0">
          <AccordionItem value="preview">
            <AccordionTrigger>{t("preview.toggle")}</AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                {t("preview.note")}
              </p>
              <pre
                translate="no"
                spellCheck={false}
                tabIndex={0}
                aria-label={t("preview.toggle")}
                className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-5"
              >
                <code>
                  {JSON.stringify(
                    buildExampleResponse(controller.result.request).response,
                    null,
                    2,
                  )}
                </code>
              </pre>
              {context.target.kind === "directory" && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {t("preview.pagination")}
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      <p className="text-xs text-muted-foreground">{t("roadmap")}</p>
    </Flex>
  );
}
export function ApiAccessSheet({
  context,
  open,
  onOpenChange,
  trigger,
  host = "list",
  onCloseAutoFocus,
}: ApiAccessSheetProps) {
  const t = useTranslations("cms.contentIntegrations");
  const desktop = useApiDesktop();
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlayClick={desktop}
    >
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      {open && (
        <SheetContent
          side={desktop ? "right" : "bottom"}
          closeLabel={t("close")}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          className={`grid grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-clip p-0 ${desktop ? "md:w-[420px] max-w-full lg:w-[480px] lg:max-w-[480px]" : "h-[100dvh] w-full max-w-none rounded-none"}`}
        >
          <SheetHeader className="sticky top-0 min-w-0 border-b border-border bg-background p-4 pr-14">
            <p className="line-clamp-2 break-words text-xs text-muted-foreground">
              {context.target.kind === "directory" &&
              context.target.breadcrumb !== context.target.label
                ? t("eyebrowFolderPath", {
                    path: context.target.breadcrumb,
                    workspace: context.workspaceSlug,
                  })
                : t(
                    context.target.kind === "directory"
                      ? "eyebrowFolder"
                      : "eyebrowEntry",
                    { workspace: context.workspaceSlug },
                  )}
            </p>
            <SheetTitle
              ref={titleRef}
              tabIndex={-1}
              title={context.target.label}
              className="line-clamp-2 break-words"
            >
              {t("title", { title: context.target.label })}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("description")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4">
            <ApiAccessContent
              context={context}
              host={host}
              onNavigate={() => onOpenChange(false)}
            />
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
