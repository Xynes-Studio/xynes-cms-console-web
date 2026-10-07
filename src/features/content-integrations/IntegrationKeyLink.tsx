"use client";
import { buttonStyles } from "@lumia-ui/components";
import { useTranslations } from "next-intl";
import { buildWorkspaceAdminIntegrationUrl } from "../integrations/workspace-admin-links";
export function IntegrationKeyLink({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const t = useTranslations("cms.contentIntegrations");
  const href = buildWorkspaceAdminIntegrationUrl(
    "cms_readonly_key",
    workspaceSlug,
  );
  const external = href.startsWith("http://") || href.startsWith("https://");
  return (
    <a
      href={href}
      className={[
        buttonStyles.base,
        buttonStyles.variants.outline,
        buttonStyles.sizes.sm,
        "relative self-start h-auto whitespace-normal text-left",
      ].join(" ")}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {t("adminLink")}
      {external && <span className="sr-only"> {t("externalHint")}</span>}
    </a>
  );
}
