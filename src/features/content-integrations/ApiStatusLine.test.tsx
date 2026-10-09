import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { ApiStatusLine } from "./ApiStatusLine";
import { entryContext, folderContext } from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";

function ui(context: IntegrationContext) {
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <ApiStatusLine context={context} />
    </NextIntlClientProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const states = [
  {
    name: "published",
    publicationState: "published",
    deliveryState: "available",
    variant: "success",
    text: "Live. The API returns the last published version.",
    iconClass: "lucide-circle-check",
  },
  {
    name: "changes",
    publicationState: "published-with-changes",
    deliveryState: "available",
    variant: "warning",
    text: "Live, but your latest edits aren't. Republish to update what the API returns.",
    iconClass: "lucide-refresh-cw",
  },
  {
    name: "draft",
    publicationState: "draft",
    deliveryState: "unpublished",
    variant: "info",
    text: "Not live yet. Publish this entry and the request starts working. You can copy it now.",
    iconRef: "#icon-info",
  },
  {
    name: "scheduled",
    publicationState: "scheduled",
    deliveryState: "unpublished",
    variant: "info",
    text: "Not live yet. Publish this entry and the request starts working. You can copy it now.",
    iconRef: "#icon-info",
  },
  {
    name: "archived",
    publicationState: "archived",
    deliveryState: "unpublished",
    variant: "warning",
    text: "Not live. Archived content isn't served. Restore and republish it to go live.",
    iconRef: "#icon-alert",
  },
  {
    name: "legacy",
    publicationState: "published",
    deliveryState: "republish_required",
    variant: "warning",
    text: "Not live. This was published before API delivery existed. Republish it once to fix it.",
    iconClass: "lucide-refresh-cw",
  },
  {
    name: "unknown",
    publicationState: "published",
    deliveryState: "unknown",
    variant: "info",
    text: "We couldn't confirm whether this is live. The request works once it's published.",
    iconRef: "#icon-info",
  },
] satisfies ReadonlyArray<{
  name: string;
  publicationState: IntegrationContext["publicationState"];
  deliveryState: IntegrationContext["deliveryState"];
  variant: string;
  text: string;
  iconClass?: string;
  iconRef?: string;
}>;

describe("API status line", () => {
  it.each(states)(
    "renders $name with the correct copy, Alert variant and icon",
    (state) => {
      render(
        ui({
          ...entryContext,
          publicationState: state.publicationState,
          deliveryState: state.deliveryState,
        }),
      );
      const copy = screen.getByText(state.text);
      const alert = copy.closest("[data-lumia-alert]");
      expect(alert).toHaveAttribute("data-variant", state.variant);
      if ("iconRef" in state)
        expect(alert?.querySelector("svg use")).toHaveAttribute(
          "href",
          state.iconRef,
        );
      else expect(alert?.querySelector("svg")).toHaveClass(state.iconClass);
      expect(alert?.textContent).not.toMatch(
        /snapshot|validated|legacy content|delivery state|integrations/i,
      );
      expect(alert?.querySelector("button,a")).toBeNull();
    },
  );
  it("uses fixed informational folder copy without a count or nested-folder promise", () => {
    render(ui(folderContext));
    const copy = screen.getByText(
      "Returns published entries in this folder. Drafts and subfolders aren't included. If you moved an entry here, republish it to include it.",
    );
    expect(copy.closest("[data-lumia-alert]")).toHaveAttribute(
      "data-variant",
      "info",
    );
    expect(
      copy.closest("[data-lumia-alert]")?.querySelector("svg use"),
    ).toHaveAttribute("href", "#icon-info");
  });
  it("announces on mount then stops live announcements before later status updates", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      ui({
        ...entryContext,
        publicationState: "draft",
        deliveryState: "unpublished",
      }),
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    act(() => vi.advanceTimersByTime(32));
    expect(screen.queryByRole("status")).toBeNull();
    rerender(
      ui({
        ...entryContext,
        publicationState: "published",
        deliveryState: "available",
      }),
    );
    expect(
      screen
        .getByText("Live. The API returns the last published version.")
        .closest("[data-lumia-alert]"),
    ).toHaveAttribute("aria-live", "off");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
