import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import { getCmsMessages } from "../../i18n/config";
import { ContentIntegrationPanel } from "./ContentIntegrationPanel";
import { entryContext } from "./workbench-test-fixtures";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it("shares legacy publication recovery, readonly-key link and compact preview without nested tabs", () => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_APP_URL", "https://auth.xynes.com");
  render(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <ContentIntegrationPanel
        context={{ ...entryContext, deliveryState: "republish_required" }}
      />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByText(/legacy content/).closest('[role="status"]'),
  ).toHaveTextContent("legacy content");
  expect(
    screen.getByRole("link", { name: /Get a read-only API key/ }),
  ).toHaveAttribute(
    "href",
    expect.stringContaining("preset=cms_readonly&workspace=editorial"),
  );
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByLabelText("Request URL")).toHaveProperty(
    "value",
    expect.stringContaining("/delivery/entries/"),
  );
  fireEvent.change(screen.getByLabelText("Code format"), {
    target: { value: "url" },
  });
  expect(screen.getByLabelText("Code example")).toHaveProperty(
    "value",
    expect.stringMatching(/^https:\/\/api\.xynes\.com\//),
  );
});
it("keeps missing delivery metadata unknown even when the authoring badge is published", () => {
  render(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <ContentIntegrationPanel
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
      .getByText(/Availability has not been checked/)
      .closest('[role="status"]'),
  ).toHaveAttribute("role", "status");
});
it("blocks unsafe public configuration without exposing it", () => {
  render(
    <NextIntlClientProvider locale="en-US" messages={getCmsMessages("en-US")}>
      <ContentIntegrationPanel
        context={{
          ...entryContext,
          apiBaseUrl: "https://operator:private-credential@api.xynes.com",
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("button", { name: "Copy example" })).toBeDisabled();
  expect(screen.queryByLabelText("Request URL")).toBeNull();
  expect(document.body.textContent).not.toContain("private-credential");
});
