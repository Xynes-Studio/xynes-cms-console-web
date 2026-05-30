import { Avatar, Badge, Card } from "@lumia-ui/components";
import { useLocale, useTranslations } from "next-intl";

export type CmsEntryCardGridProps = {
  entryId: string;
  title: string;
  ownerName?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
  status: "draft" | "published" | "archived";
  onOpen: (entryId: string) => void;
};

const formatCreatedDate = (
  locale: string,
  fallbackDate: string,
  createdAt?: string | null,
) => {
  if (!createdAt) {
    return fallbackDate;
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

export function CmsContentCardGrid({
  entryId,
  title,
  ownerName,
  createdAt,
  avatarUrl,
  status,
  onOpen,
}: CmsEntryCardGridProps) {
  const locale = useLocale();
  const t = useTranslations("cms.content.card");
  const resolvedOwner = ownerName?.trim()
    ? ownerName.trim()
    : t("fallbackOwner");
  const resolvedDate = formatCreatedDate(locale, t("fallbackDate"), createdAt);
  const metaText = `${resolvedOwner} · ${resolvedDate}`;
  // BUG-CMS-7: archived entries dim their visual treatment and surface a
  // dedicated subtle badge + aria-label hint so screen readers announce the
  // archived state. The card stays focusable + clickable so users can navigate
  // in to un-archive.
  const isArchived = status === "archived";
  const cardAriaLabel = isArchived
    ? t("archivedAriaLabel", { title })
    : t("openAriaLabel", { title });

  return (
    <Card
      role="button"
      tabIndex={0}
      data-testid="cms-content-card-grid"
      data-status={status}
      aria-label={cardAriaLabel}
      className={`flex h-full cursor-pointer flex-col gap-4 border-border bg-background p-4 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background${
        isArchived ? " opacity-60 grayscale" : ""
      }`}
      onClick={() => onOpen(entryId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(entryId);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar
          size="md"
          src={avatarUrl ?? undefined}
          alt={t("avatarAlt", { owner: resolvedOwner })}
          fallbackInitials={resolvedOwner}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-2xl leading-8 font-medium text-foreground">
            {title}
          </h3>
          <p className="truncate text-sm leading-5 text-foreground/90">
            {metaText}
          </p>
        </div>
        {status === "draft" ? (
          <Badge
            variant="outline"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
          >
            {t("draft")}
          </Badge>
        ) : null}
        {status === "archived" ? (
          <Badge
            variant="subtle"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
          >
            {t("archived")}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}
