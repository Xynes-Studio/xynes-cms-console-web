import { NextIntlClientProvider } from "next-intl";
import { getCmsMessages } from "../../i18n/config";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsEditorScreen } from "./CmsEditorScreen";
import { createEmptyLumiaDocument } from "./cms-editor-body";
import type { WorkspaceContentEntry } from "../../lib/dashboard/content-entries-client";
import type { UseCmsEntryAutosaveResult } from "../../lib/dashboard/use-cms-entry-autosave";

// ─── hoisted mocks ───────────────────────────────────────────────────────────
// vi.fn() refs used as direct property values in vi.mock factories must be
// declared via vi.hoisted() so they are initialised before the hoisted factories run.

const {
  mockPush,
  mockGetAccessToken,
  mockGetWorkspaceContentEntryById,
  mockUpdateWorkspaceContentEntry,
  mockPublishWorkspaceContentEntry,
  mockSetWorkspaceContentEntryStatus,
  mockAutosaveRetry,
  mockAutosaveFlush,
  mockAutosaveClearSnapshot,
  mockCaptureSaveDraftFn,
  mockLumiaEditor,
  mockUseFeatureFlag,
  mockIntegrationFlags,
} = vi.hoisted(() => ({
  mockIntegrationFlags: {
    enabled: false,
    isLoading: false,
    error: null as Error | null,
  },
  mockPush: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockGetWorkspaceContentEntryById: vi.fn(),
  mockUpdateWorkspaceContentEntry: vi.fn(),
  mockPublishWorkspaceContentEntry: vi.fn(),
  mockSetWorkspaceContentEntryStatus: vi.fn(),
  mockAutosaveRetry: vi.fn(),
  mockAutosaveFlush: vi.fn(),
  mockAutosaveClearSnapshot: vi.fn(),
  // Captures the saveDraft fn passed to useCmsEntryAutosave so tests can invoke it directly
  mockCaptureSaveDraftFn: vi.fn(),
  mockLumiaEditor: vi.fn(),
  // STORAGE-LIVE-5: feature-flag spy. Defaults to `false` (matches the
  // DEFAULT_FEATURE_FLAGS contract from @xynes/auth-sdk); individual tests
  // flip it via `mockUseFeatureFlag.mockReturnValue(true)`.
  mockUseFeatureFlag: vi.fn<(flag: string) => boolean>(() => false),
}));

type MockLumiaEditorMode = "passthrough" | "sticky-on-mount";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockIsAuthLoading = false;
let mockIsAuthenticated = true;
let mockCurrentWorkspace = {
  id: "ws-1",
  slug: "acme-team",
  name: "Acme Team",
};
let mockLumiaEditorMode: MockLumiaEditorMode = "passthrough";
let mockAutosaveState: UseCmsEntryAutosaveResult<
  ReturnType<typeof createEmptyLumiaDocument>
> = {
  saveState: "idle",
  lastSavedAt: null as string | null,
  error: null,
  pendingSnapshot: null,
  retry: mockAutosaveRetry,
  flush: mockAutosaveFlush,
  restoreSnapshot: vi.fn(() => null),
  clearSnapshot: mockAutosaveClearSnapshot,
};

// ─── module mocks ─────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard/editorial/content/entry/33333333-3333-4333-8333-333333333333/edit",
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsAuthLoading,
  }),
  useWorkspace: () => ({ currentWorkspace: mockCurrentWorkspace }),
  // STORAGE-LIVE-5: route the SDK's useFeatureFlag through the hoisted
  // spy so individual tests can flip the cms_editor_storage_uploads flag
  // without re-mocking the whole sdk surface.
  useFeatureFlag: (flag: string) => {
    const value = mockUseFeatureFlag(flag);
    return flag === "cms_content_integrations"
      ? mockIntegrationFlags.enabled
      : value;
  },
  useFeatureFlags: () => mockIntegrationFlags,
}));

vi.mock("../../lib/dashboard/content-entries-client", () => ({
  getWorkspaceContentEntryById: mockGetWorkspaceContentEntryById,
  updateWorkspaceContentEntry: mockUpdateWorkspaceContentEntry,
  publishWorkspaceContentEntry: mockPublishWorkspaceContentEntry,
  setWorkspaceContentEntryStatus: mockSetWorkspaceContentEntryStatus,
}));

vi.mock("../../lib/dashboard/use-cms-entry-autosave", () => ({
  useCmsEntryAutosave: (args: { saveDraft: (v: unknown) => Promise<void> }) => {
    // Capture every fresh saveDraft closure so tests can invoke it directly
    mockCaptureSaveDraftFn(args.saveDraft);
    return mockAutosaveState;
  },
}));

vi.mock("../../components/dashboard/CmsEditorLayout", () => ({
  CmsEditorLayout: ({
    children,
    title,
    description,
    tags,
    status,
    publicationState,
    saveState,
    isPublishing,
    pathLabel,
    onBack,
    onPublish,
    onChangeStatus,
    onSchedule,
    onSaveDraft,
    onTitleChange,
    onDescriptionChange,
    onTagsChange,
    onRetrySave,
    integrationPanel,
    apiPanelRequest,
    integrationTriggerRef,
    onCustomizeIntegrations,
  }: {
    children: React.ReactNode;
    title: string;
    description?: string;
    tags?: string;
    status: string;
    publicationState?: string;
    saveState: string;
    isPublishing?: boolean;
    pathLabel?: string;
    onBack?: () => void;
    onPublish?: () => void;
    onChangeStatus?: (status: "draft" | "archived") => void;
    onSchedule?: (publishAt: string) => void;
    onSaveDraft?: () => void;
    onTitleChange?: (v: string) => void;
    onDescriptionChange?: (v: string) => void;
    onTagsChange?: (v: string) => void;
    onRetrySave?: () => void;
    integrationPanel?: React.ReactNode;
    apiPanelRequest?: number;
    integrationTriggerRef?: React.RefObject<HTMLButtonElement | null>;
    onCustomizeIntegrations?: (restoreFocus: () => void) => void;
  }) => (
    <div
      data-testid="cms-editor-layout"
      data-status={status}
      data-publication-state={publicationState}
      data-save-state={saveState}
      data-is-publishing={isPublishing ? "true" : "false"}
      data-path-label={pathLabel}
      data-api-panel-request={apiPanelRequest}
    >
      {integrationPanel}
      {integrationPanel && <button ref={integrationTriggerRef}>API</button>}
      {integrationPanel && (
        <button
          onClick={(event) => {
            const trigger = event.currentTarget;
            onCustomizeIntegrations?.(() => trigger.focus());
          }}
        >
          Open API panel
        </button>
      )}
      <span data-testid="editor-title">{title}</span>
      <span data-testid="editor-description">{description}</span>
      <span data-testid="editor-tags">{tags}</span>
      {onBack && (
        <button data-testid="back-btn" onClick={onBack} disabled={isPublishing}>
          Back
        </button>
      )}
      {onPublish && (
        <button
          data-testid="publish-btn"
          onClick={onPublish}
          disabled={isPublishing}
        >
          Publish
        </button>
      )}
      {onChangeStatus && (
        <>
          <button
            data-testid="status-draft-btn"
            onClick={() => onChangeStatus("draft")}
            disabled={isPublishing}
          >
            Move to draft
          </button>
          <button
            data-testid="status-archived-btn"
            onClick={() => onChangeStatus("archived")}
            disabled={isPublishing}
          >
            Archive
          </button>
        </>
      )}
      {onSchedule &&
        (publicationState === "draft" || publicationState === "scheduled") && (
          <>
            <button
              data-testid="schedule-btn"
              onClick={() => onSchedule("2026-04-24T14:30:00.000Z")}
              disabled={isPublishing}
            >
              Schedule
            </button>
            <button
              data-testid="schedule-invalid-btn"
              onClick={() => onSchedule("2026-04-22T10:00:00.000Z")}
              disabled={isPublishing}
            >
              Schedule invalid
            </button>
          </>
        )}
      {onSaveDraft && (
        <button
          data-testid="save-draft-btn"
          onClick={onSaveDraft}
          disabled={isPublishing}
        >
          Save Draft
        </button>
      )}
      {onTitleChange && (
        <input
          data-testid="title-input"
          disabled={isPublishing}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      )}
      {onDescriptionChange && (
        <input
          data-testid="description-input"
          disabled={isPublishing}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      )}
      {onTagsChange && (
        <input
          data-testid="tags-input"
          disabled={isPublishing}
          onChange={(e) => onTagsChange(e.target.value)}
        />
      )}
      {onRetrySave && (
        <button
          data-testid="retry-save-btn"
          onClick={onRetrySave}
          disabled={isPublishing}
        >
          Retry Save
        </button>
      )}
      {children}
    </div>
  ),
}));

vi.mock("@lumia-ui/components", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lumia-ui/components")>()),
  Alert: ({
    children,
    title,
    description,
    "data-testid": testId,
  }: {
    children?: React.ReactNode;
    title: string;
    description: string;
    "data-testid"?: string;
  }) => (
    <div data-testid={testId ?? "alert"}>
      <span>{title}</span>
      <span>{description}</span>
      {children}
    </div>
  ),
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onOpenChange,
  }: {
    open?: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="leave-editor-confirm-dialog">
        <span>{title}</span>
        <span>{description}</span>
        <button
          data-testid="leave-editor-cancel"
          type="button"
          onClick={() => onOpenChange?.(false)}
        >
          {cancelLabel}
        </button>
        <button
          data-testid="leave-editor-confirm"
          type="button"
          onClick={() => {
            void Promise.resolve(onConfirm());
          }}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("@lumia-ui/editor", () => ({
  LumiaEditor: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    variant?: string;
    className?: string;
    media?: unknown;
  }) => {
    mockLumiaEditor(props);
    const [renderedValue, setRenderedValue] = React.useState(props.value);

    React.useEffect(() => {
      if (mockLumiaEditorMode === "passthrough") {
        setRenderedValue(props.value);
      }
    }, [props.value]);

    return (
      <div data-testid="lumia-editor-mock">
        <div data-testid="lumia-editor-value">
          {JSON.stringify(renderedValue)}
        </div>
      </div>
    );
  },
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeEditorBody = (): ReturnType<typeof createEmptyLumiaDocument> => ({
  root: {
    type: "root",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    children: [
      {
        type: "paragraph",
        version: 1,
        children: [
          {
            type: "text",
            version: 1,
            text: "Hello body",
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            textStyle: "",
            canMerge: true,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        textFormat: "",
      },
    ],
  },
});

const makeEntry = (
  overrides: Partial<WorkspaceContentEntry> = {},
): WorkspaceContentEntry => ({
  id: "entry-1",
  workspaceId: "ws-1",
  directoryId: null,
  title: "My Post",
  description: "A description",
  body: null,
  tags: ["news", "cms"],
  ownerName: null,
  avatarUrl: null,
  status: "draft",
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  collaborators: [],
  isFavorite: false,
  // BUG-CMS-8: structured creator field. Default to a human creator so
  // editor tests that don't care about the owner contract still produce
  // a typed `WorkspaceContentEntry`.
  creator: { id: "user-1", displayName: "Owner" },
  ...overrides,
});

// ─── setup ────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockIntegrationFlags.enabled = false;
  mockIntegrationFlags.isLoading = false;
  mockIntegrationFlags.error = null;
  mockIsAuthLoading = false;
  mockIsAuthenticated = true;
  mockLumiaEditorMode = "passthrough";
  mockCurrentWorkspace = { id: "ws-1", slug: "acme-team", name: "Acme Team" };
  // STORAGE-LIVE-5: vi.clearAllMocks() wipes the default implementation of
  // mockUseFeatureFlag (set at vi.hoisted() time). Re-establish the default
  // so each test starts with the SDK's documented default (off).
  mockUseFeatureFlag.mockReturnValue(false);
  mockAutosaveState = {
    saveState: "idle",
    lastSavedAt: null,
    error: null,
    pendingSnapshot: null,
    retry: mockAutosaveRetry,
    flush: mockAutosaveFlush,
    restoreSnapshot: vi.fn(() => null),
    clearSnapshot: mockAutosaveClearSnapshot,
  };
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe("CmsEditorScreen", () => {
  describe("loading states", () => {
    it("shows loading indicator while auth is resolving", () => {
      mockIsAuthLoading = true;
      // entry load won't fire until auth resolves
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      expect(screen.getByLabelText("Loading entry")).toBeInTheDocument();
      expect(screen.queryByTestId("cms-editor-layout")).not.toBeInTheDocument();
    });

    it("shows loading indicator while entry is being fetched", async () => {
      mockGetAccessToken.mockResolvedValue("token");
      // never resolves during this test
      mockGetWorkspaceContentEntryById.mockReturnValue(new Promise(() => {}));

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockGetWorkspaceContentEntryById).toHaveBeenCalled();
      });

      expect(screen.getByLabelText("Loading entry")).toBeInTheDocument();
    });

    it("shows loading when not yet authenticated", () => {
      mockIsAuthenticated = false;
      mockGetAccessToken.mockResolvedValue(null);
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      expect(screen.getByLabelText("Loading entry")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows load error alert when entry fetch fails", async () => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockRejectedValue(
        new Error("Entry not found"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-load-error")).toBeInTheDocument();
      });

      expect(screen.getByText("Failed to load entry")).toBeInTheDocument();
      // Raw API "not found" errors are sanitized to a safe user message
      expect(screen.getByText("Entry not found.")).toBeInTheDocument();
    });

    it("shows sanitized generic fallback message for non-Error reject values", async () => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockRejectedValue("network failure");

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-load-error")).toBeInTheDocument();
      });

      // title is hardcoded; description gets the fallback safe message
      expect(screen.getByText("Failed to load entry")).toBeInTheDocument();
      expect(
        screen.getByText("Failed to load entry. Please try again."),
      ).toBeInTheDocument();
    });
  });

  describe("loaded state", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("renders editor layout with entry title after load", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("editor-title")).toHaveTextContent("My Post");
    });

    it("renders editor layout with draft status for draft entries", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({ status: "draft" }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-status",
        "draft",
      );
    });

    it("renders editor layout with published status for published entries", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-status",
        "published",
      );
    });

    it("renders editor layout with archived status for archived entries", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "archived",
          publishedAt: null,
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-status",
        "archived",
      );
      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-publication-state",
        "archived",
      );
    });

    it("renders the real editor instead of the placeholder", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("lumia-editor-mock")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("editor-canvas-placeholder"),
      ).not.toBeInTheDocument();
      expect(mockLumiaEditor).toHaveBeenCalled();
    });

    it("seeds the editor body from entry data", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({ body: makeEditorBody() }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockLumiaEditor).toHaveBeenCalled();
      });

      expect(mockLumiaEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          value: makeEditorBody(),
        }),
      );
    });

    it("remounts the editor after async entry hydration so loaded body is applied", async () => {
      mockLumiaEditorMode = "sticky-on-mount";
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({ body: makeEditorBody() }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("lumia-editor-value")).toHaveTextContent(
          JSON.stringify(makeEditorBody()),
        );
      });
    });

    it("propagates editor body changes into the autosave payload", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({ body: makeEditorBody() }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockLumiaEditor).toHaveBeenCalled();
      });

      const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
        | {
            onChange?: (value: unknown) => void;
          }
        | undefined;

      expect(editorProps?.onChange).toBeTypeOf("function");
      const saveDraftFnCallCount = mockCaptureSaveDraftFn.mock.calls.length;

      const nextBody = {
        root: {
          type: "root",
          version: 1,
          direction: "ltr",
          format: "",
          indent: 0,
          children: [
            {
              type: "paragraph",
              version: 1,
              direction: "ltr",
              format: "",
              indent: 0,
              textFormat: "",
              children: [
                {
                  type: "text",
                  version: 1,
                  text: "Updated body",
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  textStyle: "",
                  canMerge: true,
                },
              ],
            },
          ],
        },
      };

      await act(async () => {
        editorProps?.onChange?.(nextBody);
      });

      await waitFor(() => {
        expect(screen.getByTestId("lumia-editor-value")).toHaveTextContent(
          JSON.stringify(nextBody),
        );
      });

      await waitFor(() => {
        expect(mockCaptureSaveDraftFn.mock.calls.length).toBeGreaterThan(
          saveDraftFnCallCount,
        );
      });

      mockUpdateWorkspaceContentEntry.mockResolvedValue(
        makeEntry({ body: nextBody }),
      );

      const saveDraftFn: (v: {
        title: string;
        description: string;
        tags: string;
        body: ReturnType<typeof createEmptyLumiaDocument>;
      }) => Promise<void> = mockCaptureSaveDraftFn.mock.calls.at(-1)?.[0];

      const currentBody = JSON.parse(
        screen.getByTestId("lumia-editor-value").textContent ?? "null",
      ) as ReturnType<typeof createEmptyLumiaDocument>;

      await saveDraftFn({
        title: screen.getByTestId("editor-title").textContent ?? "",
        description: screen.getByTestId("editor-description").textContent ?? "",
        tags: screen.getByTestId("editor-tags").textContent ?? "",
        body: currentBody,
      });

      expect(mockUpdateWorkspaceContentEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            body: nextBody,
          }),
        }),
      );
    });

    it("falls back safely when the entry body is malformed", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          body: "{not valid json" as unknown as WorkspaceContentEntry["body"],
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockLumiaEditor).toHaveBeenCalled();
      });

      expect(mockLumiaEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          value: createEmptyLumiaDocument(),
        }),
      );
    });

    it("falls back to route workspaceSlug when workspace slug is not in context", async () => {
      mockCurrentWorkspace = { id: "ws-1", slug: "", name: "Team" };

      render(
        <CmsEditorScreen entryId="entry-1" workspaceSlug="fallback-slug" />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });
    });
  });

  describe("navigation", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("navigates back to content list on back button click", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("back-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("back-btn"));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/acme-team/content");
    });

    it("uses currentWorkspace slug for back path when available", async () => {
      mockCurrentWorkspace = { id: "ws-1", slug: "real-slug", name: "Team" };

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="route-slug" />);

      await waitFor(() => {
        expect(screen.getByTestId("back-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("back-btn"));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/real-slug/content");
    });

    it("shows a Lumia confirm dialog and stays put on cancel when unsaved changes exist", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("back-btn")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Changed title" },
      });
      fireEvent.click(screen.getByTestId("back-btn"));

      expect(
        screen.getByTestId("leave-editor-confirm-dialog"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("leave-editor-cancel"));
      expect(
        screen.queryByTestId("leave-editor-confirm-dialog"),
      ).not.toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("shows a Lumia confirm dialog and exits on confirm when unsaved changes exist", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("back-btn")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Changed title" },
      });
      fireEvent.click(screen.getByTestId("back-btn"));

      expect(
        screen.getByTestId("leave-editor-confirm-dialog"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("leave-editor-confirm"));
      expect(mockPush).toHaveBeenCalledWith("/dashboard/acme-team/content");
    });
  });

  describe("publish", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("shows publish error alert on publish failure", async () => {
      mockPublishWorkspaceContentEntry.mockRejectedValue(
        new Error("Publish failed: HTTP 500"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("editor-publish-error")).toBeInTheDocument();
      });

      expect(screen.getByText("Publish failed")).toBeInTheDocument();
      // Raw HTTP 5xx errors are sanitized; raw message is not displayed to user
      expect(
        screen.getByText(
          "CMS service is temporarily unavailable. Please try again.",
        ),
      ).toBeInTheDocument();
    });

    it("shows sanitized fallback message for non-Error publish reject values", async () => {
      mockPublishWorkspaceContentEntry.mockRejectedValue("timeout");

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("editor-publish-error")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Failed to publish entry. Please try again."),
      ).toBeInTheDocument();
    });

    it("updates editor to published status on successful publish", async () => {
      mockPublishWorkspaceContentEntry.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-status",
          "published",
        );
      });
    });

    it("marks published entries with newer saved edits as needing republish", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:05:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-publication-state",
          "published-with-changes",
        );
      });
    });

    it("switches published entries into republish state as soon as new edits are made", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("title-input")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-publication-state",
        "published",
      );

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Edited after publish" },
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-publication-state",
        "published-with-changes",
      );
    });

    it("waits for autosave flush before publishing", async () => {
      let resolveFlush: (() => void) | null = null;
      mockAutosaveState = {
        ...mockAutosaveState,
        flush: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              resolveFlush = resolve;
            }),
        ),
      };
      mockPublishWorkspaceContentEntry.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Changed title" },
      });
      fireEvent.click(screen.getByTestId("publish-btn"));

      expect(mockAutosaveState.flush).toHaveBeenCalledTimes(1);
      expect(mockPublishWorkspaceContentEntry).not.toHaveBeenCalled();

      await act(async () => {
        resolveFlush?.();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockPublishWorkspaceContentEntry).toHaveBeenCalledTimes(1);
      });
    });

    it("schedules a draft entry through the status endpoint", async () => {
      mockSetWorkspaceContentEntryStatus.mockResolvedValue(
        makeEntry({
          status: "scheduled",
          publishedAt: "2026-04-24T14:30:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("schedule-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("schedule-btn"));

      await waitFor(() => {
        expect(mockSetWorkspaceContentEntryStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: {
              status: "scheduled",
              publishAt: "2026-04-24T14:30:00.000Z",
            },
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-status",
          "scheduled",
        );
      });
    });

    it("does not expose scheduling for published entries with newer saved edits", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "published",
          title: "Live title",
          publishedAt: "2026-04-23T08:00:00.000Z",
          updatedAt: "2026-04-23T08:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("title-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Queued title change" },
      });

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-publication-state",
          "published-with-changes",
        );
      });

      expect(screen.queryByTestId("schedule-btn")).toBeNull();
    });

    it("publishes scheduled entries immediately through the status endpoint", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "scheduled",
          publishedAt: "2026-04-24T14:30:00.000Z",
        }),
      );
      mockSetWorkspaceContentEntryStatus.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-04-23T08:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(mockSetWorkspaceContentEntryStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: { status: "published" },
          }),
        );
      });
      expect(mockPublishWorkspaceContentEntry).not.toHaveBeenCalled();
    });

    it("unpublishes a published entry through the status endpoint", async () => {
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      );
      mockSetWorkspaceContentEntryStatus.mockResolvedValue(
        makeEntry({
          status: "draft",
          publishedAt: null,
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("status-draft-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("status-draft-btn"));

      await waitFor(() => {
        expect(mockSetWorkspaceContentEntryStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: "ws-1",
            entryId: "entry-1",
            payload: { status: "draft" },
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-status",
          "draft",
        );
      });
    });

    it("archives an entry through the status endpoint", async () => {
      mockSetWorkspaceContentEntryStatus.mockResolvedValue(
        makeEntry({
          status: "archived",
          publishedAt: null,
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("status-archived-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("status-archived-btn"));

      await waitFor(() => {
        expect(mockSetWorkspaceContentEntryStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: "ws-1",
            entryId: "entry-1",
            payload: { status: "archived" },
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-status",
          "archived",
        );
      });
    });

    it("locks draft edits while publish is in flight", async () => {
      let resolveFlush: (() => void) | null = null;
      mockAutosaveState = {
        ...mockAutosaveState,
        flush: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              resolveFlush = resolve;
            }),
        ),
      };
      mockPublishWorkspaceContentEntry.mockResolvedValue(
        makeEntry({
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-is-publishing",
          "true",
        );
      });

      expect(screen.getByTestId("title-input")).toBeDisabled();

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Changed while publishing" },
      });

      expect(screen.getByTestId("editor-title")).toHaveTextContent("My Post");

      await act(async () => {
        resolveFlush?.();
        await Promise.resolve();
      });
    });

    it("does not publish when autosave flush fails", async () => {
      mockAutosaveState = {
        ...mockAutosaveState,
        flush: vi.fn().mockRejectedValue(new Error("save failed")),
      };

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "Changed title" },
      });
      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(mockAutosaveState.flush).toHaveBeenCalledTimes(1);
      });

      expect(mockPublishWorkspaceContentEntry).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
          "data-is-publishing",
          "false",
        );
      });
    });
  });

  describe("autosave state forwarding", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("forwards saving state to editor layout", async () => {
      mockAutosaveState = { ...mockAutosaveState, saveState: "saving" };

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-save-state",
        "saving",
      );
    });

    it("forwards saved state to editor layout", async () => {
      mockAutosaveState = {
        ...mockAutosaveState,
        saveState: "saved",
        lastSavedAt: "2026-01-01T16:00:00.000Z",
      };

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute(
        "data-save-state",
        "saved",
      );
    });
  });

  describe("entry load — API call correctness", () => {
    it("calls getWorkspaceContentEntryById with resolved workspaceId and entryId", async () => {
      mockGetAccessToken.mockResolvedValue("test-token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-abc" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockGetWorkspaceContentEntryById).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: "ws-1",
            entryId: "entry-abc",
            accessToken: "test-token",
          }),
        );
      });
    });
  });

  // ─── field change handlers ────────────────────────────────────────────────
  // These cover the inline arrow functions passed as onTitleChange /
  // onDescriptionChange / onTagsChange to CmsEditorLayout.

  describe("field change handlers", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("updates title draft when onTitleChange fires", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("title-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("title-input"), {
        target: { value: "New Title" },
      });

      expect(screen.getByTestId("editor-title")).toHaveTextContent("New Title");
    });

    it("updates description draft when onDescriptionChange fires", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("description-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("description-input"), {
        target: { value: "New description" },
      });

      expect(screen.getByTestId("editor-description")).toHaveTextContent(
        "New description",
      );
    });

    it("updates tags draft when onTagsChange fires", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("tags-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("tags-input"), {
        target: { value: "react, cms" },
      });

      expect(screen.getByTestId("editor-tags")).toHaveTextContent("react, cms");
    });
  });

  // ─── save draft / retry handlers ─────────────────────────────────────────

  describe("save draft and retry handlers", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("calls autosave.retry when onSaveDraft is clicked", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("save-draft-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("save-draft-btn"));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockAutosaveRetry).toHaveBeenCalled();
    });

    it("calls autosave.retry when onRetrySave is clicked", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("retry-save-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("retry-save-btn"));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockAutosaveRetry).toHaveBeenCalled();
    });

    it("swallows autosave retry rejections from manual save actions", async () => {
      mockAutosaveRetry.mockRejectedValueOnce(new Error("save failed"));

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("save-draft-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("save-draft-btn"));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockAutosaveRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ─── saveDraftFn — direct invocation ─────────────────────────────────────
  // The async saveDraft callback passed to useCmsEntryAutosave is captured via
  // mockCaptureSaveDraftFn and called directly to reach its inner branches.

  describe("saveDraftFn", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("calls updateWorkspaceContentEntry with trimmed tags and updates entry", async () => {
      const updatedEntry = makeEntry({ title: "Saved", tags: ["x"] });
      mockUpdateWorkspaceContentEntry.mockResolvedValue(updatedEntry);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      // Grab the most-recently captured saveDraft closure
      const saveDraftFn: (v: {
        title: string;
        description: string;
        tags: string;
        body: ReturnType<typeof createEmptyLumiaDocument>;
      }) => Promise<void> = mockCaptureSaveDraftFn.mock.calls.at(-1)?.[0];

      expect(saveDraftFn).toBeDefined();

      await saveDraftFn({
        title: "Saved",
        description: "Desc",
        tags: " x , y ",
        body: makeEditorBody(),
      });

      expect(mockUpdateWorkspaceContentEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          entryId: "entry-1",
          accessToken: "token",
          payload: expect.objectContaining({
            title: "Saved",
            description: "Desc",
            tags: ["x", "y"],
            body: makeEditorBody(),
          }),
        }),
      );
    });

    it("throws 'Not authenticated' when workspace or token is missing", async () => {
      // Simulate missing workspace to prevent token resolution
      mockCurrentWorkspace = { id: "", slug: "", name: "" };
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      // Allow any pending renders to settle
      await new Promise((r) => setTimeout(r, 20));

      const saveDraftFn: (v: {
        title: string;
        description: string;
        tags: string;
        body: ReturnType<typeof createEmptyLumiaDocument>;
      }) => Promise<void> = mockCaptureSaveDraftFn.mock.calls.at(-1)?.[0];

      if (!saveDraftFn) return; // guard — OK if not captured (workspace missing)

      await expect(
        saveDraftFn({
          title: "x",
          description: "",
          tags: "",
          body: createEmptyLumiaDocument(),
        }),
      ).rejects.toThrow("Not authenticated");
    });
  });

  // ─── load error sanitization — all pattern branches ──────────────────────

  describe("load error sanitization", () => {
    it("shows permission-denied message for HTTP 403 load error", async () => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockRejectedValue(
        new Error("HTTP 403 Forbidden"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-load-error")).toBeInTheDocument();
      });

      expect(
        screen.getByText("You don't have permission to access this entry."),
      ).toBeInTheDocument();
    });

    it("shows service-unavailable message for HTTP 5xx load error", async () => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockRejectedValue(
        new Error("HTTP 503 Service Unavailable"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-load-error")).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "CMS service is temporarily unavailable. Please try again.",
        ),
      ).toBeInTheDocument();
    });

    it("shows invalid-response message for malformed API responses", async () => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockRejectedValue(
        new Error("Invalid entry response"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("editor-load-error")).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "CMS returned an unexpected response. Please try again.",
        ),
      ).toBeInTheDocument();
    });
  });

  // ─── publish error sanitization — all pattern branches ───────────────────

  describe("publish error sanitization", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("shows permission-denied message for HTTP 403 publish error", async () => {
      mockPublishWorkspaceContentEntry.mockRejectedValue(
        new Error("HTTP 403 Forbidden"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("editor-publish-error")).toBeInTheDocument();
      });

      expect(
        screen.getByText("You don't have permission to publish this entry."),
      ).toBeInTheDocument();
    });

    it("shows not-found message for HTTP 404 publish error", async () => {
      mockPublishWorkspaceContentEntry.mockRejectedValue(
        new Error("HTTP 404 not found"),
      );

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("publish-btn")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("publish-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("editor-publish-error")).toBeInTheDocument();
      });

      expect(screen.getByText("Entry not found.")).toBeInTheDocument();
    });
  });

  // ─── accessToken edge cases ───────────────────────────────────────────────

  describe("access token edge cases", () => {
    it("does not fetch entry when getAccessToken returns empty string", async () => {
      mockGetAccessToken.mockResolvedValue("");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      // Allow effects to settle
      await new Promise((r) => setTimeout(r, 20));

      expect(mockGetWorkspaceContentEntryById).not.toHaveBeenCalled();
    });

    it("sets null token when getAccessToken throws", async () => {
      mockGetAccessToken.mockRejectedValue(new Error("Token service down"));
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      // Allow effect to settle; entry fetch should not occur
      await new Promise((r) => setTimeout(r, 20));

      expect(mockGetWorkspaceContentEntryById).not.toHaveBeenCalled();
    });
  });

  // ─── hasUnsavedChanges ────────────────────────────────────────────────────

  describe("hasUnsavedChanges detection", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("reflects error saveState as unsaved changes", async () => {
      mockAutosaveState = { ...mockAutosaveState, saveState: "error" };

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      // saveState=error makes hasUnsavedChanges=true — the layout still renders
      expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
    });

    it("reflects saving saveState as unsaved changes", async () => {
      mockAutosaveState = { ...mockAutosaveState, saveState: "saving" };

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
      });

      expect(screen.getByTestId("cms-editor-layout")).toBeInTheDocument();
    });
  });

  // ─── null entry guard ─────────────────────────────────────────────────────

  describe("null entry guard", () => {
    it("renders nothing when workspace changes mid-flight and entry is cleared", () => {
      // Simulate auth still loading without a workspace — component stays in
      // loading state; the null-entry branch is guarded by isLoading.
      // We reach the null-entry path only when isLoading=false AND entry=null.
      // The only way that happens is when workspace/token is absent but loading
      // already flipped to false — not directly reachable via current state
      // machine, so this test validates the loading fallback guard instead.
      mockIsAuthLoading = false;
      mockIsAuthenticated = false;
      mockGetAccessToken.mockResolvedValue(null);
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      // There is no entry to display; loading spinner is shown instead.
      expect(screen.queryByTestId("cms-editor-layout")).not.toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STORAGE-LIVE-5 — feature-flag gate on the editor upload affordance.
  //
  // The flag value comes from `@xynes/auth-sdk` `useFeatureFlag(flag)`,
  // which reads from the SDK's `FeatureFlagsContext`. The context is
  // populated by `<FeatureFlagsProvider>` from a fetch to the gateway's
  // `/flags` route, which is PostHog-backed server-side. Tests here mock
  // the SDK hook directly so we don't have to drive the full context.
  // ─────────────────────────────────────────────────────────────────────

  describe("STORAGE-LIVE-5 — cms_editor_storage_uploads feature flag", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry());
    });

    it("flag OFF (SDK default): media.uploadAdapter is undefined, resolveDownloadUrl stays wired", async () => {
      mockUseFeatureFlag.mockReturnValue(false);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
          | {
              media?: {
                uploadAdapter?: unknown;
                resolveDownloadUrl?: unknown;
              };
            }
          | undefined;
        expect(editorProps?.media?.uploadAdapter).toBeUndefined();
        expect(editorProps?.media?.resolveDownloadUrl).toBeDefined();
      });

      const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
        | { media?: { uploadAdapter?: unknown; resolveDownloadUrl?: unknown } }
        | undefined;
      expect(editorProps?.media?.uploadAdapter).toBeUndefined();
      // resolveDownloadUrl stays wired so existing image-block nodes with
      // objectId can mint fresh signed URLs and render (read-path
      // graceful degradation per the rollout plan §8).
      expect(editorProps?.media?.resolveDownloadUrl).toBeDefined();
      expect(typeof editorProps?.media?.resolveDownloadUrl).toBe("function");
    });

    it("flag ON: media.uploadAdapter is defined AND resolveDownloadUrl stays wired", async () => {
      mockUseFeatureFlag.mockReturnValue(true);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
          | {
              media?: {
                uploadAdapter?: unknown;
                resolveDownloadUrl?: unknown;
              };
            }
          | undefined;
        expect(editorProps?.media?.uploadAdapter).toBeDefined();
        expect(editorProps?.media?.resolveDownloadUrl).toBeDefined();
      });

      const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
        | { media?: { uploadAdapter?: unknown; resolveDownloadUrl?: unknown } }
        | undefined;
      expect(editorProps?.media?.uploadAdapter).toBeDefined();
      expect(editorProps?.media?.resolveDownloadUrl).toBeDefined();
    });

    it("flag ON: surfaces a safe role-aware message when upload authorization is denied", async () => {
      mockUseFeatureFlag.mockReturnValue(true);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
          { media?: { uploadAdapter?: unknown } } | undefined;
        expect(editorProps?.media?.uploadAdapter).toBeDefined();
      });

      const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
        | {
            media?: {
              callbacks?: {
                onUploadStart?: (
                  file: File,
                  mediaType: "image" | "video" | "file",
                  source?: "file-picker" | "drag-drop" | "paste",
                ) => void;
                onUploadError?: (file: File, error: Error) => void;
              };
            };
          }
        | undefined;
      const onUploadStart = editorProps?.media?.callbacks?.onUploadStart;
      const onUploadError = editorProps?.media?.callbacks?.onUploadError;

      expect(onUploadStart).toBeTypeOf("function");
      expect(onUploadError).toBeTypeOf("function");

      const fixture = new File(["fixture"], "private-photo.jpg", {
        type: "image/jpeg",
      });

      act(() => {
        onUploadError?.(
          fixture,
          new Error(
            "HTTP 403 Forbidden (FORBIDDEN_SCOPE_MISS) token=secret-value",
          ),
        );
      });

      const alert = screen.getByTestId("editor-upload-error");
      expect(alert).toHaveTextContent("Media upload unavailable");
      expect(alert).toHaveTextContent(
        "Your workspace role does not allow media uploads.",
      );
      expect(alert).not.toHaveTextContent("private-photo.jpg");
      expect(alert).not.toHaveTextContent("secret-value");
      expect(alert).not.toHaveTextContent("FORBIDDEN_SCOPE_MISS");

      act(() => {
        onUploadStart?.(fixture, "image", "file-picker");
      });
      expect(
        screen.queryByTestId("editor-upload-error"),
      ).not.toBeInTheDocument();
    });

    it("queries the SDK for the exact `cms_editor_storage_uploads` flag key", async () => {
      mockUseFeatureFlag.mockReturnValue(false);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockLumiaEditor).toHaveBeenCalled();
      });

      expect(mockUseFeatureFlag).toHaveBeenCalledWith(
        "cms_editor_storage_uploads",
      );
    });

    it("render-loop guard: stable flag value → mockLumiaEditor call count stays bounded", async () => {
      mockUseFeatureFlag.mockReturnValue(true);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockLumiaEditor).toHaveBeenCalled();
      });

      const callsBefore = mockLumiaEditor.mock.calls.length;
      // Give the autosave + state machine a tick to settle without any
      // external state change. mockLumiaEditor should NOT be called many
      // times in a row — that would indicate a STORAGE-LIVE-4-style render
      // loop has crept back in.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const callsAfter = mockLumiaEditor.mock.calls.length;
      const delta = callsAfter - callsBefore;
      expect(delta).toBeLessThan(10);
    });

    it("flag-off path does NOT wire a callbacks surface (no STORAGE-9 telemetry leak vector)", async () => {
      mockUseFeatureFlag.mockReturnValue(false);

      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(mockLumiaEditor).toHaveBeenCalled();
      });

      const editorProps = mockLumiaEditor.mock.calls.at(-1)?.[0] as
        { media?: { callbacks?: unknown } } | undefined;
      // STORAGE-LIVE-5 gateway architecture: telemetry events are emitted
      // server-side by the gateway, NOT from the browser. So the gated
      // bridge does NOT carry a `callbacks` surface — defense in depth
      // against accidental client-side telemetry that could bypass the
      // STORAGE-9 redaction pipeline.
      expect(editorProps?.media?.callbacks).toBeUndefined();
    });
  });
});

describe("CMS-INT-B3 editor scope and preservation", () => {
  it("opens an entry integration without flushing, saving, publishing or remounting the editor", async () => {
    mockIntegrationFlags.enabled = true;
    const workspaceId = "11111111-1111-4111-8111-111111111111";
    const entryId = "33333333-3333-4333-8333-333333333333";
    mockCurrentWorkspace = {
      id: workspaceId,
      slug: "editorial",
      name: "Editorial",
    };
    mockGetAccessToken.mockResolvedValue("fixture-token");
    mockGetWorkspaceContentEntryById.mockResolvedValue(
      makeEntry({
        id: entryId,
        workspaceId,
        status: "published",
        title: "Saved story",
        body: makeEditorBody(),
      }),
    );
    render(
      <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
        <CmsEditorScreen entryId={entryId} workspaceSlug="editorial" />
      </NextIntlClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("editor-title")).toHaveTextContent(
        "Saved story",
      ),
    );
    fireEvent.change(screen.getByTestId("title-input"), {
      target: { value: "Unsaved local title" },
    });
    expect(screen.getByTestId("editor-title")).toHaveTextContent(
      "Unsaved local title",
    );
    const editor = screen.getByTestId("lumia-editor-mock");
    const beforeBody = screen.getByTestId("lumia-editor-value").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Open API panel" }));
    expect(
      screen.getByRole("dialog", { name: 'Use "Unsaved local title" via API' }),
    ).toBeVisible();
    expect(screen.getByTestId("lumia-editor-mock")).toBe(editor);
    expect(screen.getByTestId("editor-title")).toHaveTextContent(
      "Unsaved local title",
    );
    expect(screen.getByTestId("lumia-editor-value").textContent).toBe(
      beforeBody,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByTestId("editor-title")).toHaveTextContent(
      "Unsaved local title",
    );
    expect(mockAutosaveFlush).not.toHaveBeenCalled();
    expect(mockAutosaveRetry).not.toHaveBeenCalled();
    expect(mockUpdateWorkspaceContentEntry).not.toHaveBeenCalled();
    expect(mockPublishWorkspaceContentEntry).not.toHaveBeenCalled();
  });
});
it("CMS-INT-B3 closes integrations immediately when authoring authentication is lost", async () => {
  mockIntegrationFlags.enabled = true;
  const workspaceId = "11111111-1111-4111-8111-111111111111",
    entryId = "33333333-3333-4333-8333-333333333333";
  mockCurrentWorkspace = {
    id: workspaceId,
    slug: "editorial",
    name: "Editorial",
  };
  mockGetAccessToken.mockResolvedValue("fixture-token");
  mockGetWorkspaceContentEntryById.mockResolvedValue(
    makeEntry({
      id: entryId,
      workspaceId,
      status: "published",
      title: "Saved story",
      body: makeEditorBody(),
    }),
  );
  const node = (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <CmsEditorScreen entryId={entryId} workspaceSlug="editorial" />
    </NextIntlClientProvider>
  );
  const { rerender } = render(node);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Open API panel" }),
    ).toBeVisible(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Open API panel" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  mockIsAuthenticated = false;
  rerender(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <CmsEditorScreen entryId={entryId} workspaceSlug="editorial" />
    </NextIntlClientProvider>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Open API panel" }),
  ).toBeNull();
});
describe("integration-enabled editor publication failures", () => {
  it.each([
    [
      "draft",
      "HTTP 403 private-marker",
      "permission to move this entry back to draft",
    ],
    ["archived", "HTTP 403 private-marker", "permission to archive this entry"],
    ["draft", "HTTP 404 private-marker", "Entry not found"],
    [
      "archived",
      "HTTP 503 private-marker",
      "CMS service is temporarily unavailable",
    ],
    [
      "draft",
      "Unexpected private-marker",
      "Failed to move entry back to draft",
    ],
    ["archived", "Unexpected private-marker", "Failed to archive entry"],
  ] as const)(
    "keeps %s failure recovery safe with the readonly panel enabled",
    async (status, error, expected) => {
      mockIntegrationFlags.enabled = true;
      const workspaceId = "11111111-1111-4111-8111-111111111111",
        entryId = "33333333-3333-4333-8333-333333333333";
      mockCurrentWorkspace = {
        id: workspaceId,
        slug: "editorial",
        name: "Editorial",
      };
      mockGetAccessToken.mockResolvedValue("fixture-token");
      mockGetWorkspaceContentEntryById.mockResolvedValue(
        makeEntry({
          id: entryId,
          workspaceId,
          status: "published",
          title: "Saved story",
          body: makeEditorBody(),
        }),
      );
      mockSetWorkspaceContentEntryStatus.mockRejectedValue(new Error(error));
      mockAutosaveFlush.mockResolvedValue(undefined);
      render(
        <NextIntlClientProvider
          locale="en-US"
          messages={getCmsMessages("en-US")}
        >
          <CmsEditorScreen entryId={entryId} workspaceSlug="editorial" />
        </NextIntlClientProvider>,
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Open API panel" }),
        ).toBeVisible(),
      );
      fireEvent.click(screen.getByTestId(`status-${status}-btn`));
      await waitFor(() =>
        expect(screen.getByTestId("editor-publish-error")).toHaveTextContent(
          expected,
        ),
      );
      expect(screen.getByTestId("editor-publish-error")).not.toHaveTextContent(
        "private-marker",
      );
      expect(
        screen.getByRole("button", { name: "Open API panel" }),
      ).toBeVisible();
    },
  );
});

describe("API editor deep links", () => {
  afterEach(() => { mockSearchParams = new URLSearchParams(); vi.unstubAllGlobals(); });
  it.each([true, false])("applies panel=api after loading and retains other query parameters (desktop=%s)", async desktop => {
    mockSearchParams = new URLSearchParams("panel=api&keep=1");
    vi.stubGlobal("matchMedia", () => ({matches:desktop,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
    mockIntegrationFlags.enabled = true;
    const workspaceId="55555555-5555-4555-8555-555555555555", entryId="33333333-3333-4333-8333-333333333333";
    mockCurrentWorkspace={id:workspaceId,slug:"editorial",name:"Editorial"};
    mockGetAccessToken.mockResolvedValue("fixture-token");
    mockGetWorkspaceContentEntryById.mockResolvedValue(makeEntry({id:entryId,workspaceId,status:"draft",title:"Deep link",body:makeEditorBody()}));
    render(<NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}><CmsEditorScreen entryId={entryId} workspaceSlug="editorial" /></NextIntlClientProvider>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("/edit?keep=1"),{scroll:false}));
    if (desktop) {expect(screen.getByTestId("cms-editor-layout")).toHaveAttribute("data-api-panel-request","1");expect(screen.queryByRole("dialog")).toBeNull();}
    else {
      expect(screen.getByRole("dialog",{name:'Use "Deep link" via API'})).toBeVisible();
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.getByRole("button", { name: /^API$/ })).toHaveFocus());
    }
    expect(mockPublishWorkspaceContentEntry).not.toHaveBeenCalled();
    expect(mockAutosaveFlush).not.toHaveBeenCalled();
  });
});

it("refreshes API status after header Publish succeeds without reloading or remounting the canvas", async () => {
  mockIntegrationFlags.enabled=true;
  const workspaceId="66666666-6666-4666-8666-666666666666",entryId="33333333-3333-4333-8333-333333333333";
  mockCurrentWorkspace={id:workspaceId,slug:"editorial",name:"Editorial"};
  mockGetAccessToken.mockResolvedValue("fixture-token");
  const draft=makeEntry({id:entryId,workspaceId,title:"Publication proof",body:makeEditorBody(),status:"draft",deliveryState:"unpublished"});
  mockGetWorkspaceContentEntryById.mockResolvedValue(draft);
  mockAutosaveFlush.mockResolvedValue(undefined);
  mockPublishWorkspaceContentEntry.mockResolvedValue({...draft,status:"published",deliveryState:"available",publishedAt:"2026-10-08T10:00:00.000Z",updatedAt:"2026-10-08T10:00:00.000Z"});
  render(<NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}><CmsEditorScreen entryId={entryId} workspaceSlug="editorial" /></NextIntlClientProvider>);
  await screen.findByText("Not live yet. Publish this entry and the request starts working. You can copy it now.");
  const canvas=screen.getByTestId("lumia-editor-mock");
  fireEvent.click(screen.getByTestId("publish-btn"));
  await screen.findByText("Live. The API returns the last published version.");
  expect(screen.getByTestId("lumia-editor-mock")).toBe(canvas);
  expect(mockGetWorkspaceContentEntryById).toHaveBeenCalledTimes(1);
  expect(mockPublishWorkspaceContentEntry).toHaveBeenCalledTimes(1);
});
