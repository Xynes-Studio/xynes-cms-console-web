import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { RequestStep } from "./RequestStep";
import { useContentIntegration } from "./useContentIntegration";
import { folderContext } from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";

let sequence = 0;
let context: IntegrationContext;
beforeEach(() => {
  context = {
    ...folderContext,
    workspaceId: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Harness({
  value = context,
  onFixField = () => {},
}: {
  value?: IntegrationContext;
  onFixField?: (field: string) => void;
}) {
  const controller = useContentIntegration(value);
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <RequestStep controller={controller} onFixField={onFixField} />
      <input
        aria-label="Test limit"
        value={controller.controls.limit}
        onChange={(event) =>
          controller.updateControls({ limit: event.target.value })
        }
      />
    </NextIntlClientProvider>
  );
}
describe("request step", () => {
  it("shows a full wrapping cURL block, marked placeholder and standard Copy button", () => {
    render(<Harness />);
    const code = screen.getByLabelText("Request code, cURL");
    expect(code.tagName).toBe("PRE");
    expect(code).toHaveAttribute("translate", "no");
    expect(code).toHaveAttribute("tabindex", "0");
    expect(code.textContent).toContain(
      "Authorization: Bearer ${XYNES_API_KEY}",
    );
    expect(code.querySelector("mark")?.textContent).toContain("XYNES_API_KEY");
    expect(code).toHaveClass("whitespace-pre-wrap", "break-all");
    expect(code).not.toHaveClass("overflow-auto");
    expect(screen.getByRole("button", { name: "Copy" })).not.toHaveClass(
      "h-auto",
    );
    expect(document.querySelector("textarea,table")).toBeNull();
  });
  it("gives Copy and Copied icons the button foreground and keeps the toolbar above full-width code", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button.querySelector("svg")).toHaveStyle({ color: "currentColor" });
    const code = screen.getByLabelText("Request code, cURL");
    expect(code).not.toHaveClass("pr-20");
    expect(button.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);
    const copied = await screen.findByRole("button", { name: "Copied" });
    expect(copied.querySelector("svg")).toHaveStyle({ color: "currentColor" });
  });
  it("uses semantic highlight surface and foreground for credential placeholders", () => {
    render(<Harness />);
    const mark = screen.getByLabelText("Request code, cURL").querySelector("mark");
    expect(mark).toHaveClass("bg-highlight", "text-highlight-foreground");
  });
  it("keeps a pending copy visibly legible and announces progress", async () => {
    let finish: () => void = () => {};
    vi.stubGlobal("navigator", { clipboard: { writeText: () => new Promise<void>(resolve => { finish = resolve; }) } });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    const copy = screen.getByRole("button", { name: "Copy" });
    try {
      await waitFor(() => expect(copy).toHaveAttribute("aria-busy", "true"));
      expect(copy).toHaveStyle({ opacity: "1" });
      expect(screen.getByRole("status")).toHaveTextContent("Copying…");
    } finally {
      await act(async () => finish());
    }
  });
  it.each(["cURL", "JavaScript", "URL"])(
    "marks the credential helper in %s and applies format-specific wrapping",
    (format) => {
      render(<Harness />);
      fireEvent.click(screen.getByRole("radio", { name: format }));
      const code = screen.getByLabelText(`Request code, ${format}`);
      expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
      if (format === "JavaScript")
        expect(code).toHaveClass("max-h-[28rem]", "overflow-auto");
      else expect(code).not.toHaveClass("overflow-auto");
      if (format === "URL")
        expect(
          screen.getByText(
            "URL requests still need the header Authorization: Bearer <your key>.",
          ),
        ).toBeVisible();
    },
  );
  it("highlights only the changed query parameter without changing copied bytes", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Test limit"), {
      target: { value: "7" },
    });
    const code = screen.getByLabelText("Request code, cURL");
    const changed = code.querySelector("[data-changed-param]");
    expect(changed?.textContent).toBe("limit=7");
    expect(changed).toHaveClass("motion-reduce:transition-none");
    expect(code.textContent).toContain("limit=7&");
  });
  it("hides Copy for invalid options, names the field and exposes its focus action", () => {
    const fix = vi.fn();
    render(<Harness onFixField={fix} />);
    fireEvent.change(screen.getByLabelText("Test limit"), {
      target: { value: "500" },
    });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(
      screen.getByText("Fix Items per page to update the request."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Go to field" }));
    expect(fix).toHaveBeenCalledWith("limit");
  });
  it("hides Copy and unsafe configuration details for an invalid gateway address", () => {
    render(
      <Harness
        value={{
          ...context,
          apiBaseUrl: "https://username:private@api.xynes.com",
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(document.body.textContent).not.toContain("private");
    expect(
      screen.getByText(/Public API address is missing or invalid/),
    ).toBeVisible();
  });
  it("copies exactly the rendered snippet and announces Copied", async () => {
    const write = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    render(<Harness />);
    const expected = screen.getByLabelText("Request code, cURL").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied" })).toBeVisible(),
    );
    expect(write).toHaveBeenCalledWith(expected);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });
  it("focuses and selects the whole code when clipboard access fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Fixture denial")),
      },
    });
    render(<Harness />);
    const code = screen.getByLabelText("Request code, cURL");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByText(
      "Couldn't copy. Select the code and copy it manually.",
    );
    expect(code).toHaveFocus();
    expect(window.getSelection()?.toString()).toBe(code.textContent);
  });
  it("restores manual selection again when a repeated copy is denied", async () => {
    const write = vi.fn().mockRejectedValue(new Error("Fixture denial"));
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    render(<Harness />);
    const code = screen.getByLabelText("Request code, cURL");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByText(
      "Couldn't copy. Select the code and copy it manually.",
    );
    screen.getByLabelText("Test limit").focus();
    window.getSelection()?.removeAllRanges();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(code).toHaveFocus());
    expect(window.getSelection()?.toString()).toBe(code.textContent);
  });
});
