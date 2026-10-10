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
    text: "Published. The API serves the last published version.",
    iconClass: "lucide-circle-check",
  },
  {
    name: "changes",
    publicationState: "published-with-changes",
    deliveryState: "available",
    variant: "warning",
    text: "Published version available. Republish to include your latest edits.",
    iconClass: "lucide-refresh-cw",
  },
  {
    name: "draft",
    publicationState: "draft",
    deliveryState: "unpublished",
    variant: "info",
    text: "Not published. Publish this entry before requesting it. You can copy the request now.",
    iconRef: "#icon-info",
  },
  {
    name: "scheduled",
    publicationState: "scheduled",
    deliveryState: "unpublished",
    variant: "info",
    text: "Not published. Publish this entry before requesting it. You can copy the request now.",
    iconRef: "#icon-info",
  },
  {
    name: "archived",
    publicationState: "archived",
    deliveryState: "unpublished",
    variant: "warning",
    text: "Archived. Restore and republish before requesting this entry.",
    iconRef: "#icon-alert",
  },
  {
    name: "legacy",
    publicationState: "published",
    deliveryState: "republish_required",
    variant: "warning",
    text: "Republish once to make this previously published entry available through the API.",
    iconClass: "lucide-refresh-cw",
  },
  {
    name: "unknown",
    publicationState: "published",
    deliveryState: "unknown",
    variant: "info",
    text: "Publication status unavailable. The API serves published content only.",
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
  it("does not infer snapshot availability from newer draft timestamps", () => {
    render(ui({ ...entryContext, publicationState: "published-with-changes", deliveryState: "unknown" }));
    expect(screen.getByText("Publication status unavailable. The API serves published content only.")).toBeInTheDocument();
    expect(screen.queryByText("Published version available. Republish to include your latest edits.")).toBeNull();
  });
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
        .getByText("Published. The API serves the last published version.")
        .closest("[data-lumia-alert]"),
    ).toHaveAttribute("aria-live", "off");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
