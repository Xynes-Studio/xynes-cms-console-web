import type { CmsEntryCardGridProps } from "../../components/dashboard/CmsContentCardGrid";
import type { CmsEntryCardListProps } from "../../components/dashboard/CmsContentCardList";
import type { WorkspaceContentEntry } from "../../lib/dashboard/content-entries-client";

type EntryActionHandlers = {
  onOpen: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onShare: (entryId: string) => void;
  onToggleFavorite: (entryId: string) => void;
};

const resolveCardStatus = (
  status: WorkspaceContentEntry["status"],
): "draft" | "published" => (status === "published" ? "published" : "draft");

export const mapEntryToGridCardProps = ({
  entry,
  onOpen,
}: {
  entry: WorkspaceContentEntry;
  onOpen: EntryActionHandlers["onOpen"];
}): CmsEntryCardGridProps => ({
  entryId: entry.id,
  title: entry.title,
  description: entry.description,
  ownerName: entry.ownerName,
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
  description: entry.description,
  ownerName: entry.ownerName,
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
