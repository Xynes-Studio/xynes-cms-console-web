import { Avatar, Badge, Button, Card } from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";
import { useLocale, useTranslations } from "next-intl";

export type CmsEntryCardListProps = {
  entryId: string;
  title: string;
  ownerName?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
  status: "draft" | "published";
  collaborators: string[];
  isFavorite: boolean;
  isDeleting?: boolean;
  isFavoritePending?: boolean;
  onOpen: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onShare: (entryId: string) => void;
  onToggleFavorite: (entryId: string) => void;
};

const maxVisibleCollaborators = 3;

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

const formatCollaborators = (collaborators: string[]) => {
  if (!collaborators.length) {
    return "";
  }

  const visible = collaborators.slice(0, maxVisibleCollaborators);
  const overflow = collaborators.length - visible.length;
  const base = visible.join(", ");

  return overflow > 0 ? `${base}, +${overflow}` : base;
};

export function CmsContentCardList({
  entryId,
  title,
  ownerName,
  createdAt,
  avatarUrl,
  status,
  collaborators,
  isFavorite,
  isDeleting = false,
  isFavoritePending = false,
  onOpen,
  onDelete,
  onShare,
  onToggleFavorite,
}: CmsEntryCardListProps) {
  const locale = useLocale();
  const t = useTranslations("cms.content.card");
  const resolvedOwner = ownerName?.trim()
    ? ownerName.trim()
    : t("fallbackOwner");
  const resolvedDate = formatCreatedDate(locale, t("fallbackDate"), createdAt);
  const collaboratorText = formatCollaborators(collaborators);
  const metaText = collaboratorText
    ? `${resolvedOwner} · ${resolvedDate} · ${collaboratorText}`
    : `${resolvedOwner} · ${resolvedDate}`;

  return (
    <Card
      data-testid="cms-content-card-list"
      className="flex flex-col gap-4 border-border bg-background p-4"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={t("openAriaLabel", { title })}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={t("deleteAriaLabel", { title })}
          disabled={isDeleting}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(entryId);
          }}
        >
          <Icon name="delete" size="sm" />
          {isDeleting ? t("deleting") : t("delete")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("shareAriaLabel", { title })}
          onClick={(event) => {
            event.stopPropagation();
            onShare(entryId);
          }}
        >
          <Icon name="external-link" size="sm" />
          {t("share")}
        </Button>
        <Button
          variant={isFavorite ? "secondary" : "outline"}
          size="sm"
          aria-pressed={isFavorite}
          aria-label={t(
            isFavorite ? "unfavoriteAriaLabel" : "favoriteAriaLabel",
            { title },
          )}
          disabled={isFavoritePending}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(entryId);
          }}
        >
          <Icon name={isFavorite ? "check" : "add"} size="sm" />
          {isFavoritePending
            ? t("updating")
            : isFavorite
              ? t("favorited")
              : t("favorite")}
        </Button>
      </div>
    </Card>
  );
}
