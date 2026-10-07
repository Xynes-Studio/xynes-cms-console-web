"use client";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Flex } from "@lumia-ui/components";
import { LumiaEditor, type LumiaEditorStateJSON } from "@lumia-ui/editor";
import { useTranslations } from "next-intl";
import { CmsContentToolbar } from "../../../src/components/dashboard/CmsContentToolbar";
import { CmsContentCardGrid } from "../../../src/components/dashboard/CmsContentCardGrid";
import { CmsContentCardList } from "../../../src/components/dashboard/CmsContentCardList";
import { CmsEditorLayout } from "../../../src/components/dashboard/CmsEditorLayout";
import { ContentIntegrationPanel } from "../../../src/features/content-integrations/ContentIntegrationPanel";
import { ContentIntegrationDialog } from "../../../src/features/content-integrations/ContentIntegrationDialog";
import { useIntegrationDialog } from "../../../src/features/content-integrations/useIntegrationDialog";
import {
  buildDirectoryIntegrationContext,
  buildEntryIntegrationContext,
  isContentIntegrationsEnabled,
  resolveIntegrationPublicationState,
} from "../../../src/features/content-integrations/host-context";
const subscribe = () => () => {};
const workspace = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workspaceSlug: "editorial",
  apiBaseUrl: "https://api.xynes.com",
};
const directory = {
  id: "22222222-2222-4222-8222-222222222222",
  label: "News",
  breadcrumb: "Content / News",
};
const savedEntry = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: workspace.workspaceId,
  title: "First story",
  status: "published" as const,
  deliveryState: "available" as const,
  publishedAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};
export function IntegrationHostsFixture({
  host,
  disabled,
  long = false,
}: {
  host: "list" | "grid" | "editor" | "root";
  disabled: boolean;
  long?: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [title, setTitle] = useState(
    long ? "LongResource".repeat(100) : savedEntry.title,
  );
  const [description, setDescription] = useState("Draft description");
  const [tags, setTags] = useState("news");
  const [saveCalls, setSaveCalls] = useState(0);
  const [publishCalls, setPublishCalls] = useState(0);
  const [bodyChanges, setBodyChanges] = useState(0);
  const lastBody = useRef<string | undefined>(undefined);
  const onEditorChange = useCallback((value: LumiaEditorStateJSON) => {
    const serialized = JSON.stringify(value);
    if (lastBody.current !== undefined && lastBody.current !== serialized)
      setBodyChanges((previous) => previous + 1);
    lastBody.current = serialized;
  }, []);
  const t = useTranslations("cms.contentIntegrations");
  const enabled = isContentIntegrationsEnabled() && !disabled;
  const dialog = useIntegrationDialog(host, enabled);
  const publicationState = resolveIntegrationPublicationState(
    savedEntry,
    title !== savedEntry.title || bodyChanges > 0,
  );
  const entry = buildEntryIntegrationContext({
    ...workspace,
    entryId: savedEntry.id,
    entry: savedEntry,
    label: title,
    publicationState,
  });
  const folder = buildDirectoryIntegrationContext({
    ...workspace,
    directory: host === "root" ? null : directory,
  });
  const openEntry = (id: string, trigger: HTMLButtonElement | null) => {
    if (id === savedEntry.id && entry) dialog.open(entry, trigger);
  };
  const callbacks = {
    onOpen: () => {},
    onDelete: () => {},
    onShare: () => {},
    onToggleFavorite: () => {},
  };
  return (
    <Flex
      direction="col"
      className="h-screen"
      data-testid="integration-hosts-fixture"
      data-ready={ready}
    >
      <nav aria-label="Fixture hosts" className="p-2">
        {(["list", "grid", "editor", "root"] as const).map((mode) => (
          <a key={mode} href={`?host=${mode}`} className="mr-4 underline">
            {mode}
          </a>
        ))}
        <span data-testid="fixture-save-calls">{saveCalls}</span>
        <span data-testid="fixture-publish-calls">{publishCalls}</span>
      </nav>
      {host === "editor" ? (
        <CmsEditorLayout
          pathLabel="/editorial/content/first-story"
          title={title}
          description={description}
          tags={tags}
          status="published"
          publicationState={publicationState}
          saveState="saved"
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onTagsChange={setTags}
          onSaveDraft={() => setSaveCalls((count) => count + 1)}
          onPublish={() => setPublishCalls((count) => count + 1)}
          integrationIdentity={savedEntry.id}
          integrationPanel={
            enabled && entry ? (
              <ContentIntegrationPanel context={entry} />
            ) : undefined
          }
          integrationDialogOpen={Boolean(dialog.context)}
          onCustomizeIntegrations={(focus) => {
            if (entry) dialog.open(entry, focus);
          }}
        >
          <LumiaEditor value={null} onChange={onEditorChange} variant="full" />
        </CmsEditorLayout>
      ) : (
        <>
          <CmsContentToolbar
            breadcrumbItems={[{ label: host === "root" ? "Content" : "News" }]}
            itemCount={1}
            query=""
            sortBy="date"
            view={host === "grid" ? "grid" : "list"}
            followingOnly={false}
            favoritesOnly={false}
            onCreate={() => {}}
            onQueryChange={() => {}}
            onSearchSubmit={() => {}}
            onSortChange={() => {}}
            onViewChange={() => {}}
            onFollowingToggle={() => {}}
            onFavoritesToggle={() => {}}
            onIntegrations={
              enabled
                ? (trigger) => {
                    if (folder) dialog.open(folder, trigger);
                  }
                : undefined
            }
            integrationsTargetLabel={folder?.target.label}
            integrationsDisabled={!folder}
            integrationsUnavailableReason={
              enabled && !folder ? t("hosts.openFolder") : undefined
            }
          />
          {host === "grid" ? (
            <CmsContentCardGrid
              entryId={savedEntry.id}
              title={title}
              status="published"
              isFavorite={false}
              {...callbacks}
              onIntegrations={enabled ? openEntry : undefined}
            />
          ) : (
            <CmsContentCardList
              entryId={savedEntry.id}
              title={title}
              status="published"
              collaborators={[]}
              isFavorite={false}
              {...callbacks}
              onIntegrations={enabled ? openEntry : undefined}
            />
          )}
        </>
      )}
      {dialog.context && (
        <ContentIntegrationDialog
          context={
            dialog.context.target.kind === "entry" && entry
              ? entry
              : dialog.context
          }
          open
          onOpenChange={(open) => {
            if (!open) dialog.close();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            dialog.restoreFocus();
          }}
        />
      )}
    </Flex>
  );
}
