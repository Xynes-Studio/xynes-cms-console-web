import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef, type Ref } from "react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { RequestOptions } from "./RequestOptions";
import { useContentIntegration } from "./useContentIntegration";
import { folderContext, entryContext } from "./workbench-test-fixtures";
import type { IntegrationContext } from "./types";

let sequence = 100;
let context: IntegrationContext;
beforeEach(() => {
  context = {
    ...folderContext,
    workspaceId: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  };
});
afterEach(cleanup);
type Handle = {
  expand: () => void;
  focusField: (name: "limit" | "offset" | "search" | "fields") => void;
};
function Harness({
  value = context,
  optionsRef,
}: {
  value?: IntegrationContext;
  optionsRef?: Ref<Handle>;
}) {
  const controller = useContentIntegration(value);
  return (
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <RequestOptions
        ref={optionsRef}
        context={value}
        controller={controller}
      />
      <output aria-label="Generated request">
        {controller.result.ok ? controller.result.request.url : "invalid"}
      </output>
    </NextIntlClientProvider>
  );
}
describe("request options", () => {
  it("starts collapsed with a truthful summary and shows static ID guidance after Adjust", () => {
    render(<Harness />);
    expect(
      screen.getByText("20 items · Newest first · 5 fields"),
    ).toBeVisible();
    expect(screen.queryByLabelText("Items per page")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adjust" }));
    expect(
      screen.getByRole("spinbutton", { name: "Items per page" }),
    ).toBeVisible();
    expect(screen.getByText("ID is always included")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: /ID/ })).toBeNull();
  });
  it.each(["publishedAt:desc", "publishedAt:asc", "title:asc", "title:desc"])(
    "round-trips combined sort %s into both URL parameters",
    (value) => {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "Adjust" }));
      fireEvent.change(screen.getByLabelText("Sort"), { target: { value } });
      const url = new URL(
        screen.getByLabelText("Generated request").textContent ?? "",
      );
      const [sortBy, sortDirection] = value.split(":");
      expect(url.searchParams.get("sortBy")).toBe(sortBy);
      expect(url.searchParams.get("sortDirection")).toBe(sortDirection);
    },
  );
  it("preserves an out-of-range value and links its inline validation error", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Adjust" }));
    const limit = screen.getByLabelText("Items per page");
    fireEvent.change(limit, { target: { value: "500" } });
    expect(limit).toHaveValue("500");
    expect(limit).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByText("Enter a whole number from 1 to 100 items.");
    expect(limit.getAttribute("aria-describedby")).toContain(error.id);
    expect(screen.getByLabelText("Generated request")).toHaveTextContent(
      "invalid",
    );
  });
  it("expands and focuses an invalid field through its public ref", async () => {
    const options = createRef<Handle>();
    render(<Harness optionsRef={options} />);
    act(() => options.current?.focusField("limit"));
    await waitFor(() =>
      expect(screen.getByLabelText("Items per page")).toHaveFocus(),
    );
  });
  it("explains pagination and title-or-description search using existing bounds", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Adjust" }));
    fireEvent.change(screen.getByLabelText("Skip first"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Title or description contains"), {
      target: { value: " launch " },
    });
    const url = new URL(
      screen.getByLabelText("Generated request").textContent ?? "",
    );
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("search")).toBe("launch");
    expect(
      screen.getByText(/Check page.hasMore in the response/),
    ).toBeVisible();
    expect(screen.getByPlaceholderText("launch")).toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByText("Up to 200 characters")).toBeVisible();
  });
  it("keeps directory options absent for an entry", () => {
    render(
      <Harness value={{ ...entryContext, workspaceId: context.workspaceId }} />,
    );
    expect(screen.getByText("6 of 6 fields")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Adjust" }));
    expect(screen.getByRole("checkbox", { name: "Body" })).toBeChecked();
    expect(screen.queryByLabelText("Sort")).toBeNull();
    expect(screen.queryByLabelText("Items per page")).toBeNull();
    expect(screen.queryByLabelText("Skip first")).toBeNull();
  });
});
