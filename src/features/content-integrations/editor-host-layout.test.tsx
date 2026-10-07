import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsEditorLayout } from "../../components/dashboard/CmsEditorLayout";
import { getCmsMessages } from "../../i18n/config";
import { ContentIntegrationPanel } from "./ContentIntegrationPanel";
import { entryContext } from "./workbench-test-fixtures";
afterEach(cleanup);
const base = {
  pathLabel: "/editorial/content/entry",
  title: "Local draft",
  description: "Draft description",
  tags: "news",
  status: "published" as const,
  publicationState: "published-with-changes" as const,
  saveState: "saved" as const,
  onTitleChange: vi.fn(),
  onDescriptionChange: vi.fn(),
  onTagsChange: vi.fn(),
  onSaveDraft: vi.fn(),
  onPublish: vi.fn(),
};
function ui(dialogOpen = false) {
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <CmsEditorLayout
        {...base}
        integrationIdentity="entry-a"
        integrationDialogOpen={dialogOpen}
        onCustomizeIntegrations={vi.fn()}
        integrationPanel={<ContentIntegrationPanel context={entryContext} />}
      >
        <textarea aria-label="Canvas draft" defaultValue="Unsaved canvas" />
      </CmsEditorLayout>
    </NextIntlClientProvider>
  );
}
describe("editor integration presentation", () => {
  it("defaults Details, switches to compact preview and preserves canvas and metadata", () => {
    render(ui());
    const canvas = screen.getByLabelText("Canvas draft");
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(canvas, { target: { value: "Still dirty" } });
    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    expect(screen.getByLabelText("Request URL")).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Scripts" })).toBeNull();
    expect(screen.getByLabelText("Canvas draft")).toBe(canvas);
    expect(canvas).toHaveValue("Still dirty");
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByLabelText("Content title")).toHaveValue("Local draft");
    expect(base.onSaveDraft).not.toHaveBeenCalled();
    expect(base.onPublish).not.toHaveBeenCalled();
  });
  it("renders one metadata instance and removes Drawer before full dialog", () => {
    const { rerender } = render(ui());
    fireEvent.click(
      screen.getByRole("button", { name: "Open metadata panel" }),
    );
    expect(screen.getAllByRole("tab", { name: "Details" })).toHaveLength(1);
    rerender(ui(true));
    expect(document.querySelector("[data-lumia-drawer-root]")).toBeNull();
  });
});
class VisibleRects implements DOMRectList {
  readonly length = 1;
  readonly [index: number]: DOMRect;
  item(index: number): DOMRect | null {
    return index === 0 ? new DOMRect(0, 0, 100, 40) : null;
  }
  [Symbol.iterator]() {
    return [new DOMRect(0, 0, 100, 40)][Symbol.iterator]();
  }
}
it("restores Customize on desktop and resets sidebar selection when its identity changes", () => {
  const customize = vi.fn<(restore: () => void) => void>();
  const renderNode = (identity: string) => (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <CmsEditorLayout
        {...base}
        integrationIdentity={identity}
        onCustomizeIntegrations={customize}
        integrationPanel={<ContentIntegrationPanel context={entryContext} />}
      >
        <textarea aria-label="Canvas draft" defaultValue="Dirty" />
      </CmsEditorLayout>
    </NextIntlClientProvider>
  );
  const { rerender } = render(renderNode("a"));
  fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
  const button = screen.getByRole("button", { name: "Customize request" });
  vi.spyOn(button, "getClientRects").mockReturnValue(new VisibleRects());
  fireEvent.click(button);
  customize.mock.calls[0]?.[0]();
  expect(button).toHaveFocus();
  rerender(renderNode("b"));
  expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByLabelText("Canvas draft")).toHaveValue("Dirty");
});
it("restores mobile metadata or the new desktop Customize after the drawer has unmounted", () => {
  const customize = vi.fn<(restore: () => void) => void>();
  const renderNode = (open: boolean) => (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <CmsEditorLayout
        {...base}
        integrationIdentity="a"
        integrationDialogOpen={open}
        onCustomizeIntegrations={customize}
        integrationPanel={<ContentIntegrationPanel context={entryContext} />}
      >
        <p>Canvas</p>
      </CmsEditorLayout>
    </NextIntlClientProvider>
  );
  const { rerender } = render(renderNode(false));
  const metadata = screen.getByRole("button", { name: "Open metadata panel" });
  fireEvent.click(metadata);
  fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
  fireEvent.click(screen.getByRole("button", { name: "Customize request" }));
  rerender(renderNode(true));
  vi.spyOn(metadata, "getClientRects").mockReturnValue(new VisibleRects());
  customize.mock.calls[0]?.[0]();
  expect(metadata).toHaveFocus();
  vi.mocked(metadata.getClientRects).mockReturnValue({
    length: 0,
    item: () => null,
    [Symbol.iterator]: () => [].values(),
  });
  customize.mock.calls[0]?.[0]();
  expect(
    screen.getByRole("button", { name: "Customize request" }),
  ).toHaveFocus();
});
