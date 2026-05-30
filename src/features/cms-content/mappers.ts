import type { CmsEntryCardGridProps } from "../../components/dashboard/CmsContentCardGrid";
import type { CmsEntryCardListProps } from "../../components/dashboard/CmsContentCardList";
import type { WorkspaceContentEntry } from "../../lib/dashboard/content-entries-client";

type EntryActionHandlers = {
  onOpen: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onShare: (entryId: string) => void;
  onToggleFavorite: (entryId: string) => void;
};

// BUG-CMS-7: archived is now a first-class status surfaced on the cards.
const resolveCardStatus = (
  status: WorkspaceContentEntry["status"],
): "draft" | "published" | "archived" => {
  if (status === "published") {
    return "published";
  }
  if (status === "archived") {
    return "archived";
  }
  return "draft";
};

export const mapEntryToGridCardProps = ({
  entry,
  onOpen,
}: {
  entry: WorkspaceContentEntry;
  onOpen: EntryActionHandlers["onOpen"];
}): CmsEntryCardGridProps => ({
  entryId: entry.id,
  title: entry.title,
  ownerName: entry.ownerName,
  // BUG-CMS-8: forward the structured creator so the card renders the
  // real human display name (or the localized "Created via API key"
  // label when the entry was created by an api_key actor).
  creator: entry.creator,
  createdAt: entry.createdAt,
  avatarUrl: entry.avatarUrl,
  status: resolveCardStatus(entry.status),
  onOpen,
});

export const mapEntryToListCardProps = ({
  entry,
  handlers,
  isDeleting = false,
  isFavoritePending = false,
}: {
  entry: WorkspaceContentEntry;
  handlers: EntryActionHandlers;
  isDeleting?: boolean;
  isFavoritePending?: boolean;
}): CmsEntryCardListProps => ({
  entryId: entry.id,
  title: entry.title,
  ownerName: entry.ownerName,
  // BUG-CMS-8: same forwarding rule as the grid mapper.
  creator: entry.creator,
  createdAt: entry.createdAt,
  avatarUrl: entry.avatarUrl,
  status: resolveCardStatus(entry.status),
  collaborators: entry.collaborators,
  isFavorite: entry.isFavorite,
  isDeleting,
  isFavoritePending,
  onOpen: handlers.onOpen,
  onDelete: handlers.onDelete,
  onShare: handlers.onShare,
  onToggleFavorite: handlers.onToggleFavorite,
});
