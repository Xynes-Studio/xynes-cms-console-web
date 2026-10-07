import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { IntegrationWorkbench } from "./IntegrationWorkbench";
import { ContentIntegrationPanel } from "./ContentIntegrationPanel";
import { folderContext, entryContext } from "./workbench-test-fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function ui(child: React.ReactNode, locale = "en-US") {
  return (
    <NextIntlClientProvider locale={locale} messages={getCmsMessages(locale)}>
      {child}
    </NextIntlClientProvider>
  );
}
it.each([
  ["Items per request", "0", "Enter a whole number from 1 to 100 items."],
  ["Items per request", "1.5", "Enter a whole number from 1 to 100 items."],
  ["Items per request", "", "Enter a whole number from 1 to 100 items."],
  ["Skip items", "-1", "Enter a whole number from 0 to 10,000 items skipped."],
])(
  "associates localized validation with %s (%s), preserves invalid value and recovers",
  (label, value, message) => {
    render(ui(<IntegrationWorkbench context={folderContext} />));
    if (label === "Skip items") fireEvent.click(screen.getByText("Advanced"));
    const input = screen.getByLabelText(label);
    expect(input).toHaveAccessibleDescription(/items/);
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
    const error = screen.getByText(message);
    expect(error).toHaveAttribute("aria-live", "polite");
    expect(error.id).not.toBe("");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(
      error.id,
    );
    expect(input).toHaveProperty("value", value);
    fireEvent.change(input, { target: { value: "3" } });
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(message)).toBeNull();
  },
);
it("announces invalid configuration politely in full and compact views without exposing credentials", () => {
  const context = {
    ...entryContext,
    apiBaseUrl: "https://user:private-secret@api.xynes.com",
  };
  const { rerender } = render(ui(<IntegrationWorkbench context={context} />));
  for (const child of [
    <IntegrationWorkbench key="full" context={context} />,
    <ContentIntegrationPanel key="panel" context={context} />,
  ]) {
    rerender(ui(child));
    const status = screen
      .getByText(/Public API address/)
      .closest('[role="status"]');
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body.textContent).not.toContain("private-secret");
  }
});
it.each(["Scripts", "SDK"])(
  "announces %s as Coming soon without exposing installable code",
  (name) => {
    render(ui(<IntegrationWorkbench context={folderContext} />));
    fireEvent.click(screen.getByRole("tab", { name }));
    const panel = screen.getByRole("tabpanel");
    const status = within(panel).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Coming soon");
    expect(panel.querySelector("script,textarea,pre")).toBeNull();
  },
);
it("keeps protocol code untranslatable, spellcheck-free and selectable, with polite copy results", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  render(ui(<IntegrationWorkbench context={folderContext} />));
  fireEvent.click(screen.getByRole("tab", { name: "REST API" }));
  for (const name of ["Request URL", "Code example"]) {
    const input = screen.getByLabelText(name);
    expect(input).toHaveAttribute("translate", "no");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("readonly");
  }
  expect(screen.getByLabelText("Example response")).toHaveAttribute(
    "translate",
    "no",
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy example" }));
  });
  expect(screen.getByText("Copied")).toHaveAttribute("role", "status");
  expect(screen.getByText("Copied")).toHaveAttribute("aria-live", "polite");
});

it("links excessive title search to its own polite character error", () => {
  render(ui(<IntegrationWorkbench context={folderContext} />));
  fireEvent.click(screen.getByText("Advanced"));
  const search = screen.getByLabelText("Search title");
  fireEvent.change(search, { target: { value: "x".repeat(201) } });
  expect(search).toHaveAttribute("aria-invalid", "true");
  expect(search).toHaveAccessibleDescription(
    expect.stringContaining("Use no more than 200 characters."),
  );
  fireEvent.change(search, { target: { value: " news " } });
  expect(search).not.toHaveAttribute("aria-invalid", "true");
});
it("uses pseudo-localized validation with unchanged ICU bounds", () => {
  render(ui(<IntegrationWorkbench context={folderContext} />, "en-XA"));
  const input = screen.getByLabelText(/IItteemmss ppeerr rreeqquueesstt/);
  fireEvent.change(input, { target: { value: "101" } });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription(/\[EEnntteerr.*1.*100/);
  expect(document.body.textContent).not.toContain("cms.contentIntegrations.");
});

it("labels and exposes the horizontal field-table scroller to keyboard users", () => {
  render(ui(<IntegrationWorkbench context={folderContext} />));
  fireEvent.click(screen.getByRole("tab", { name: "REST API" }));
  const scroller = screen.getByRole("region", {
    name: "Selected response fields",
  });
  expect(scroller).toHaveAttribute("tabindex", "0");
  expect(within(scroller).getByRole("table")).toHaveAccessibleName(
    "Selected response fields",
  );
});
