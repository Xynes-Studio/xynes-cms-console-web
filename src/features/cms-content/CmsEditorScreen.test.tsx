import type React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsEditorScreen } from "./CmsEditorScreen";
import type { WorkspaceContentEntry } from "../../lib/dashboard/content-entries-client";

// ─── hoisted mocks ───────────────────────────────────────────────────────────
// vi.fn() refs used as direct property values in vi.mock factories must be
// declared via vi.hoisted() so they are initialised before the hoisted factories run.

const {
  mockPush,
  mockGetAccessToken,
  mockGetWorkspaceContentEntryById,
  mockUpdateWorkspaceContentEntry,
  mockPublishWorkspaceContentEntry,
  mockAutosaveRetry,
  mockAutosaveClearSnapshot,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockGetWorkspaceContentEntryById: vi.fn(),
  mockUpdateWorkspaceContentEntry: vi.fn(),
  mockPublishWorkspaceContentEntry: vi.fn(),
  mockAutosaveRetry: vi.fn(),
  mockAutosaveClearSnapshot: vi.fn(),
}));

let mockIsAuthLoading = false;
let mockIsAuthenticated = true;
let mockCurrentWorkspace = {
  id: "ws-1",
  slug: "acme-team",
  name: "Acme Team",
};
let mockAutosaveState = {
  saveState: "idle" as const,
  lastSavedAt: null as string | null,
  error: null,
  pendingSnapshot: null,
  retry: mockAutosaveRetry,
  restoreSnapshot: vi.fn(() => null),
  clearSnapshot: mockAutosaveClearSnapshot,
};

// ─── module mocks ─────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsAuthLoading,
  }),
  useWorkspace: () => ({ currentWorkspace: mockCurrentWorkspace }),
}));

vi.mock("../../lib/dashboard/content-entries-client", () => ({
  getWorkspaceContentEntryById: mockGetWorkspaceContentEntryById,
  updateWorkspaceContentEntry: mockUpdateWorkspaceContentEntry,
  publishWorkspaceContentEntry: mockPublishWorkspaceContentEntry,
}));

vi.mock("../../lib/dashboard/use-cms-entry-autosave", () => ({
  useCmsEntryAutosave: () => mockAutosaveState,
}));

vi.mock("../../components/dashboard/CmsEditorLayout", () => ({
  CmsEditorLayout: ({
    children,
    title,
    status,
    saveState,
    onBack,
    onPublish,
    onSaveDraft,
  }: {
    children: React.ReactNode;
    title: string;
    status: string;
    saveState: string;
    onBack?: () => void;
    onPublish?: () => void;
    onSaveDraft?: () => void;
  }) => (
    <div
      data-testid="cms-editor-layout"
      data-status={status}
      data-save-state={saveState}
    >
      <span data-testid="editor-title">{title}</span>
      {onBack && (
        <button data-testid="back-btn" onClick={onBack}>
          Back
        </button>
      )}
      {onPublish && (
        <button data-testid="publish-btn" onClick={onPublish}>
          Publish
        </button>
      )}
      {onSaveDraft && (
        <button data-testid="save-draft-btn" onClick={onSaveDraft}>
          Save Draft
        </button>
      )}
      {children}
    </div>
  ),
}));

vi.mock("@lumia-ui/components", () => ({
  Alert: ({
    title,
    description,
    "data-testid": testId,
  }: {
    title: string;
    description: string;
    "data-testid"?: string;
  }) => (
    <div data-testid={testId ?? "alert"}>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

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
  ...overrides,
});

// ─── setup ────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthLoading = false;
  mockIsAuthenticated = true;
  mockCurrentWorkspace = { id: "ws-1", slug: "acme-team", name: "Acme Team" };
  mockAutosaveState = {
    saveState: "idle",
    lastSavedAt: null,
    error: null,
    pendingSnapshot: null,
    retry: mockAutosaveRetry,
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

    it("renders editor canvas placeholder", async () => {
      render(<CmsEditorScreen entryId="entry-1" workspaceSlug="acme-team" />);

      await waitFor(() => {
        expect(
          screen.getByTestId("editor-canvas-placeholder"),
        ).toBeInTheDocument();
      });
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
});
