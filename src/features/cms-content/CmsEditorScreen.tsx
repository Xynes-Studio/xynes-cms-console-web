"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useWorkspace } from "@xynes/auth-sdk";
import { Alert, ConfirmDialog } from "@lumia-ui/components";
import { LumiaEditor } from "@lumia-ui/editor";
import { CmsEditorLayout } from "../../components/dashboard/CmsEditorLayout";
import {
  getWorkspaceContentEntryById,
  updateWorkspaceContentEntry,
  publishWorkspaceContentEntry,
  type WorkspaceContentEntry,
} from "../../lib/dashboard/content-entries-client";
import { useCmsEntryAutosave } from "../../lib/dashboard/use-cms-entry-autosave";
import {
  hasEditorDraftChanged,
  normalizeEditorBody,
} from "./cms-editor-body";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── error sanitizers ─────────────────────────────────────────────────────────
// Raw API errors (from resolveErrorSuffix) may include internal codes and IDs.
// These helpers map them to safe user-facing messages.

const EDITOR_PERMISSION_PATTERN =
  /HTTP\s*403|forbidden|not\s+authorized|permission|authz/i;
const EDITOR_NOT_FOUND_PATTERN = /HTTP\s*404|\bnot\s+found\b/i;
const EDITOR_SERVICE_UNAVAILABLE_PATTERN =
  /HTTP\s*5\d\d|INTERNAL_ERROR|ECONNREFUSED|fetch\s+failed|network\s+error|Failed\s+to\s+fetch/i;
const EDITOR_INVALID_RESPONSE_PATTERN = /Invalid\s+\w+\s+response/i;

function sanitizeLoadError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (EDITOR_PERMISSION_PATTERN.test(raw)) {
    return "You don't have permission to access this entry.";
  }
  if (EDITOR_NOT_FOUND_PATTERN.test(raw)) {
    return "Entry not found.";
  }
  if (EDITOR_SERVICE_UNAVAILABLE_PATTERN.test(raw)) {
    return "CMS service is temporarily unavailable. Please try again.";
  }
  if (EDITOR_INVALID_RESPONSE_PATTERN.test(raw)) {
    return "CMS returned an unexpected response. Please try again.";
  }
  return "Failed to load entry. Please try again.";
}

function sanitizePublishError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (EDITOR_PERMISSION_PATTERN.test(raw)) {
    return "You don't have permission to publish this entry.";
  }
  if (EDITOR_NOT_FOUND_PATTERN.test(raw)) {
    return "Entry not found.";
  }
  if (EDITOR_SERVICE_UNAVAILABLE_PATTERN.test(raw)) {
    return "CMS service is temporarily unavailable. Please try again.";
  }
  return "Failed to publish entry. Please try again.";
}

type EditorDraftValue = {
  title: string;
  description: string;
  tags: string;
  body: ReturnType<typeof normalizeEditorBody>;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildDraftFromEntry(entry: WorkspaceContentEntry): EditorDraftValue {
  return {
    title: entry.title ?? "",
    description: entry.description ?? "",
    tags: Array.isArray(entry.tags) ? entry.tags.join(", ") : "",
    body: JSON.parse(JSON.stringify(normalizeEditorBody(entry.body))),
  };
}

function buildBackPath(workspaceSlug: string): string {
  return `/dashboard/${encodeURIComponent(workspaceSlug)}/content`;
}

// ─── component ───────────────────────────────────────────────────────────────

export type CmsEditorScreenProps = {
  entryId: string;
  /** Provided by the route param — used as a fallback before workspace loads. */
  workspaceSlug: string;
};

export function CmsEditorScreen({
  entryId,
  workspaceSlug,
}: CmsEditorScreenProps) {
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const resolvedSlug = (currentWorkspace?.slug?.trim() || workspaceSlug).trim();

  // ── resolve access token ─────────────────────────────────────────────────
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isAuthLoading || !isAuthenticated || !currentWorkspace?.id) {
        if (!cancelled) setAccessToken(null);
        return;
      }
      try {
        const token = await getAccessToken();
        if (!cancelled) {
          setAccessToken(token?.trim() ? token.trim() : null);
        }
      } catch {
        if (!cancelled) setAccessToken(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id, getAccessToken, isAuthenticated, isAuthLoading]);

  // ── load state ────────────────────────────────────────────────────────────
  const [entry, setEntry] = useState<WorkspaceContentEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editorSeedRevision, setEditorSeedRevision] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ── draft form state ─────────────────────────────────────────────────────
  const [draft, setDraft] = useState<EditorDraftValue>({
    title: "",
    description: "",
    tags: "",
    body: normalizeEditorBody(null),
  });

  // Track last-saved payload to detect unsaved changes
  const lastSavedDraftRef = useRef<EditorDraftValue | null>(null);

  // ── load entry once token + workspace are ready ───────────────────────────
  useEffect(() => {
    if (!currentWorkspace?.id || !accessToken) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    getWorkspaceContentEntryById({
      apiBaseUrl: API_BASE_URL,
      workspaceId: currentWorkspace.id,
      entryId,
      accessToken,
    })
      .then((loadedEntry) => {
        if (cancelled) return;
        const initialDraft = buildDraftFromEntry(loadedEntry);
        setEntry(loadedEntry);
        setDraft(initialDraft);
        lastSavedDraftRef.current = initialDraft;
        setEditorSeedRevision((revision) => revision + 1);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(sanitizeLoadError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id, accessToken, entryId]);

  // ── autosave ─────────────────────────────────────────────────────────────
  const saveDraftFn = useCallback(
    async (value: EditorDraftValue) => {
      if (!currentWorkspace?.id || !accessToken) {
        throw new Error("Not authenticated");
      }
      const trimmedTags = value.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await updateWorkspaceContentEntry({
        apiBaseUrl: API_BASE_URL,
        workspaceId: currentWorkspace.id,
        entryId,
        accessToken,
        payload: {
          title: value.title,
          description: value.description,
          tags: trimmedTags,
          body: normalizeEditorBody(value.body),
        },
      });
      lastSavedDraftRef.current = buildDraftFromEntry(updated);
      setEntry(updated);
    },
    [currentWorkspace?.id, accessToken, entryId],
  );

  const autosave = useCmsEntryAutosave({
    enabled: Boolean(entry && currentWorkspace?.id && accessToken),
    cacheKey: `cms-editor:${entryId}`,
    value: draft,
    delayMs: 2000,
    saveDraft: saveDraftFn,
  });

  const updateDraft = useCallback(
    (updater: (previous: EditorDraftValue) => EditorDraftValue) => {
      if (isPublishing) {
        return;
      }
      setDraft(updater);
    },
    [isPublishing],
  );

  const retryAutosave = useCallback(() => {
    void Promise.resolve()
      .then(() => autosave.retry())
      .catch(() => {
        // Autosave failures are reflected via hook state and inline editor UI.
      });
  }, [autosave]);

  // ── unsaved guard ────────────────────────────────────────────────────────
  const hasUnsavedChanges =
    autosave.saveState === "saving" ||
    autosave.saveState === "error" ||
    (lastSavedDraftRef.current !== null &&
      hasEditorDraftChanged(lastSavedDraftRef.current, draft));

  // ── publish ───────────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!entry || !currentWorkspace?.id || !accessToken || isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);

    try {
      await autosave.flush();
    } catch {
      return;
    }

    try {
      const updated = await publishWorkspaceContentEntry({
        apiBaseUrl: API_BASE_URL,
        workspaceId: currentWorkspace.id,
        entryId,
        accessToken,
      });
      const newDraft = buildDraftFromEntry(updated);
      setEntry(updated);
      lastSavedDraftRef.current = newDraft;
      setDraft(newDraft);
      autosave.clearSnapshot();
    } catch (err: unknown) {
      setPublishError(sanitizePublishError(err));
    } finally {
      setIsPublishing(false);
    }
  }, [entry, currentWorkspace?.id, accessToken, entryId, isPublishing, autosave]);

  // ── back navigation ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true);
      return;
    }
    router.push(buildBackPath(resolvedSlug));
  }, [hasUnsavedChanges, resolvedSlug, router]);

  const handleConfirmLeave = useCallback(() => {
    router.push(buildBackPath(resolvedSlug));
  }, [resolvedSlug, router]);

  // ── render ────────────────────────────────────────────────────────────────
  if (isLoading || isAuthLoading) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
        aria-busy="true"
        aria-label="Loading entry"
      >
        Loading entry…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Alert
          variant="error"
          title="Failed to load entry"
          description={loadError}
          data-testid="editor-load-error"
        />
      </div>
    );
  }

  if (!entry) {
    return null;
  }

  const pathLabel = `/${resolvedSlug}/content/${entry.id}`;
  return (
    <>
      {publishError ? (
        <div className="px-4 pt-2">
          <Alert
            variant="error"
            title="Publish failed"
            description={publishError}
            data-testid="editor-publish-error"
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        title="Leave editor?"
        description="You have unsaved changes. Leave this editor?"
        confirmLabel="Leave editor"
        cancelLabel="Stay here"
        onConfirm={handleConfirmLeave}
      />
      <CmsEditorLayout
        pathLabel={pathLabel}
        title={draft.title}
        description={draft.description}
        tags={draft.tags}
        status={entry.status === "published" ? "published" : "draft"}
        saveState={autosave.saveState}
        lastSavedAt={autosave.lastSavedAt}
        hasUnsavedChanges={hasUnsavedChanges}
        isPublishing={isPublishing}
        onBack={handleBack}
        onTitleChange={(value) =>
          updateDraft((prev) => ({ ...prev, title: value }))
        }
        onDescriptionChange={(value) =>
          updateDraft((prev) => ({ ...prev, description: value }))
        }
        onTagsChange={(value) =>
          updateDraft((prev) => ({ ...prev, tags: value }))
        }
        onSaveDraft={retryAutosave}
        onPublish={() => {
          void handlePublish();
        }}
        onRetrySave={retryAutosave}
      >
        <LumiaEditor
          key={`${entryId}:${editorSeedRevision}`}
          value={draft.body}
          readOnly={isPublishing}
          onChange={(value) =>
            updateDraft((prev) => ({
              ...prev,
              body: normalizeEditorBody(value),
            }))
          }
          variant="full"
          className="min-h-75"
        />
      </CmsEditorLayout>
    </>
  );
}
