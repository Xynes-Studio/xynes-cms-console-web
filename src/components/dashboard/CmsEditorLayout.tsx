"use client";

import { useEffect, useMemo, useState, type SVGProps } from "react";
import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  TimePicker,
} from "@lumia-ui/components";
import { Icon, registerIcon, type IconComponent } from "@lumia-ui/icons";

export type CmsEditorSaveState = "idle" | "saving" | "saved" | "error";
export type CmsEditorEntryStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "archived";
export type CmsEditorPublicationState =
  | "draft"
  | "scheduled"
  | "published"
  | "published-with-changes"
  | "archived";

export type CmsEditorLayoutProps = {
  pathLabel: string;
  title: string;
  description: string;
  tags: string;
  status: CmsEditorEntryStatus;
  publicationState: CmsEditorPublicationState;
  saveState: CmsEditorSaveState;
  lastSavedAt?: string | null;
  lastPublishedAt?: string | null;
  hasUnsavedChanges?: boolean;
  isPublishing?: boolean;
  onBack?: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onChangeStatus?: (status: "draft" | "archived") => void;
  onSchedule?: (publishAt: string) => void;
  onRetrySave?: () => void;
  children: React.ReactNode;
};

const RepublishIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M20 6v5h-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 11a8 8 0 1 1-2.34-5.66L20 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArchiveEntryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M4 7.5h16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M6 7.5h12v10.75a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 6 18.25z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 11.5h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M8 4h8l1 3.5H7z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

registerIcon("republish", RepublishIcon as unknown as IconComponent);
registerIcon("archive-entry", ArchiveEntryIcon as unknown as IconComponent);

const toLocalTimeValue = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return `${`${parsed.getHours()}`.padStart(2, "0")}:${`${parsed.getMinutes()}`.padStart(2, "0")}`;
};

const toLocalDateValue = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    0,
    0,
    0,
    0,
  );
};

const buildScheduledPublishAt = (
  date: Date | undefined,
  time: string | undefined,
) => {
  if (!date || !time) {
    return null;
  }

  const [hours, minutes] = time.split(":").map((part) => Number(part));
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const localDate = new Date(date);
  localDate.setHours(hours, minutes, 0, 0);

  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
};

const buildDefaultScheduleDate = () => {
  const base = new Date();
  base.setMinutes(base.getMinutes() + 30, 0, 0);
  const roundedMinutes = Math.ceil(base.getMinutes() / 15) * 15;
  if (roundedMinutes === 60) {
    base.setHours(base.getHours() + 1, 0, 0, 0);
  } else {
    base.setMinutes(roundedMinutes, 0, 0);
  }
  return {
    date: new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      0,
      0,
      0,
      0,
    ),
    time: `${`${base.getHours()}`.padStart(2, "0")}:${`${base.getMinutes()}`.padStart(2, "0")}`,
  };
};

const getScheduleFieldDefaults = (
  publicationState: CmsEditorPublicationState,
  lastPublishedAt?: string | null,
) => {
  if (publicationState === "scheduled") {
    return {
      date: toLocalDateValue(lastPublishedAt),
      time: toLocalTimeValue(lastPublishedAt),
    };
  }

  return buildDefaultScheduleDate();
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

const formatPublishedAt = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

export function CmsEditorLayout({
  pathLabel,
  title,
  description,
  tags,
  status,
  publicationState,
  saveState,
  lastSavedAt,
  lastPublishedAt,
  hasUnsavedChanges = false,
  isPublishing = false,
  onBack,
  onTitleChange,
  onDescriptionChange,
  onTagsChange,
  onSaveDraft,
  onPublish,
  onChangeStatus,
  onSchedule,
  onRetrySave,
  children,
}: CmsEditorLayoutProps) {
  const initialScheduleDefaults = getScheduleFieldDefaults(
    publicationState,
    lastPublishedAt,
  );
  const [isMetaDrawerOpen, setIsMetaDrawerOpen] = useState(false);
  const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    initialScheduleDefaults.date,
  );
  const [scheduleTime, setScheduleTime] = useState<string | undefined>(
    initialScheduleDefaults.time,
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const savedAt = useMemo(() => formatSavedAt(lastSavedAt), [lastSavedAt]);
  const publishedAt = useMemo(
    () => formatPublishedAt(lastPublishedAt),
    [lastPublishedAt],
  );

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

  const publicationMeta = useMemo(() => {
    if (publicationState === "published-with-changes") {
      return {
        badgeLabel: "Live",
        badgeVariant: "default" as const,
        summary: publishedAt
          ? `Changes not live. Last published ${publishedAt}.`
          : "Changes not live. Republish to update the public page.",
        menuHint:
          "Your newest saved draft is ahead of the public page.",
        triggerLabel: "Republish",
        primaryMenuActionLabel: "Republish now",
      };
    }

    if (publicationState === "published") {
      return {
        badgeLabel: "Live",
        badgeVariant: "default" as const,
        summary: publishedAt
          ? `Public page is up to date. Last published ${publishedAt}.`
          : "Public page is up to date.",
        menuHint:
          "The latest saved version is already public.",
        triggerLabel: "Manage",
        primaryMenuActionLabel: null,
      };
    }

    if (publicationState === "scheduled") {
      return {
        badgeLabel: "Scheduled",
        badgeVariant: "outline" as const,
        summary: publishedAt
          ? `Scheduled to go live ${publishedAt}.`
          : "Scheduled to go live.",
        menuHint: "This entry is scheduled and not public yet.",
        triggerLabel: "Manage",
        primaryMenuActionLabel: "Publish now",
      };
    }

    if (publicationState === "archived") {
      return {
        badgeLabel: "Archived",
        badgeVariant: "outline" as const,
        summary: "Archived and hidden from public view.",
        menuHint: "Archived entries stay hidden until you restore or publish them.",
        triggerLabel: "Manage",
        primaryMenuActionLabel: "Publish now",
      };
    }

    return {
      badgeLabel: "Draft",
      badgeVariant: "outline" as const,
      summary: "Private draft. Not visible yet.",
      menuHint: "Draft entries stay private until you publish them.",
      triggerLabel: "Publish",
      primaryMenuActionLabel: "Publish now",
    };
  }, [publicationState, publishedAt]);

  const publicationMenuItems = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      icon: string;
      onSelect: () => void;
      disabled?: boolean;
    }> = [];

    if (publicationMeta.primaryMenuActionLabel) {
      items.push({
        key: "publish",
        label: publicationMeta.primaryMenuActionLabel,
        icon: "republish",
        onSelect: onPublish,
      });
    }

    if (
      onChangeStatus &&
      (status === "published" || status === "scheduled")
    ) {
      items.push({
        key: "draft",
        label: status === "scheduled" ? "Move to draft" : "Unpublish to draft",
        icon: "eye-off",
        onSelect: () => onChangeStatus("draft"),
      });
    }

    if (onChangeStatus && status === "archived") {
      items.push({
        key: "restore-draft",
        label: "Restore to draft",
        icon: "edit",
        onSelect: () => onChangeStatus("draft"),
      });
    }

    if (onChangeStatus && status !== "archived") {
      items.push({
        key: "archive",
        label: "Archive entry",
        icon: "archive-entry",
        onSelect: () => onChangeStatus("archived"),
      });
    }

    return items;
  }, [onChangeStatus, onPublish, publicationMeta, status]);

  const scheduleActionLabel =
    publicationState === "scheduled" ? "Reschedule" : "Schedule";
  const showScheduleAction =
    publicationState === "draft" || publicationState === "scheduled";
  const scheduleHelperText =
    "Pick a local date and time. The CMS will store it in UTC and publish automatically.";
  const scheduleDialogTitle = `${scheduleActionLabel} publishing`;

  const handleScheduleSubmit = () => {
    if (!onSchedule) {
      return;
    }

    const publishAt = buildScheduledPublishAt(scheduleDate, scheduleTime);
    if (!publishAt || Date.parse(publishAt) <= Date.now()) {
      setScheduleError("Choose a future date and time to schedule publishing.");
      return;
    }

    setScheduleError(null);
    onSchedule(publishAt);
    setIsSchedulePopoverOpen(false);
  };

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
    </aside>
  );

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background"
      data-entry-status={status}
    >
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
          {showScheduleAction ? (
            <Popover
              open={isSchedulePopoverOpen}
              onOpenChange={(open) => {
                setIsSchedulePopoverOpen(open);
                if (open) {
                  const nextDefaults = getScheduleFieldDefaults(
                    publicationState,
                    lastPublishedAt,
                  );
                  setScheduleDate(nextDefaults.date);
                  setScheduleTime(nextDefaults.time);
                  setScheduleError(null);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${scheduleActionLabel} content`}
                  onClick={() => setIsSchedulePopoverOpen(true)}
                  disabled={isPublishing}
                >
                  {scheduleActionLabel}
                </Button>
              </PopoverTrigger>
              {isSchedulePopoverOpen ? (
                <PopoverContent
                  align="end"
                  className="w-[22rem] space-y-3 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {scheduleDialogTitle}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {scheduleHelperText}
                    </p>
                  </div>
                  <DatePicker
                    label="Publish date"
                    value={scheduleDate}
                    onChange={setScheduleDate}
                  />
                  <TimePicker
                    label="Publish time"
                    value={scheduleTime}
                    onChange={(value) =>
                      setScheduleTime(typeof value === "string" ? value : undefined)
                    }
                    format="24h"
                    intervalMinutes={15}
                    returnType="string"
                  />
                  {scheduleError ? (
                    <p className="text-xs text-destructive">{scheduleError}</p>
                  ) : null}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsSchedulePopoverOpen(false);
                        setScheduleError(null);
                      }}
                      aria-label="Cancel schedule"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleScheduleSubmit}
                      aria-label="Confirm schedule"
                      disabled={isPublishing}
                    >
                      Confirm
                    </Button>
                  </div>
                </PopoverContent>
              ) : null}
            </Popover>
          ) : null}
          {publicationState === "draft" ? (
            <Button
              size="sm"
              onClick={onPublish}
              aria-label="Publish content"
              disabled={isPublishing}
            >
              {publicationMeta.triggerLabel}
            </Button>
          ) : (
            <Menu>
              <MenuTrigger asChild>
                <Button
                  size="sm"
                  aria-label="Manage publication"
                  disabled={isPublishing}
                >
                  {publicationMeta.triggerLabel}
                  <span aria-hidden="true" className="ml-2 inline-flex shrink-0 opacity-90">
                    <Icon
                      name="chevron-down"
                      size={16}
                      color="currentColor"
                      className="shrink-0"
                    />
                  </span>
                </Button>
              </MenuTrigger>
              <MenuContent align="end" className="w-[18rem]">
                <MenuLabel>Publication</MenuLabel>
                <div className="px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {publicationMeta.menuHint}
                </div>
                {publicationMenuItems.length > 0 ? <MenuSeparator /> : null}
                {publicationMenuItems.map((item) => (
                  <MenuItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    disabled={item.disabled}
                    onSelect={item.onSelect}
                  />
                ))}
              </MenuContent>
            </Menu>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/10 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Badge variant={publicationMeta.badgeVariant}>
            {publicationMeta.badgeLabel}
          </Badge>
          <p className="min-w-0 text-sm text-muted-foreground">
            {publicationMeta.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

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
