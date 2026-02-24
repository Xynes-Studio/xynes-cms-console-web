import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardComingSoonPanel } from "./DashboardComingSoonPanel";

afterEach(() => {
  cleanup();
});

describe("DashboardComingSoonPanel", () => {
  it("renders auth-style under-development copy for contents", () => {
    render(<DashboardComingSoonPanel sectionLabel="Contents" />);

    expect(
      screen.getByText("Contents are under development"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Content authoring and publishing are coming soon."),
    ).toBeInTheDocument();
  });

  it("renders auth-style under-development copy for integrations", () => {
    render(<DashboardComingSoonPanel sectionLabel="Integrations" />);

    expect(
      screen.getByText("Integrations are under development"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Connectors and external integrations are coming soon."),
    ).toBeInTheDocument();
  });

  it("renders the access control copy", () => {
    render(<DashboardComingSoonPanel sectionLabel="Access Control" />);

    expect(
      screen.getByText("Access Control is under development"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Role and permission management is coming soon."),
    ).toBeInTheDocument();
  });

  it("renders settings copy", () => {
    render(<DashboardComingSoonPanel sectionLabel="Settings" />);

    expect(screen.getByText("Settings are under development")).toBeInTheDocument();
    expect(
      screen.getByText("Workspace settings controls are coming soon."),
    ).toBeInTheDocument();
  });

  it("falls back to contents copy for unknown sections", () => {
    render(<DashboardComingSoonPanel sectionLabel="Unknown" />);

    expect(
      screen.getByText("Contents are under development"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Content authoring and publishing are coming soon."),
    ).toBeInTheDocument();
  });
});
