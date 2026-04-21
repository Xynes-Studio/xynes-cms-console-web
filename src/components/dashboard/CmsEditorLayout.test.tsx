import type React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsEditorLayout } from "./CmsEditorLayout";

vi.mock("@lumia-ui/components", () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Drawer: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
    side?: "left" | "right" | "top" | "bottom";
  }) => (open ? <div data-testid="meta-drawer">{children}</div> : null),
  Input: ({
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Textarea: ({
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("@lumia-ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}));

afterEach(() => {
  cleanup();
});

const buildProps = () => ({
  pathLabel: "workspace-id/content/level1/level2",
  generatedLink: "/content/entry-123/edit",
  title: "Entry title",
  description: "Entry description",
  tags: "alpha,beta",
  status: "draft" as const,
  saveState: "saved" as const,
  lastSavedAt: "2026-02-26T06:30:00.000Z",
  onBack: vi.fn(),
  onTitleChange: vi.fn(),
  onDescriptionChange: vi.fn(),
  onTagsChange: vi.fn(),
  onSaveDraft: vi.fn(),
  onPublish: vi.fn(),
});

describe("CmsEditorLayout", () => {
  it("renders metadata panel fields, status, and editor content", () => {
    render(
      <CmsEditorLayout {...buildProps()}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("workspace-id/content/level1/level2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/content/entry-123/edit" })).toHaveAttribute(
      "href",
      "/content/entry-123/edit",
    );
    expect(screen.getByLabelText("Content title")).toHaveValue("Entry title");
    expect(screen.getByLabelText("Content description")).toHaveValue("Entry description");
    expect(screen.getByLabelText("Content tags")).toHaveValue("alpha,beta");
    expect(screen.getByText("Draft")).toBeInTheDocument();

    const canvas = screen.getByLabelText("Content editor canvas");
    expect(within(canvas).getByText("Editor Body")).toBeInTheDocument();
  });

  it("emits metadata change callbacks", () => {
    const props = buildProps();

    render(
      <CmsEditorLayout {...props}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    fireEvent.change(screen.getByLabelText("Content title"), {
      target: { value: "New title" },
    });
    fireEvent.change(screen.getByLabelText("Content description"), {
      target: { value: "New description" },
    });
    fireEvent.change(screen.getByLabelText("Content tags"), {
      target: { value: "tag-1,tag-2" },
    });

    expect(props.onTitleChange).toHaveBeenCalledWith("New title");
    expect(props.onDescriptionChange).toHaveBeenCalledWith("New description");
    expect(props.onTagsChange).toHaveBeenCalledWith("tag-1,tag-2");
  });

  it("emits top action callbacks", () => {
    const props = buildProps();

    render(
      <CmsEditorLayout {...props}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to content list" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish content" }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSaveDraft).toHaveBeenCalledTimes(1);
    expect(props.onPublish).toHaveBeenCalledTimes(1);
  });

  it("opens metadata drawer from mobile action", () => {
    render(
      <CmsEditorLayout {...buildProps()}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.queryByTestId("meta-drawer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open metadata panel" }));
    expect(screen.getByTestId("meta-drawer")).toBeInTheDocument();
  });

  it("renders saving and error states", () => {
    const { rerender } = render(
      <CmsEditorLayout {...buildProps()} saveState="saving">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    rerender(
      <CmsEditorLayout {...buildProps()} saveState="error">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );
    expect(screen.getByText("Save failed, retrying")).toBeInTheDocument();
  });

  it("renders unsafe generated links as plain text", () => {
    render(
      <CmsEditorLayout {...buildProps()} generatedLink="javascript:alert(1)">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("Generated Link")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "javascript:alert(1)" })).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("renders protocol-relative generated links as plain text", () => {
    render(
      <CmsEditorLayout {...buildProps()} generatedLink="//evil.example/path">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.queryByRole("link", { name: "//evil.example/path" })).toBeNull();
    expect(screen.getByText("//evil.example/path")).toBeInTheDocument();
  });

  it("registers beforeunload guard when there are unsaved changes", () => {
    render(
      <CmsEditorLayout {...buildProps()} hasUnsavedChanges>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    const unloadEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);
  });

  it("shows retry action on error state and triggers callback", () => {
    const onRetrySave = vi.fn();
    render(
      <CmsEditorLayout {...buildProps()} saveState="error" onRetrySave={onRetrySave}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    expect(onRetrySave).toHaveBeenCalledTimes(1);
  });

  it("renders idle save state and does not render back button when callback is missing", () => {
    const props = buildProps();
    render(
      <CmsEditorLayout {...props} onBack={undefined} saveState="idle">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to content list" })).toBeNull();
  });

  it("renders saved fallback time when saved timestamp is invalid", () => {
    render(
      <CmsEditorLayout {...buildProps()} saveState="saved" lastSavedAt="invalid-date">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("Saved at --:--:--")).toBeInTheDocument();
  });

  it("renders external absolute generated links as plain text", () => {
    render(
      <CmsEditorLayout {...buildProps()} generatedLink="https://example.com/entry/1/edit">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(
      screen.queryByRole("link", { name: "https://example.com/entry/1/edit" }),
    ).toBeNull();
    expect(screen.getByText("https://example.com/entry/1/edit")).toBeInTheDocument();
  });

  it("renders same-origin absolute generated links as clickable", () => {
    const sameOriginLink = `${window.location.origin}/content/entry/42/edit`;
    render(
      <CmsEditorLayout {...buildProps()} generatedLink={sameOriginLink}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByRole("link", { name: sameOriginLink })).toHaveAttribute(
      "href",
      sameOriginLink,
    );
  });

  it("renders published badge when status is published", () => {
    render(
      <CmsEditorLayout {...buildProps()} status="published">
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});
