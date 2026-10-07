import type { WorkspaceContentEntry } from "../../lib/dashboard/content-entries-client";
import type { IntegrationContext } from "./types";
export function isContentIntegrationsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED === "1";
}
type WorkspaceContext = Pick<
  IntegrationContext,
  "workspaceId" | "workspaceSlug" | "apiBaseUrl"
>;
type EntryMetadata = Pick<
  WorkspaceContentEntry,
  | "id"
  | "workspaceId"
  | "title"
  | "status"
  | "deliveryState"
  | "publishedAt"
  | "updatedAt"
>;
export function resolveIntegrationPublicationState(
  entry: EntryMetadata,
  hasUnsavedChanges = false,
): NonNullable<IntegrationContext["publicationState"]> {
  if (entry.status !== "published") return entry.status;
  const publishedAt = Date.parse(entry.publishedAt ?? "");
  const updatedAt = Date.parse(entry.updatedAt);
  return hasUnsavedChanges ||
    (Number.isFinite(publishedAt) &&
      Number.isFinite(updatedAt) &&
      updatedAt - publishedAt > 1000)
    ? "published-with-changes"
    : "published";
}
export function buildDirectoryIntegrationContext({
  directory,
  ...workspace
}: WorkspaceContext & {
  directory: { id: string; label: string; breadcrumb: string } | null;
}): IntegrationContext | null {
  if (!directory?.id || !workspace.workspaceId || !workspace.workspaceSlug)
    return null;
  return {
    ...workspace,
    target: {
      kind: "directory",
      directoryId: directory.id,
      label: directory.label,
      breadcrumb: directory.breadcrumb,
    },
  };
}
export function buildEntryIntegrationContext({
  entryId,
  entry,
  label,
  publicationState,
  ...workspace
}: WorkspaceContext & {
  entryId: string;
  entry: EntryMetadata | null;
  label?: string;
  publicationState?: IntegrationContext["publicationState"];
}): IntegrationContext | null {
  if (
    !entry ||
    entry.id !== entryId ||
    entry.workspaceId !== workspace.workspaceId ||
    !workspace.workspaceSlug
  )
    return null;
  return {
    ...workspace,
    target: { kind: "entry", entryId: entry.id, label: label ?? entry.title },
    publicationState:
      publicationState ?? resolveIntegrationPublicationState(entry),
    deliveryState: entry.deliveryState ?? "unknown",
  };
}
