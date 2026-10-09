import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsEditorLayout } from "../../components/dashboard/CmsEditorLayout";
import { getCmsMessages } from "../../i18n/config";
import { EditorApiCard } from "./EditorApiCard";
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
        integrationPanel={<EditorApiCard context={entryContext} />}
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
    fireEvent.click(screen.getByRole("tab", { name: "API" }));
    expect(screen.getByText("6 of 6 fields")).toBeVisible();
    expect(screen.getByRole("button", {name:"Open API panel"})).toBeVisible();
    expect(document.querySelector("pre,code")).toBeNull();
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
        integrationPanel={<EditorApiCard context={entryContext} />}
      >
        <textarea aria-label="Canvas draft" defaultValue="Dirty" />
      </CmsEditorLayout>
    </NextIntlClientProvider>
  );
  const { rerender } = render(renderNode("a"));
  fireEvent.click(screen.getByRole("tab", { name: "API" }));
  const button = screen.getByRole("button", { name: "Open API panel" });
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
        integrationPanel={<EditorApiCard context={entryContext} />}
      >
        <p>Canvas</p>
      </CmsEditorLayout>
    </NextIntlClientProvider>
  );
  const { rerender } = render(renderNode(false));
  const metadata = screen.getByRole("button", { name: "API" });
  fireEvent.click(screen.getByRole("button", { name: "Open metadata panel" }));
  fireEvent.click(screen.getByRole("tab", { name: "API" }));
  fireEvent.click(screen.getByRole("button", { name: "Open API panel" }));
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
    screen.getByRole("button", { name: "Open API panel" }),
  ).toHaveFocus();
});

it("localizes the integration metadata trigger and names its drawer/close control in the pseudo locale", async () => {
  render(
    <NextIntlClientProvider locale="en-XA" messages={getCmsMessages("en-XA")}>
      <CmsEditorLayout
        {...base}
        integrationIdentity="entry-a"
        onCustomizeIntegrations={vi.fn()}
        integrationPanel={<EditorApiCard context={entryContext} />}
      >
        <textarea aria-label="Canvas draft" />
      </CmsEditorLayout>
    </NextIntlClientProvider>,
  );
  const trigger = screen.getByRole("button", {
    name: /OOppeenn mmeettaaddaattaa ppaanneell/,
  });
  fireEvent.click(trigger);
  expect(
    await screen.findByRole("dialog", { name: /CCoonntteenntt ppaanneellss/ }),
  ).toBeInTheDocument();
  const close = screen.getByRole("button", {
    name: /CClloossee mmeettaaddaattaa ppaanneell/,
  });
  fireEvent.click(close);
  expect(trigger).toHaveFocus();
});

it("opens the API sheet directly from the mobile header without a metadata drawer", () => {
  const customize = vi.fn();
  render(<NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
    <CmsEditorLayout {...base} onCustomizeIntegrations={customize} integrationPanel={<EditorApiCard context={entryContext} />}><p>Canvas</p></CmsEditorLayout>
  </NextIntlClientProvider>);
  fireEvent.click(screen.getByRole("button", {name:"API"}));
  expect(customize).toHaveBeenCalledOnce();
  expect(document.querySelector("[data-lumia-drawer-root]")).toBeNull();
});
it("applies a desktop API tab request once without remounting the canvas", () => {
  const node = (apiPanelRequest: number) => <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
    <CmsEditorLayout {...base} apiPanelRequest={apiPanelRequest} onCustomizeIntegrations={vi.fn()} integrationPanel={<EditorApiCard context={entryContext} />}><textarea aria-label="Canvas" defaultValue="Dirty" /></CmsEditorLayout>
  </NextIntlClientProvider>;
  const {rerender} = render(node(0));
  const canvas = screen.getByLabelText("Canvas");
  rerender(node(1));
  expect(screen.getByRole("tab", {name:"API"})).toHaveAttribute("aria-selected","true");
  fireEvent.click(screen.getByRole("tab", {name:"Details"}));
  rerender(node(1));
  expect(screen.getByRole("tab", {name:"Details"})).toHaveAttribute("aria-selected","true");
  expect(screen.getByLabelText("Canvas")).toBe(canvas);
});
