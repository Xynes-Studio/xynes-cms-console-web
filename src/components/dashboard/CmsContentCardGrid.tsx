import {
  Avatar,
  Badge,
  Button,
  Card,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@lumia-ui/components";
import { useLocale, useTranslations } from "next-intl";
import {
  type CmsEntryCardCreator,
  resolveOwnerLabel,
} from "./cms-content-card-owner";

// BUG-CMS-8: `creator` is the new authoritative owner field. See
// `cms-content-card-owner.ts` for the full precedence + api_key
// security contract.
export type { CmsEntryCardCreator } from "./cms-content-card-owner";

export type CmsEntryCardGridProps = {
  entryId: string;
  title: string;
  ownerName?: string | null;
  creator?: CmsEntryCardCreator | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
  status: "draft" | "published" | "archived";
  isFavorite: boolean;
  isDeleting?: boolean;
  isFavoritePending?: boolean;
  onOpen: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onShare: (entryId: string) => void;
  onToggleFavorite: (entryId: string) => void;
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
  creator,
  createdAt,
  avatarUrl,
  status,
  isFavorite,
  isDeleting = false,
  isFavoritePending = false,
  onOpen,
  onDelete,
  onShare,
  onToggleFavorite,
}: CmsEntryCardGridProps) {
  const locale = useLocale();
  const t = useTranslations("cms.content.card");
  const resolvedOwner = resolveOwnerLabel({
    creator,
    ownerName,
    apiKeyCreatorLabel: t("apiKeyCreator"),
    fallbackOwnerLabel: t("fallbackOwner"),
  });
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
      data-testid="cms-content-card-grid"
      data-status={status}
      className={`flex h-full flex-col gap-4 border-border bg-background p-4 text-left transition-colors hover:bg-muted/20${
        isArchived ? " opacity-60 grayscale" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={cardAriaLabel}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => onOpen(entryId)}
        >
          <Avatar
            size="md"
            src={avatarUrl ?? undefined}
            alt={t("avatarAlt", { owner: resolvedOwner })}
            fallbackInitials={resolvedOwner}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-2xl leading-8 font-medium text-foreground">
              {title}
            </span>
            <span className="block truncate text-sm leading-5 text-foreground/90">
              {metaText}
            </span>
          </span>
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
        </button>

        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t("actionsAriaLabel", { title })}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ⋯
              </span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              label={isDeleting ? t("deleting") : t("delete")}
              icon="delete"
              variant="destructive"
              disabled={isDeleting}
              onSelect={() => onDelete(entryId)}
            />
            <MenuItem
              label={t("share")}
              icon="external-link"
              onSelect={() => onShare(entryId)}
            />
            <MenuItem
              label={
                isFavoritePending
                  ? t("updating")
                  : isFavorite
                    ? t("unfavorite")
                    : t("favorite")
              }
              icon={isFavorite ? "check" : "star"}
              disabled={isFavoritePending}
              onSelect={() => onToggleFavorite(entryId)}
            />
          </MenuContent>
        </Menu>
      </div>
    </Card>
  );
}
