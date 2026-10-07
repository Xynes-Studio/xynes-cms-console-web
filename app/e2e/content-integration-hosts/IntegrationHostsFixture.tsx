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
import {
  FixtureEntryStateSchema,
  type FixtureEntryState,
  type IntegrationFixtureContext,
} from "../../../src/lib/testing/cms-integration-fixture";
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
  live,
  initialState,
  folder: folderSelection = "news",
  legacy = false,
}: {
  host: "list" | "grid" | "editor" | "root";
  disabled: boolean;
  long?: boolean;
  live?: IntegrationFixtureContext;
  initialState?: FixtureEntryState;
  folder?: "news" | "empty" | "moved";
  legacy?: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const currentWorkspace = live
    ? {
        ...workspace,
        workspaceId: live.workspaceId,
        apiBaseUrl: live.gatewayOrigin,
      }
    : workspace;
  const currentDirectory = live
    ? {
        ...directory,
        id:
          folderSelection === "empty"
            ? live.emptyDirectoryId
            : folderSelection === "moved"
              ? live.movedDirectoryId
              : live.directoryId,
        label:
          folderSelection === "empty"
            ? "Empty"
            : folderSelection === "moved"
              ? "Moved"
              : directory.label,
      }
    : directory;
  const [storedEntry, setStoredEntry] = useState({
    ...savedEntry,
    ...(initialState ?? {}),
    id: live ? (legacy ? live.legacyEntryId : live.entryId) : savedEntry.id,
    workspaceId: currentWorkspace.workspaceId,
    deliveryState:
      initialState?.deliveryState ??
      (legacy ? ("republish_required" as const) : ("available" as const)),
    title: legacy
      ? "Legacy publication"
      : (initialState?.title ?? savedEntry.title),
  });
  const currentBody = useRef<LumiaEditorStateJSON | null>(null);
  const [title, setTitle] = useState(
    long ? "LongResource".repeat(100) : storedEntry.title,
  );
  const [description, setDescription] = useState("Draft description");
  const [tags, setTags] = useState("news");
  const [saveCalls, setSaveCalls] = useState(0);
  const [publishCalls, setPublishCalls] = useState(0);
  const [bodyChanges, setBodyChanges] = useState(0);
  const lastBody = useRef<string | undefined>(undefined);
  const onEditorChange = useCallback((value: LumiaEditorStateJSON) => {
    currentBody.current = value;
    const serialized = JSON.stringify(value);
    if (lastBody.current !== undefined && lastBody.current !== serialized)
      setBodyChanges((previous) => previous + 1);
    lastBody.current = serialized;
  }, [setBodyChanges]);
  const t = useTranslations("cms.contentIntegrations");
  const enabled = isContentIntegrationsEnabled() && !disabled;
  const dialog = useIntegrationDialog(host, enabled);
  const publicationState = resolveIntegrationPublicationState(
    storedEntry,
    title !== storedEntry.title || bodyChanges > 0,
  );
  const entry = buildEntryIntegrationContext({
    ...currentWorkspace,
    entryId: storedEntry.id,
    entry: storedEntry,
    label: title,
    publicationState,
  });
  const folder = buildDirectoryIntegrationContext({
    ...currentWorkspace,
    directory: host === "root" ? null : currentDirectory,
  });
  const openEntry = (id: string, trigger: HTMLButtonElement | null) => {
    if (id === storedEntry.id && entry) dialog.open(entry, trigger);
  };
  const callbacks = {
    onOpen: () => {},
    onDelete: () => {},
    onShare: () => {},
    onToggleFavorite: () => {},
  };
  async function mutate(action: "save" | "publish") {
    if (!live) {
      if (action === "save") setSaveCalls((count) => count + 1);
      else setPublishCalls((count) => count + 1);
      return;
    }
    const response = await fetch("/api/e2e/cms-integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "save"
          ? {
              action,
              title,
              ...(currentBody.current ? { body: currentBody.current } : {}),
            }
          : { action },
      ),
    });
    if (!response.ok) throw new Error("Isolated authoring fixture failed");
    const state = FixtureEntryStateSchema.parse(await response.json());
    setStoredEntry((previous) => ({ ...previous, ...state }));
    setBodyChanges(0);
    if (action === "save") setSaveCalls((count) => count + 1);
    else setPublishCalls((count) => count + 1);
  }
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
          status={
            storedEntry.status === "scheduled" ? "draft" : storedEntry.status
          }
          publicationState={publicationState}
          saveState="saved"
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onTagsChange={setTags}
          onSaveDraft={() => {
            void mutate("save");
          }}
          onPublish={() => {
            void mutate("publish");
          }}
          integrationIdentity={storedEntry.id}
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
          <LumiaEditor
            value={live && initialState ? initialState.body : null}
            onChange={onEditorChange}
            variant="full"
          />
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
              entryId={storedEntry.id}
              title={title}
              status={
                storedEntry.status === "scheduled"
                  ? "draft"
                  : storedEntry.status
              }
              isFavorite={false}
              {...callbacks}
              onIntegrations={enabled ? openEntry : undefined}
            />
          ) : (
            <CmsContentCardList
              entryId={storedEntry.id}
              title={title}
              status={
                storedEntry.status === "scheduled"
                  ? "draft"
                  : storedEntry.status
              }
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
