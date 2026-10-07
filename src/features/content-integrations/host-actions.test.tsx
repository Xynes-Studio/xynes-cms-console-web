import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import {
  CmsContentToolbar,
  type CmsContentToolbarProps,
} from "../../components/dashboard/CmsContentToolbar";
import { CmsContentCardGrid } from "../../components/dashboard/CmsContentCardGrid";
import { CmsContentCardList } from "../../components/dashboard/CmsContentCardList";
import { entryContext } from "./workbench-test-fixtures";
const id =
  entryContext.target.kind === "entry" ? entryContext.target.entryId : "";
afterEach(cleanup);
const toolbar: CmsContentToolbarProps = {
  breadcrumbItems: [{ label: "News" }],
  itemCount: 1,
  query: "",
  sortBy: "date",
  view: "grid",
  followingOnly: false,
  favoritesOnly: false,
  onCreate: vi.fn(),
  onQueryChange: vi.fn(),
  onSearchSubmit: vi.fn(),
  onSortChange: vi.fn(),
  onViewChange: vi.fn(),
  onFollowingToggle: vi.fn(),
  onFavoritesToggle: vi.fn(),
};
const card = {
  entryId: id,
  title: "First story",
  status: "published" as const,
  isFavorite: false,
  onOpen: vi.fn(),
  onDelete: vi.fn(),
  onShare: vi.fn(),
  onToggleFavorite: vi.fn(),
};
function intl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      {node}
    </NextIntlClientProvider>
  );
}
describe("integration presentation hosts", () => {
  it("puts folder integration beside Create in the primary toolbar", () => {
    const action = vi.fn();
    render(
      intl(
        <CmsContentToolbar
          {...toolbar}
          onIntegrations={action}
          integrationsTargetLabel="News"
        />,
      ),
    );
    const primary = screen.getByTestId("cms-content-toolbar-primary-row");
    const button = within(primary).getByRole("button", {
      name: "Integrations for folder News",
    });
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    expect(
      within(
        screen.getByTestId("cms-content-toolbar-secondary-row"),
      ).queryByRole("button", { name: /Integrations/ }),
    ).toBeNull();
  });
  it("explains why root integration is unavailable without calling an action", () => {
    const action = vi.fn();
    render(
      intl(
        <CmsContentToolbar
          {...toolbar}
          onIntegrations={action}
          integrationsDisabled
          integrationsUnavailableReason="Open a folder first."
        />,
      ),
    );
    expect(screen.getByRole("button", { name: /Integrations/ })).toBeDisabled();
    expect(screen.getByText("Open a folder first.")).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });
  it("keeps existing toolbar unchanged without the optional callback", () => {
    render(intl(<CmsContentToolbar {...toolbar} />));
    expect(screen.queryByRole("button", { name: /Integrations/ })).toBeNull();
  });
  it("list action carries the matching ID and return-focus button without opening/navigating", () => {
    const integrate = vi.fn();
    const bubble = vi.fn();
    const open = vi.fn();
    render(
      intl(
        <div onClick={bubble}>
          <CmsContentCardList
            {...card}
            onOpen={open}
            collaborators={[]}
            onIntegrations={integrate}
          />
        </div>,
      ),
    );
    const button = screen.getByRole("button", {
      name: "Integrations for First story",
    });
    fireEvent.click(button);
    expect(integrate).toHaveBeenCalledWith(id, button);
    expect(open).not.toHaveBeenCalled();
    expect(bubble).not.toHaveBeenCalled();
  });
  it("grid action carries the matching ID and stable menu trigger", () => {
    const integrate = vi.fn();
    const open = vi.fn();
    const bubble = vi.fn();
    render(
      intl(
        <div onClick={bubble}>
          <CmsContentCardGrid
            {...card}
            onOpen={open}
            onIntegrations={integrate}
          />
        </div>,
      ),
    );
    const trigger = screen.getByRole("button", {
      name: "Actions for content First story",
    });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    bubble.mockClear();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Integrations for First story" }),
    );
    expect(integrate).toHaveBeenCalledWith(id, trigger);
    expect(open).not.toHaveBeenCalled();
    expect(bubble).not.toHaveBeenCalled();
  });
  it("keeps card actions unchanged with no integration callback", () => {
    render(intl(<CmsContentCardList {...card} collaborators={[]} />));
    expect(screen.queryByRole("button", { name: /Integrations/ })).toBeNull();
  });
});
