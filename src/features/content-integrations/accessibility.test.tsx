import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { ApiAccessContent } from "./ApiAccessSheet";
import { folderContext as fixture } from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";
let context: IntegrationContext;
let sequence = 0;
beforeEach(() => {context = {...fixture,workspaceId:`70000000-0000-4000-8000-${String(++sequence).padStart(12,"0")}`};});
afterEach(() => {cleanup();vi.unstubAllGlobals();});
function ui(value = context, locale = "en-US") {return <NextIntlClientProvider locale={locale} messages={getCmsMessages(locale)}><ApiAccessContent context={value} /></NextIntlClientProvider>;}
it.each([
  ["Items per page", "0", "Enter a whole number from 1 to 100 items."],
  ["Items per page", "1.5", "Enter a whole number from 1 to 100 items."],
  ["Items per page", "", "Enter a whole number from 1 to 100 items."],
  ["Skip first", "-1", "Enter a whole number from 0 to 10,000 items skipped."],
])("associates localized validation with %s (%s), retains invalid input and recovers", (label,value,message) => {
  render(ui());fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
  const input = screen.getByLabelText(label);
  fireEvent.change(input,{target:{value}});
  expect(input).toHaveAttribute("aria-invalid","true");
  expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
  expect(screen.getByText(message)).toHaveAttribute("aria-live","polite");
  expect(input).toHaveProperty("value",value);
  expect(screen.queryByRole("button",{name:"Copy"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
  fireEvent.click(screen.getByRole("button",{name:"Go to field"}));
  expect(screen.getByLabelText(label)).toHaveFocus();
  fireEvent.change(screen.getByLabelText(label),{target:{value:"3"}});
  expect(screen.getByRole("button",{name:"Copy"})).toBeEnabled();
  expect(screen.queryByText(message)).toBeNull();
});
it("announces unsafe configuration without exposing credentials, even with invalid options", () => {
  render(ui({...context,apiBaseUrl:"https://user:private-secret@api.xynes.com"}));
  fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
  fireEvent.change(screen.getByLabelText("Items per page"),{target:{value:"101"}});
  expect(screen.getByRole("alert")).toHaveTextContent("Public API address");
  expect(document.body.textContent).not.toContain("private-secret");
  expect(screen.queryByRole("button",{name:"Copy"})).toBeNull();
});
it("keeps protocol code untranslatable, selectable and copy feedback polite", async () => {
  vi.stubGlobal("navigator",{clipboard:{writeText:vi.fn().mockResolvedValue(undefined)}});
  render(ui());
  const code = screen.getByLabelText("Request code, cURL");
  expect(code).toHaveAttribute("translate","no");
  expect(code).toHaveAttribute("tabindex","0");
  fireEvent.click(screen.getByRole("button",{name:"Copy"}));
  await screen.findByRole("button",{name:"Copied"});
  expect(screen.getByText("Copied",{selector:"[role=status] span"}).closest("[role=status]")).toHaveAttribute("aria-live","polite");
});
it("links excessive title/description search to its own character error and focus recovery", () => {
  render(ui());fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
  const search = screen.getByLabelText("Title or description contains");
  fireEvent.change(search,{target:{value:"x".repeat(201)}});
  expect(search).toHaveAttribute("aria-invalid","true");
  expect(search).toHaveAccessibleDescription(expect.stringContaining("Use no more than 200 characters."));
  fireEvent.click(screen.getByRole("button",{name:"Go to field"}));expect(search).toHaveFocus();
  fireEvent.change(search,{target:{value:" news "}});expect(search).not.toHaveAttribute("aria-invalid","true");
});
it("uses pseudo-localized controls and validation with unchanged ICU bounds", () => {
  render(ui(context,"en-XA"));fireEvent.click(screen.getByRole("button",{name:/AAddjjuusstt/}));
  const input = screen.getByLabelText(/IItteemmss ppeerr ppaaggee/);
  fireEvent.change(input,{target:{value:"101"}});
  expect(input).toHaveAccessibleDescription(/\[EEnntteerr.*1.*100/);
  expect(document.body.textContent).not.toContain("cms.contentIntegrations.");
});
it("keeps the roadmap non-interactive and removes the field table", () => {
  render(ui());expect(screen.getByText("JavaScript SDK and scripts are coming soon.")).toBeVisible();
  expect(screen.queryByRole("tab")).toBeNull();expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("button",{name:/SDK|scripts/})).toBeNull();
});
