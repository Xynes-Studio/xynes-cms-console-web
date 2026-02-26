import { Avatar, Badge, Button, Card } from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";

export type CmsEntryCardListProps = {
  entryId: string;
  title: string;
  description: string;
  ownerName?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
  status: "draft" | "published";
  collaborators: string[];
  isFavorite: boolean;
  onOpen: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onShare: (entryId: string) => void;
  onToggleFavorite: (entryId: string) => void;
};

const fallbackOwner = "Unknown owner";
const fallbackDate = "--";
const maxVisibleCollaborators = 3;

const formatCreatedDate = (createdAt?: string | null) => {
  if (!createdAt) {
    return fallbackDate;
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate;
  }

  return new Intl.DateTimeFormat("en-US", {
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
  description,
  ownerName,
  createdAt,
  avatarUrl,
  status,
  collaborators,
  isFavorite,
  onOpen,
  onDelete,
  onShare,
  onToggleFavorite,
}: CmsEntryCardListProps) {
  const resolvedOwner = ownerName?.trim() ? ownerName.trim() : fallbackOwner;
  const resolvedDate = formatCreatedDate(createdAt);
  const collaboratorText = formatCollaborators(collaborators);
  const metaText = collaboratorText
    ? `${resolvedOwner} · ${resolvedDate} · ${collaboratorText}`
    : `${resolvedOwner} · ${resolvedDate}`;

  return (
    <Card className="flex flex-col gap-4 border-border bg-background p-4">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open content ${title}`}
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
            alt={`${resolvedOwner} avatar`}
            fallbackInitials={resolvedOwner}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-2xl leading-8 font-medium text-foreground">{title}</h3>
            <p className="truncate text-sm leading-5 text-foreground/90">{metaText}</p>
          </div>
          {status === "draft" ? (
            <Badge variant="outline" className="shrink-0 rounded-md px-2 py-1 text-xs font-medium">
              Draft
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 min-h-[72px] overflow-hidden text-base leading-6 text-foreground/90 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Delete content ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(entryId);
          }}
        >
          <Icon name="delete" size="sm" />
          Delete
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Share content ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onShare(entryId);
          }}
        >
          <Icon name="info" size="sm" />
          Share
        </Button>
        <Button
          variant={isFavorite ? "secondary" : "outline"}
          size="sm"
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? "Unfavorite" : "Favorite"} content ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(entryId);
          }}
        >
          <Icon name={isFavorite ? "check" : "add"} size="sm" />
          Favourite
        </Button>
      </div>
    </Card>
  );
}
