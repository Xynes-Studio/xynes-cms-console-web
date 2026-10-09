import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { ApiAccessContent } from "./ApiAccessSheet";
import { folderContext as fixture, entryContext } from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";
let context: IntegrationContext;
let sequence=0;
beforeEach(() => { context={...fixture,workspaceId:`60000000-0000-4000-8000-${String(++sequence).padStart(12,"0")}`}; });
afterEach(() => {cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function ui(value=context,locale="en-US") {return <NextIntlClientProvider locale={locale} messages={getCmsMessages(locale)}><ApiAccessContent context={value} /></NextIntlClientProvider>;}
it("starts with copy-ready cURL and collapsed customization", () => {
 render(ui());expect(screen.getByRole("radio",{name:"cURL"})).toHaveAttribute("aria-checked","true");
 expect(screen.queryByLabelText("Items per page")).toBeNull();expect(screen.getByText("20 items · Newest first · 5 fields")).toBeVisible();
});
it("allows bounded search/pagination and reflects combined sort in the full request", () => {
 render(ui());fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
 fireEvent.change(screen.getByLabelText("Sort"),{target:{value:"title:asc"}});
 fireEvent.change(screen.getByLabelText("Skip first"),{target:{value:"3"}});
 fireEvent.change(screen.getByLabelText("Title or description contains"),{target:{value:"design"}});
 expect(screen.getByLabelText("Request code, cURL").textContent).toContain("sortBy=title&sortDirection=asc");
 expect(screen.getByLabelText("Request code, cURL").textContent).toContain("search=design");
});
it("projects selected entry fields into static JSON, always includes ID and omits folder controls", () => {
 render(ui({...entryContext,workspaceId:context.workspaceId}));fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
 expect(screen.getByRole("checkbox",{name:"Body"})).toBeChecked();expect(screen.queryByLabelText("Items per page")).toBeNull();
 expect(screen.queryByRole("checkbox",{name:/ID/})).toBeNull();
 fireEvent.click(screen.getByRole("checkbox",{name:"Body"}));
 fireEvent.click(screen.getByRole("button",{name:"What you'll get back"}));
 const json = screen.getByLabelText("What you'll get back",{selector:"pre"}).textContent;
 expect(json).not.toContain('"body"');expect(json).toContain('"id"');
 expect(screen.getByText("Example only, not your live content. Fields match your selection.")).toBeVisible();
});
it("supports segmented keyboard navigation without UI tabs", () => {
 render(ui());const radio=screen.getByRole("radio",{name:"cURL"});radio.focus();fireEvent.keyDown(radio,{key:"ArrowRight"});
 expect(screen.getByRole("radio",{name:"JavaScript"})).toHaveFocus();expect(screen.queryByRole("tab")).toBeNull();
});
it("rejects hostile Workspace Admin origins using the existing link builder", () => {
 vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL","javascript:alert(1)");render(ui());
 expect(screen.getByRole("link",{name:/Create key/})).toHaveAttribute("href",expect.stringMatching(/^\/dashboard\/integrations\?/));
});
it("opening and configuring performs no fetch or persistent storage writes", () => {
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);const storage=vi.spyOn(Storage.prototype,"setItem");
 render(ui());fireEvent.click(screen.getByRole("button",{name:"Adjust"}));
 fireEvent.change(screen.getByLabelText("Items per page"),{target:{value:"7"}});
 expect(fetch).not.toHaveBeenCalled();expect(storage).not.toHaveBeenCalled();storage.mockRestore();
});
it("renders pseudo copy and protocol placeholders without untranslated keys", () => {
 render(ui(context,"en-XA"));expect(screen.getByRole("button",{name:/CCooppyy/})).toBeVisible();
 expect(screen.getByLabelText(/RReeqquueesstt ccooddee/).textContent).toContain("XYNES_API_KEY");
 expect(document.body.textContent).not.toContain("cms.contentIntegrations.");
});
