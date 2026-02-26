import { Avatar, Badge, Card } from "@lumia-ui/components";

export type CmsEntryCardGridProps = {
  entryId: string;
  title: string;
  description: string;
  ownerName?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
  status: "draft" | "published";
  onOpen: (entryId: string) => void;
};

const fallbackOwner = "Unknown owner";
const fallbackDate = "--";

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

export function CmsContentCardGrid({
  entryId,
  title,
  description,
  ownerName,
  createdAt,
  avatarUrl,
  status,
  onOpen,
}: CmsEntryCardGridProps) {
  const resolvedOwner = ownerName?.trim() ? ownerName.trim() : fallbackOwner;
  const resolvedDate = formatCreatedDate(createdAt);
  const metaText = `${resolvedOwner} · ${resolvedDate}`;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open content ${title}`}
      className="flex h-full cursor-pointer flex-col gap-4 border-border bg-background p-4 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
      <p className="min-h-[72px] overflow-hidden text-base leading-6 text-foreground/90 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
        {description}
      </p>
    </Card>
  );
}

