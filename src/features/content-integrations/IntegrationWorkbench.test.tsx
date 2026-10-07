import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { IntegrationWorkbench } from "./IntegrationWorkbench";
import { ContentIntegrationDialog } from "./ContentIntegrationDialog";
import { folderContext, entryContext } from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function ui(context:IntegrationContext=folderContext,locale="en-US") {
 return <NextIntlClientProvider locale={locale} messages={getCmsMessages(locale)}><IntegrationWorkbench context={context}/></NextIntlClientProvider>;
}
function rest() {fireEvent.click(screen.getByRole("tab",{name:"REST API"}));}
describe("integration workbench",()=>{
 it("shows folder context, friendly controls and JSON, with Customize selected",()=>{
  render(ui());expect(screen.getByRole("tab",{name:"Customize"})).toHaveAttribute("aria-selected","true");
  expect(screen.getByText("News")).toBeVisible();expect(screen.getByText("editorial")).toBeVisible();
  expect(screen.getByLabelText("Items per request")).toHaveValue(20);
  expect(screen.getByLabelText("Order by")).toHaveValue("publishedAt");
  expect(screen.getByRole("checkbox",{name:"ID — always returned"})).toBeDisabled();
  expect(screen.queryByRole("checkbox",{name:"Body"})).toBeNull();expect(screen.getByText("JSON")).toBeVisible();
 });
 it("allows bounded advanced filters and title ordering",()=>{
  render(ui());fireEvent.change(screen.getByLabelText("Order by"),{target:{value:"title"}});
  expect(screen.getByRole("option",{name:"A–Z"})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Direction"),{target:{value:"asc"}});
  fireEvent.click(screen.getByText("Advanced"));fireEvent.change(screen.getByLabelText("Skip items"),{target:{value:"3"}});
  fireEvent.change(screen.getByLabelText("Search title"),{target:{value:"design"}});rest();
  expect(screen.getByLabelText("Request URL")).toHaveProperty("value",expect.stringContaining("sortBy=title&sortDirection=asc"));
  expect(screen.getByLabelText("Request URL")).toHaveProperty("value",expect.stringContaining("search=design"));
 });
 it("entry has body and no list controls",()=>{
  render(ui(entryContext));expect(screen.getByRole("checkbox",{name:"Body"})).toBeChecked();
  expect(screen.queryByLabelText("Items per request")).toBeNull();expect(screen.queryByText("Advanced")).toBeNull();
 });
 it("projects selected fields into table and static example",()=>{
  render(ui(entryContext));fireEvent.click(screen.getByRole("checkbox",{name:"Body"}));rest();
  const table=screen.getByRole("table");expect(within(table).queryByText("body")).toBeNull();
  expect(within(table).getByText("id")).toBeVisible();expect(screen.getByText("Static example — not live content")).toBeVisible();
  expect(screen.getByLabelText("Example response").textContent).not.toContain('"body"');
  expect(screen.getByLabelText("Code example")).toHaveProperty("value",expect.stringContaining("${XYNES_API_KEY}"));
 });
 it.each(["Scripts","SDK"])("keeps %s selectable and explains REST availability",name=>{
  render(ui());fireEvent.click(screen.getByRole("tab",{name}));
  const panel=screen.getByRole("tabpanel");expect(within(panel).getByText("Coming soon")).toBeVisible();
  const shortcut=within(panel).getByRole("button",{name:"Use REST API"});shortcut.focus();fireEvent.click(shortcut);expect(screen.getByRole("tab",{name:"REST API"})).toHaveFocus();expect(screen.getByRole("tab",{name:"REST API"})).toHaveAttribute("aria-selected","true");
 });
 it("supports real tab keyboard navigation",()=>{
  render(ui());const tab=screen.getByRole("tab",{name:"Customize"});tab.focus();fireEvent.keyDown(tab,{key:"ArrowRight"});
  expect(screen.getByRole("tab",{name:"REST API"})).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("tab",{name:"REST API"}),{key:"End"});expect(screen.getByRole("tab",{name:"SDK"})).toHaveFocus();
 });
 it("invalid configuration blocks preview/copy and hides the unsafe URL",()=>{
  render(ui({...folderContext,apiBaseUrl:"https://username:private@api.xynes.com"}));rest();
  expect(screen.getByRole("alert")).toHaveTextContent("Public API address");
  expect(screen.getByRole("button",{name:"Copy example"})).toBeDisabled();expect(screen.queryByLabelText("Request URL")).toBeNull();
  expect(document.body.textContent).not.toContain("private");
 });
 it("invalid option reports feedback; valid input recovers",()=>{
  render(ui());fireEvent.change(screen.getByLabelText("Items per request"),{target:{value:"101"}});
  expect(screen.getByRole("alert")).toHaveTextContent("whole numbers");
  fireEvent.change(screen.getByLabelText("Items per request"),{target:{value:"1"}});expect(screen.queryByRole("alert")).toBeNull();
 });
 it.each([
  [{...entryContext,publicationState:"draft" as const},"Publish this content"],
  [{...entryContext,publicationState:"scheduled" as const},"Publish this content"],
  [{...entryContext,publicationState:"archived" as const},"Republish this archived content"],
  [{...entryContext,publicationState:"published-with-changes" as const},"Saved edits are excluded"],
  [{...entryContext,deliveryState:"republish_required" as const},"legacy content"],
  [entryContext,"Availability has not been checked"],
  [{...entryContext,publicationState:"published" as const,deliveryState:"available" as const},"last published version"],
  [{...entryContext,deliveryState:"unpublished" as const},"Publish this content"],
 ])("explains availability without claiming a live response",(context,copy)=>{
  render(ui(context));expect(screen.getByRole("status")).toHaveTextContent(copy);rest();
  expect(screen.getByRole("button",{name:"Copy example"})).toBeEnabled();
 });
 it("uses a safe native Workspace Admin link and readonly preset",()=>{
  vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL","https://auth.xynes.com");render(ui());
  const link=screen.getByRole("link",{name:/Get a read-only API key/});expect(link.tagName).toBe("A");
  expect(link).toHaveAttribute("href","https://auth.xynes.com/dashboard/integrations?tab=api-keys&preset=cms_readonly&workspace=editorial");
  expect(link).toHaveAttribute("rel","noopener noreferrer");expect(link).toHaveAttribute("target","_blank");expect(link).toHaveTextContent("opens in new tab");
 });
 it("rejects hostile admin origins",()=>{
  vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL","javascript:alert(1)");render(ui());
  expect(screen.getByRole("link",{name:/Get a read-only API key/})).toHaveAttribute("href",expect.stringMatching(/^\/dashboard\/integrations\?/));
 });
 it("resets controls, tabs and copy feedback on context switch",()=>{
  const {rerender}=render(ui());fireEvent.change(screen.getByLabelText("Items per request"),{target:{value:"99"}});rest();rerender(ui(entryContext));
  expect(screen.getByRole("tab",{name:"Customize"})).toHaveAttribute("aria-selected","true");expect(screen.getByText("First story")).toBeVisible();
 });
 it("leaves selectable code and polite manual-copy guidance after clipboard denial",async()=>{
  vi.stubGlobal("navigator",{clipboard:{writeText:vi.fn().mockRejectedValue(new Error("private-token"))}});render(ui());rest();
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Copy example"}));});
  expect(screen.getByLabelText("Code example")).toHaveAttribute("readonly");expect(screen.getByText(/Copy manually/)).toHaveAttribute("aria-live","polite");
  expect(document.body.textContent).not.toContain("private-token");
 });
 it("shows copy success and the selected URL format",async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal("navigator",{clipboard:{writeText}});render(ui());rest();
  fireEvent.change(screen.getByLabelText("Code format"),{target:{value:"url"}});
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Copy example"}));});
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/api\.xynes\.com\//));expect(screen.getByText("Copied")).toBeVisible();
 });
 it("renders pseudo-locale copy without untranslated keys",()=>{
  render(ui(folderContext,"en-XA"));expect(screen.getByRole("tab",{name:/CCuussttoommiizzee/})).toBeVisible();expect(document.body.textContent).not.toContain("cms.contentIntegrations.");
 });
 it("opening/configuring performs no fetch or storage writes",()=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);const storage=vi.spyOn(Storage.prototype,"setItem");render(ui());rest();
  expect(fetch).not.toHaveBeenCalled();expect(storage).not.toHaveBeenCalled();storage.mockRestore();
 });
});
describe("integration dialog",()=>{
 it("renders a named modal with workspace and target context and forwards close",()=>{
  const close=vi.fn();render(<NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}><ContentIntegrationDialog context={entryContext} open onOpenChange={close}/></NextIntlClientProvider>);
  expect(screen.getByRole("dialog",{name:"Content integrations"})).toHaveTextContent("First story");
  fireEvent.click(screen.getByRole("button",{name:"Close integrations"}));expect(close).toHaveBeenCalledWith(false);
 });
 it("does not render a closed dialog",()=>{
  render(<NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}><ContentIntegrationDialog context={entryContext} open={false} onOpenChange={()=>{}}/></NextIntlClientProvider>);
  expect(screen.queryByRole("dialog")).toBeNull();
 });
});

describe("additional preview interactions",()=>{
 it("allows reselecting folder summary fields and both ordering directions",()=>{
  render(ui());const title=screen.getByRole("checkbox",{name:"Title"});fireEvent.click(title);expect(title).not.toBeChecked();fireEvent.click(title);expect(title).toBeChecked();
  fireEvent.change(screen.getByLabelText("Direction"),{target:{value:"asc"}});fireEvent.change(screen.getByLabelText("Direction"),{target:{value:"desc"}});
  fireEvent.change(screen.getByLabelText("Order by"),{target:{value:"title"}});fireEvent.change(screen.getByLabelText("Order by"),{target:{value:"publishedAt"}});
  expect(screen.getByRole("option",{name:"Newest first"})).toBeInTheDocument();
 });
 it("renders server-side fetch and blocks repeat copy while pending",async()=>{
  let finish:(()=>void)|undefined;vi.stubGlobal("navigator",{clipboard:{writeText:vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}))}});
  render(ui());rest();fireEvent.change(screen.getByLabelText("Code format"),{target:{value:"serverFetch"}});
  expect(screen.getByLabelText("Code example")).toHaveAttribute("rows","12");
  expect(screen.getByLabelText("Code example")).toHaveProperty("value",expect.stringContaining("process.env.XYNES_API_KEY"));
  fireEvent.click(screen.getByRole("button",{name:"Copy example"}));expect(screen.getByRole("button",{name:"Copying…"})).toBeDisabled();
  await act(async()=>{finish?.();});expect(screen.getByText("Copied")).toBeVisible();
 });
 it("keeps labels escaped and displays no executable content",()=>{
  render(ui({...entryContext,target:{...entryContext.target,label:'<img src=x onerror=alert(1)>'}}));
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();expect(document.querySelector("img")).toBeNull();
 });
 it("accepts a host trigger with real Lumia focus semantics",()=>{
  render(<NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}><ContentIntegrationDialog context={entryContext} open={false} onOpenChange={()=>{}} trigger={<button type="button">Open integration</button>}/></NextIntlClientProvider>);
  expect(screen.getByRole("button",{name:"Open integration"})).toBeVisible();
 });
});
