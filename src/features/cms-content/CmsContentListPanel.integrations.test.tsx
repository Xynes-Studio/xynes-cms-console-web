import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "@lumia-ui/components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { CmsContentListPanel } from "./CmsContentListPanel";
import type { WorkspaceContentEntry } from "../../lib/dashboard/content-entries-client";
import type { CmsContentQueryState } from "../../lib/dashboard/cms-content-query-state";
const mocks = vi.hoisted(() => ({
  pathname: "/dashboard/editorial/content/news",
  workspace: { id: "11111111-1111-4111-8111-111111111111", slug: "editorial" },
  push: vi.fn(),
  setState: vi.fn(),
  token: vi.fn(async () => "fixture-token"),
  dirs: vi.fn(),
  delete: vi.fn(),
  favorite: vi.fn(),
}));
const entry: WorkspaceContentEntry = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: mocks.workspace.id,
  directoryId: "22222222-2222-4222-8222-222222222222",
  title: "First story",
  description: "",
  body: null,
  tags: [],
  ownerName: "Author",
  avatarUrl: null,
  status: "published",
  publishedAt: "2026-10-01T00:00:00Z",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  collaborators: [],
  isFavorite: false,
  creator: undefined,
  deliveryState: "republish_required",
};
const query: CmsContentQueryState = {
  query: "",
  sortBy: "date",
  sortDirection: "desc",
  view: "list",
  followingOnly: false,
  favoritesOnly: false,
  status: "all",
  directoryId: null,
  limit: 20,
  offset: 0,
};
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@xynes/auth-sdk", () => ({
  useAuth: () => ({
    getAccessToken: mocks.token,
    isAuthenticated: true,
    isLoading: false,
  }),
  useWorkspace: () => ({ currentWorkspace: mocks.workspace }),
}));
vi.mock("../../lib/dashboard/use-cms-content-query-state", () => ({
  useCmsContentQueryState: () => ({ state: query, setState: mocks.setState }),
}));
vi.mock("../../lib/dashboard/use-cms-content-entries", () => ({
  useCmsContentEntries: () => ({
    items: [entry],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock("../../lib/dashboard/content-directories-client", () => ({
  listWorkspaceContentDirectories: mocks.dirs,
}));
vi.mock(
  "../../lib/dashboard/content-entries-client",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../lib/dashboard/content-entries-client")
    >()),
    deleteWorkspaceContentEntry: mocks.delete,
    toggleWorkspaceEntryFavorite: mocks.favorite,
  }),
);
function ui() {
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <ToastProvider>
        <CmsContentListPanel />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  mocks.token.mockResolvedValue("fixture-token");
  mocks.pathname = "/dashboard/editorial/content/news";
  mocks.workspace = { id: entry.workspaceId, slug: "editorial" };
  mocks.dirs.mockResolvedValue([
    {
      id: entry.directoryId,
      parentId: null,
      name: "News",
      pathSegment: "news",
    },
  ]);
  query.view = "list";
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("CMS-INT-B3 list orchestration", () => {
  it("opens a folder request using its persisted UUID, not URL path", async () => {
    vi.stubEnv("NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED", "1");
    render(ui());
    const button = await screen.findByRole("button", {
      name: "Integrations for folder News",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("tab", { name: "REST API" }));
    expect(screen.getByLabelText("Request URL")).toHaveProperty(
      "value",
      expect.stringContaining(`directoryId=${entry.directoryId}`),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.favorite).not.toHaveBeenCalled();
  });
  it("opens the entry with its delivery metadata and closes on route/workspace change", async () => {
    vi.stubEnv("NEXT_PUBLIC_CMS_CONTENT_INTEGRATIONS_ENABLED", "1");
    const { rerender } = render(ui());
    await screen.findByRole("button", { name: "Integrations for folder News" });
    fireEvent.click(
      screen.getByRole("button", { name: "Integrations for First story" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("legacy content");
    mocks.pathname = "/dashboard/editorial/content";
    rerender(ui());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Open a folder first.")).toBeVisible();
  });
  it("keeps every host action absent while rollout is off", async () => {
    render(ui());
    await screen.findByText("First story");
    expect(screen.queryByRole("button", { name: /Integrations/ })).toBeNull();
  });
});
