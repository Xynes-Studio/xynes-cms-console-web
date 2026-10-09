import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { EditorApiCard } from "./EditorApiCard";
import { entryContext } from "./workbench-test-fixtures";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it("shares legacy publication recovery, readonly-key link and compact preview without nested tabs", () => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL", "https://auth.xynes.com");
  render(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <EditorApiCard
        context={{ ...entryContext, deliveryState: "republish_required" }}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByText(/before API delivery existed/).closest('[role="status"]'),
  ).toHaveTextContent("before API delivery existed");
  expect(
    screen.getByText("Use Publish at the top of the editor."),
  ).toBeVisible();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
  expect(document.querySelector("pre,code,textarea")).toBeNull();
  expect(screen.getByText("6 of 6 fields")).toBeVisible();
});
it("keeps missing delivery metadata unknown even when the authoring badge is published", () => {
  render(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <EditorApiCard
        context={{
          ...entryContext,
          publicationState: "published",
          deliveryState: "unknown",
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen
      .getByText(/couldn't confirm whether this is live/)
      .closest('[role="status"]'),
  ).toHaveAttribute("role", "status");
});
it("blocks unsafe public configuration without exposing it", () => {
  render(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <EditorApiCard
        context={{
          ...entryContext,
          apiBaseUrl: "https://operator:private-credential@api.xynes.com",
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  expect(screen.queryByLabelText("Request URL")).toBeNull();
  expect(document.body.textContent).not.toContain("private-credential");
});
