import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { ApiAccessSheet } from "./ApiAccessSheet";
import {
  entryContext as entryFixture,
  folderContext as folderFixture,
} from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";
let sequence = 0;
let entryContext: IntegrationContext;
let folderContext: IntegrationContext;
beforeEach(() => {
  const workspaceId = `80000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  entryContext = { ...entryFixture, workspaceId };
  folderContext = { ...folderFixture, workspaceId };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function Harness({
  context = folderContext,
  host = "list",
}: {
  context?: IntegrationContext;
  host?: "list" | "editor";
}) {
  const [open, setOpen] = useState(false);
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <ApiAccessSheet
        context={context}
        host={host}
        open={open}
        onOpenChange={setOpen}
        trigger={<button>Open request</button>}
      />
    </NextIntlClientProvider>
  );
}
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Open request" }));
}
it("focuses the title, describes the sheet, renders ordered steps and restores trigger focus", async () => {
  render(<Harness />);
  open();
  const dialog = screen.getByRole("dialog", { name: 'Use "News" via API' });
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: 'Use "News" via API' }),
    ).toHaveFocus(),
  );
  expect(
    screen.getByRole("heading", { name: 'Use "News" via API' }),
  ).toHaveAttribute("title", "News");
  expect(
    screen.getByRole("heading", { name: 'Use "News" via API' }),
  ).toHaveClass("line-clamp-2");
  expect(
    screen.getByRole("heading", { name: "Get a read-only key" }),
  ).toBeVisible();
  expect(
    screen
      .getByRole("heading", { name: "Get a read-only key" })
      .querySelector('[aria-hidden="true"]'),
  ).toHaveTextContent("1.");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAccessibleDescription(
    "Copy a request that returns this content from the CMS API.",
  );
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  expect(within(dialog).queryByRole("tab")).toBeNull();
  expect(dialog.textContent).toContain(
    "JavaScript SDK and scripts are coming soon.",
  );
  expect(
    within(dialog).queryByRole("button", { name: /SDK|scripts/i }),
  ).toBeNull();
  const buttons = within(dialog).getAllByRole("button");
  expect(buttons.at(-1)).toHaveAccessibleName("Close");
  fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Open request" })).toHaveFocus(),
  );
});
it.each([
  ["draft", "unpublished", true],
  ["scheduled", "unpublished", true],
  ["published-with-changes", "available", true],
  ["archived", "available", true],
  ["published", "republish_required", true],
  ["published", "available", false],
  ["published", "unknown", false],
] as const)(
  "shows publication guidance for %s / %s only when needed",
  (publicationState, deliveryState, visible) => {
    render(
      <Harness
        context={{ ...entryContext, publicationState, deliveryState }}
      />,
    );
    open();
    const link = screen.queryByRole("link", {
      name: "Publish from the editor",
    });
    if (visible)
      expect(link).toHaveAttribute(
        "href",
        `/dashboard/editorial/content/entry/${entryFixture.target.kind === "entry" ? entryFixture.target.entryId : ""}/edit?panel=api`,
      );
    else expect(link).toBeNull();
  },
);
it("closes the sheet when following publication guidance", () => {
  render(<Harness context={{ ...entryContext, publicationState: "draft" }} />);
  open();
  const link = screen.getByRole("link", { name: "Publish from the editor" });
  link.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(link);
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("points editor users at Publish without an editor navigation link", () => {
  render(
    <Harness
      context={{ ...entryContext, publicationState: "draft" }}
      host="editor"
    />,
  );
  open();
  expect(
    screen.getByText("Use Publish at the top of the editor."),
  ).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Publish from the editor" }),
  ).toBeNull();
});
it("keeps the key link safe and preview collapsed until requested", () => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL", "https://auth.xynes.com");
  render(<Harness />);
  open();
  const link = screen.getByRole("link", { name: /Create key/ });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(link).toHaveAttribute(
    "href",
    expect.stringContaining("preset=cms_readonly&workspace=editorial"),
  );
  expect(
    screen.queryByText(
      "Example only, not your live content. Fields match your selection.",
    ),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "What you'll get back" }));
  const example = screen.getByLabelText("What you'll get back", {
    selector: "pre",
  });
  expect(example.tagName).toBe("PRE");
  expect(example).toHaveAttribute("translate", "no");
  expect(JSON.parse(example.textContent ?? "")).toMatchObject({
    ok: true,
    data: { items: expect.any(Array) },
  });
  expect(screen.queryByRole("table")).toBeNull();
});
it("uses a full-height bottom sheet on small screens", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(<Harness />);
  open();
  expect(screen.getByRole("dialog")).toHaveAttribute(
    "data-lumia-sheet-side",
    "bottom",
  );
  expect(screen.getByRole("dialog")).toHaveClass("h-[100dvh]", "w-full");
});
