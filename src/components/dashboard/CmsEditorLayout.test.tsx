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
  DatePicker: ({
    label,
    value,
    onChange,
  }: {
    label?: string;
    value?: Date;
    onChange: (value?: Date) => void;
  }) => (
    <input
      aria-label={label}
      data-testid="schedule-date-input"
      value={value ? value.toISOString().slice(0, 10) : ""}
      onChange={(event) => {
        const next = event.currentTarget.value;
        onChange(next ? new Date(`${next}T00:00:00.000`) : undefined);
      }}
    />
  ),
  Menu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MenuContent: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <div>{children}</div>,
  MenuItem: ({
    children,
    label,
    onSelect,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    label?: string;
    onSelect?: () => void;
  }) => (
    <button
      type="button"
      {...props}
      onClick={() => {
        onSelect?.();
      }}
    >
      {children ?? label}
    </button>
  ),
  MenuLabel: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <span>{children}</span>,
  MenuSeparator: () => <hr />,
  MenuTrigger: ({
    children,
  }: {
    children?: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({
    children,
  }: {
    children?: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  Textarea: ({
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  TimePicker: ({
    label,
    value,
    onChange,
  }: {
    label?: string;
    value?: string;
    onChange: (value?: string) => void;
  }) => (
    <input
      aria-label={label}
      data-testid="schedule-time-input"
      value={value ?? ""}
      onChange={(event) => onChange(event.currentTarget.value || undefined)}
    />
  ),
}));

vi.mock("@lumia-ui/icons", () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
  registerIcon: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const buildProps = () => ({
  pathLabel: "workspace-id/content/level1/level2",
  title: "Entry title",
  description: "Entry description",
  tags: "alpha,beta",
  status: "draft" as const,
  publicationState: "draft" as const,
  saveState: "saved" as const,
  lastSavedAt: "2026-02-26T06:30:00.000Z",
  lastPublishedAt: null,
  onBack: vi.fn(),
  onTitleChange: vi.fn(),
  onDescriptionChange: vi.fn(),
  onTagsChange: vi.fn(),
  onSaveDraft: vi.fn(),
  onPublish: vi.fn(),
  onChangeStatus: vi.fn(),
  onSchedule: vi.fn(),
});

describe("CmsEditorLayout", () => {
  it("renders metadata panel fields, a compact publication summary, and editor content", () => {
    render(
      <CmsEditorLayout {...buildProps()}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("workspace-id/content/level1/level2")).toBeInTheDocument();
    expect(screen.queryByText("Generated Link")).toBeNull();
    expect(screen.getByLabelText("Content title")).toHaveValue("Entry title");
    expect(screen.getByLabelText("Content description")).toHaveValue("Entry description");
    expect(screen.getByLabelText("Content tags")).toHaveValue("alpha,beta");
    expect(screen.getAllByText("Draft")).toHaveLength(1);
    expect(screen.getByText("Private draft. Not visible yet.")).toBeInTheDocument();

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

  it("schedules a draft entry from the schedule popover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T08:00:00.000Z"));
    const props = buildProps();

    render(
      <CmsEditorLayout {...props}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Schedule content" }));
    fireEvent.change(screen.getByTestId("schedule-date-input"), {
      target: { value: "2026-04-24" },
    });
    fireEvent.change(screen.getByTestId("schedule-time-input"), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm schedule" }));

    expect(props.onSchedule).toHaveBeenCalledWith(
      new Date(2026, 3, 24, 14, 30, 0, 0).toISOString(),
    );

    vi.useRealTimers();
  });

  it("blocks past schedule dates and shows an error", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T08:00:00.000Z"));
    const props = buildProps();

    render(
      <CmsEditorLayout {...props}>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Schedule content" }));
    fireEvent.change(screen.getByTestId("schedule-date-input"), {
      target: { value: "2026-04-22" },
    });
    fireEvent.change(screen.getByTestId("schedule-time-input"), {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm schedule" }));

    expect(props.onSchedule).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choose a future date and time to schedule publishing."),
    ).toBeInTheDocument();

    vi.useRealTimers();
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

  it("disables editing controls while publishing is in progress", () => {
    render(
      <CmsEditorLayout {...buildProps()} isPublishing>
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByRole("button", { name: "Back to content list" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish content" })).toBeDisabled();
    expect(screen.getByLabelText("Content title")).toBeDisabled();
    expect(screen.getByLabelText("Content description")).toBeDisabled();
    expect(screen.getByLabelText("Content tags")).toBeDisabled();
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

  it("renders live status when the latest saved version is published", () => {
    render(
      <CmsEditorLayout
        {...buildProps()}
        status="published"
        publicationState="published"
        lastPublishedAt="2026-02-26T06:30:00.000Z"
      >
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getAllByText("Live")).toHaveLength(1);
    expect(screen.getByText(/Public page is up to date\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage publication" })).toBeInTheDocument();
  });

  it("renders a republish state when saved changes are newer than the live version", () => {
    render(
      <CmsEditorLayout
        {...buildProps()}
        status="published"
        publicationState="published-with-changes"
        lastPublishedAt="2026-02-26T06:30:00.000Z"
      >
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getAllByText("Live")).toHaveLength(1);
    expect(screen.getByText(/Changes not live\./)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Schedule update content" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Manage publication" })).toHaveTextContent(
      "Republish",
    );
    expect(screen.getByRole("button", { name: "Republish now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish to draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive entry" })).toBeInTheDocument();
    expect(screen.getByText("chevron-down")).toBeInTheDocument();
  });

  it("triggers unpublish and archive status actions from the publication menu", () => {
    const props = buildProps();

    render(
      <CmsEditorLayout
        {...props}
        status="published"
        publicationState="published"
        lastPublishedAt="2026-02-26T06:30:00.000Z"
      >
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unpublish to draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive entry" }));

    expect(props.onChangeStatus).toHaveBeenNthCalledWith(1, "draft");
    expect(props.onChangeStatus).toHaveBeenNthCalledWith(2, "archived");
  });

  it("does not expose scheduling for a live entry with unpublished changes", () => {
    render(
      <CmsEditorLayout
        {...buildProps()}
        status="published"
        publicationState="published-with-changes"
        lastPublishedAt="2026-02-26T06:30:00.000Z"
      >
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(
      screen.queryByRole("button", { name: "Schedule update content" }),
    ).toBeNull();
    expect(screen.queryByText("Schedule update")).toBeNull();
  });

  it("shows scheduled summary and schedule controls for scheduled entries", () => {
    render(
      <CmsEditorLayout
        {...buildProps()}
        status="scheduled"
        publicationState="scheduled"
        lastPublishedAt="2026-02-26T06:30:00.000Z"
      >
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText(/Scheduled to go live/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reschedule content" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move to draft" })).toBeInTheDocument();
  });

  it("does not render schedule action when the live version is already up to date", () => {
    render(
      <CmsEditorLayout
        {...buildProps()}
        status="published"
        publicationState="published"
        lastPublishedAt="2026-02-26T06:30:00.000Z"
      >
        <div>Editor Body</div>
      </CmsEditorLayout>,
    );

    expect(screen.queryByRole("button", { name: "Schedule content" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Schedule update content" }),
    ).toBeNull();
  });
});
