"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Drawer, Input, Textarea } from "@lumia-ui/components";
import { Icon } from "@lumia-ui/icons";

export type CmsEditorSaveState = "idle" | "saving" | "saved" | "error";

export type CmsEditorLayoutProps = {
  pathLabel: string;
  title: string;
  description: string;
  tags: string;
  status: "draft" | "published";
  saveState: CmsEditorSaveState;
  lastSavedAt?: string | null;
  hasUnsavedChanges?: boolean;
  isPublishing?: boolean;
  onBack?: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onRetrySave?: () => void;
  children: React.ReactNode;
};

const formatSavedAt = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

export function CmsEditorLayout({
  pathLabel,
  title,
  description,
  tags,
  status,
  saveState,
  lastSavedAt,
  hasUnsavedChanges = false,
  isPublishing = false,
  onBack,
  onTitleChange,
  onDescriptionChange,
  onTagsChange,
  onSaveDraft,
  onPublish,
  onRetrySave,
  children,
}: CmsEditorLayoutProps) {
  const [isMetaDrawerOpen, setIsMetaDrawerOpen] = useState(false);
  const savedAt = useMemo(() => formatSavedAt(lastSavedAt), [lastSavedAt]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const statusText =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save failed, retrying"
        : saveState === "saved"
          ? `Saved at ${savedAt ?? "--:--:--"}`
          : "Idle";

  const metadataPanel = (
    <aside className="flex h-full flex-col gap-4 border-r border-border bg-background p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Path</p>
        <p className="truncate text-sm text-foreground" title={pathLabel}>
          {pathLabel}
        </p>
      </div>

      <Input
        aria-label="Content title"
        placeholder="Title"
        value={title}
        disabled={isPublishing}
        onChange={(event) => onTitleChange(event.currentTarget.value)}
      />
      <Textarea
        aria-label="Content description"
        placeholder="Description"
        value={description}
        disabled={isPublishing}
        onChange={(event) => onDescriptionChange(event.currentTarget.value)}
      />
      <Input
        aria-label="Content tags"
        placeholder="Tags (comma separated)"
        value={tags}
        disabled={isPublishing}
        onChange={(event) => onTagsChange(event.currentTarget.value)}
      />

      <div className="mt-auto">
        <Badge variant={status === "draft" ? "outline" : "default"}>
          {status === "draft" ? "Draft" : "Published"}
        </Badge>
      </div>
    </aside>
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              aria-label="Back to content list"
              disabled={isPublishing}
            >
              <Icon name="chevron-left" size="sm" />
              Back
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMetaDrawerOpen(true)}
            aria-label="Open metadata panel"
            disabled={isPublishing}
          >
            <Icon name="edit" size="sm" />
            Metadata
          </Button>
          <p aria-live="polite" className="text-sm text-foreground/90">
            {statusText}
          </p>
          {saveState === "error" && onRetrySave ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetrySave}
              aria-label="Retry save"
              className="text-destructive hover:text-destructive"
              disabled={isPublishing}
            >
              Retry
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            aria-label="Save draft"
            disabled={isPublishing}
          >
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={onPublish}
            aria-label="Publish content"
            disabled={isPublishing}
          >
            Publish
          </Button>
        </div>
      </header>

      <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[minmax(240px,20%)_1fr]">
        <div className="hidden md:block">{metadataPanel}</div>
        <main className="min-h-0 overflow-auto bg-muted/20 p-4" aria-label="Content editor canvas">
          {children}
        </main>
      </div>

      <Drawer open={isMetaDrawerOpen} onOpenChange={setIsMetaDrawerOpen} side="left">
        {metadataPanel}
      </Drawer>
    </section>
  );
}
